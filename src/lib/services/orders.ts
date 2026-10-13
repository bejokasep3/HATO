import { type PrismaClient } from '@prisma/client'
import { canRecordOrder, cycleTiming, needsRecapForOrderEntry } from '../domain/calendar'
import { lineSubtotal, parseScaled, sumMoney } from '../domain/money'
import { getCycleAvailability } from './availability'
import { ServiceError, lockCycle, runIdempotent } from './mutation'

type OrderLineInput = { productId: string; priceType: 'consumer' | 'trader'; quantity: string }

export async function createOrder(prisma: PrismaClient, input: {
  actorId: string
  key: string
  cycleId: string
  memberId: string
  items: OrderLineInput[]
  notes?: string | null
  now?: Date
}) {
  const items = [...input.items].sort((a, b) => `${a.productId}:${a.priceType}`.localeCompare(`${b.productId}:${b.priceType}`))
  if (new Set(items.map((item) => `${item.productId}:${item.priceType}`)).size !== items.length) {
    throw new ServiceError(400, 'DUPLICATE_ORDER_ITEM', 'Produk dan jenis harga tidak boleh duplikat')
  }
  const now = input.now ?? new Date()
  return runIdempotent(prisma, {
    actorId: input.actorId, operation: 'order.create', key: input.key,
    payload: { cycleId: input.cycleId, memberId: input.memberId, items, notes: input.notes ?? null },
  }, async (tx) => {
    await lockCycle(tx, input.cycleId)
    const cycle = await tx.cycle.findUnique({ where: { id: input.cycleId }, include: { supplierRecap: { select: { id: true } } } })
    if (!cycle || cycle.rulesVersion !== 2 || !['draft', 'open'].includes(cycle.periodState ?? '')) {
      throw new ServiceError(409, 'CYCLE_NOT_OPEN', 'Siklus ini tidak menerima pesanan baru')
    }
    const periodStart = cycle.periodStart.toISOString().slice(0, 10)
    if (!canRecordOrder(periodStart, cycle.periodState, now)) {
      throw new ServiceError(409, 'ORDER_WINDOW_CLOSED', 'Siklus belum dimulai atau ditutup manual')
    }
    const pricingPending = cycle.periodState === 'draft'
    if (!pricingPending && needsRecapForOrderEntry(periodStart, Boolean(cycle.supplierRecap), now)) {
      throw new ServiceError(409, 'RECAP_REQUIRED', 'Rekap supplier harus dikonfirmasi sebelum menerima pesanan tambahan')
    }
    const member = await tx.member.findUnique({ where: { id: input.memberId }, select: { isActive: true } })
    if (!member?.isActive) throw new ServiceError(422, 'MEMBER_NOT_ACTIVE', 'Anggota tidak aktif atau tidak ditemukan')
    const existing = await tx.order.findUnique({ where: { cycleId_memberId: { cycleId: input.cycleId, memberId: input.memberId } } })
    if (existing) throw new ServiceError(409, 'ORDER_ALREADY_EXISTS', 'Anggota sudah memiliki pesanan; gunakan edit atau restore')

    const prices = await tx.weeklyPrice.findMany({ where: { cycleId: input.cycleId }, include: { product: true } })
    const priceMap = new Map(prices.map((price) => [price.productId, price]))
    const orderItems = items.map((item) => {
      const price = priceMap.get(item.productId)
      if (!price || !price.product.isActive || price.quantityScaleSnapshot === null || price.targetGroupSnapshot === null) {
        throw new ServiceError(422, 'PRODUCT_NOT_READY', 'Produk belum tersedia pada siklus ini', { productId: item.productId })
      }
      try { parseScaled(item.quantity, price.quantityScaleSnapshot as 0 | 2, 8, false) }
      catch { throw new ServiceError(400, 'INVALID_QUANTITY', 'Jumlah produk tidak sesuai satuan', { productId: item.productId }) }
      const selected = item.priceType === 'trader' ? (price.traderPrice ?? price.consumerPrice ?? price.price) : (price.consumerPrice ?? price.price)
      if (!pricingPending && selected.lte(0)) throw new ServiceError(422, 'PRICE_NOT_READY', 'Harga produk belum diisi', { productId: item.productId })
      const unitPrice = pricingPending ? '0.00' : selected.toFixed(2)
      return { ...item, unitPrice, subtotal: pricingPending ? '0.00' : lineSubtotal(unitPrice, item.quantity) }
    })

    if (cycle.supplierRecap) {
      const available = await getCycleAvailability(tx, input.cycleId)
      const requestedByProduct = new Map<string, bigint>()
      for (const item of items) requestedByProduct.set(item.productId, (requestedByProduct.get(item.productId) ?? 0n) + parseScaled(item.quantity, 2, 8))
      for (const [productId, requested] of requestedByProduct) {
        const row = available.items.find((item) => item.productId === productId)
        const remaining = parseScaled(row?.availableToOrder ?? '0.00', 2, 8)
        if (requested > remaining) {
          throw new ServiceError(409, 'INSUFFICIENT_ALLOCATION', 'Jatah produk minggu ini tidak cukup', {
            productId, available: row?.availableToOrder ?? '0.00', requested: `${requested / 100n}.${(requested % 100n).toString().padStart(2, '0')}`,
          })
        }
      }
    }

    const totalAmount = sumMoney(orderItems.map((item) => item.subtotal))
    const created = await tx.order.create({
      data: {
        cycleId: input.cycleId,
        memberId: input.memberId,
        notes: input.notes ?? null,
        totalAmount,
        paymentStatus: 'unpaid',
        orderStatus: 'pending',
        createdBy: input.actorId,
        ledgerReconciledAt: pricingPending ? null : now,
        ledgerReconciledBy: pricingPending ? null : input.actorId,
        items: { create: orderItems.map((item) => ({
          productId: item.productId, priceType: item.priceType, quantity: item.quantity,
          unitPrice: item.unitPrice, subtotal: item.subtotal,
        })) },
      }, include: { items: true },
    })
    await tx.rotationSchedule.updateMany({ where: { cycleId: input.cycleId, memberId: input.memberId }, data: { status: 'ordered' } })
    await tx.cycle.update({ where: { id: input.cycleId }, data: { version: { increment: 1 } } })
    await tx.auditEvent.create({ data: {
      actorId: input.actorId, entityType: 'order', entityId: created.id, action: 'created',
      after: { cycleId: input.cycleId, totalAmount, itemCount: created.items.length, recordedAfterEnd: cycleTiming({ periodStart }, now).calendarStatus === 'ended' },
    } })
    return { status: 201, body: {
      id: created.id, cycleId: created.cycleId, memberId: created.memberId, version: created.version,
      totalAmount: created.totalAmount.toFixed(2),
      pricingPending,
      paymentSummary: pricingPending ? { status: 'unverified', paidAmount: null, outstandingAmount: null } : { status: 'unpaid', paidAmount: '0.00', outstandingAmount: created.totalAmount.toFixed(2) },
      cancelledAt: null,
      items: created.items.map((item) => ({
        id: item.id, productId: item.productId, priceType: item.priceType,
        quantity: item.quantity.toFixed(2), unitPrice: item.unitPrice.toFixed(2), subtotal: item.subtotal.toFixed(2),
      })),
    } }
  })
}
