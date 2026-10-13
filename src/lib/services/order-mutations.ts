import { type PrismaClient } from '@prisma/client'
import { canRecordOrder, needsRecapForOrderEntry } from '../domain/calendar'
import { canChangeAllocation } from '../domain/availability'
import { lineSubtotal, parseScaled, sumMoney } from '../domain/money'
import { getCycleAvailability } from './availability'
import { ServiceError, lockCycle, runIdempotent, type Tx } from './mutation'

type OrderLineInput = { productId: string; priceType: 'consumer' | 'trader'; quantity: string }

async function loadLockedOrder(tx: Tx, orderId: string) {
  const existing = await tx.order.findUnique({ where: { id: orderId }, select: { cycleId: true } })
  if (!existing) throw new ServiceError(404, 'ORDER_NOT_FOUND', 'Pesanan tidak ditemukan')
  await lockCycle(tx, existing.cycleId)
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`
  if (!rows.length) throw new ServiceError(404, 'ORDER_NOT_FOUND', 'Pesanan tidak ditemukan')
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, payments: true, cycle: { include: { supplierRecap: { select: { id: true } } } } } })
  if (order.cycle.rulesVersion !== 2) throw new ServiceError(409, 'LEGACY_CYCLE_READ_ONLY', 'Pesanan lama perlu direkonsiliasi')
  if (!order.ledgerReconciledAt && order.cycle.periodState !== 'draft') throw new ServiceError(409, 'LEDGER_RECONCILIATION_REQUIRED', 'Saldo pesanan belum diverifikasi')
  return order
}

function effectivePaid(payments: { amount: { toFixed: (digits: number) => string }; reversedAt: Date | null }[]) {
  return sumMoney(payments.filter((payment) => !payment.reversedAt).map((payment) => payment.amount.toFixed(2)))
}

function checkVersion(actual: number, expected: number) {
  if (actual !== expected) throw new ServiceError(409, 'STALE_VERSION', 'Pesanan telah berubah; muat ulang', { currentVersion: actual })
}

function quantities(items: readonly { productId: string; quantity: { toFixed: (digits: number) => string } | string }[]) {
  const result = new Map<string, bigint>()
  for (const item of items) {
    const value = typeof item.quantity === 'string' ? item.quantity : item.quantity.toFixed(2)
    result.set(item.productId, (result.get(item.productId) ?? 0n) + parseScaled(value, 2, 8))
  }
  return result
}

export async function editOrder(prisma: PrismaClient, input: {
  actorId: string; key: string; id: string; expectedVersion: number; items: OrderLineInput[]
  notes?: string | null; now?: Date
}) {
  const items = [...input.items].sort((a, b) => `${a.productId}:${a.priceType}`.localeCompare(`${b.productId}:${b.priceType}`))
  if (new Set(items.map((item) => `${item.productId}:${item.priceType}`)).size !== items.length) {
    throw new ServiceError(400, 'DUPLICATE_ORDER_ITEM', 'Produk dan jenis harga tidak boleh duplikat')
  }
  if (!items.length) throw new ServiceError(400, 'ORDER_ITEMS_REQUIRED', 'Pesanan memerlukan minimal satu produk')
  const now = input.now ?? new Date()
  return runIdempotent(prisma, {
    actorId: input.actorId, operation: 'order.edit', key: input.key,
    payload: { id: input.id, expectedVersion: input.expectedVersion, items, notes: input.notes ?? null },
  }, async (tx) => {
    const order = await loadLockedOrder(tx, input.id)
    checkVersion(order.version, input.expectedVersion)
    if (order.cancelledAt) throw new ServiceError(409, 'ORDER_CANCELLED', 'Pulihkan pesanan sebelum mengubahnya')
    if (order.orderStatus === 'shipped' || order.orderStatus === 'delivered') throw new ServiceError(409, 'ORDER_ALREADY_SHIPPED', 'Pesanan yang sudah keluar tidak dapat diubah')
    const cycle = order.cycle
    const pricingPending = cycle.periodState === 'draft'
    const prices = await tx.weeklyPrice.findMany({ where: { cycleId: order.cycleId }, include: { product: true } })
    const priceMap = new Map(prices.map((price) => [price.productId, price]))
    const oldLine = new Map(order.items.map((item) => [`${item.productId}:${item.priceType}`, item]))
    const nextLines = items.map((item) => {
      const price = priceMap.get(item.productId)
      if (!price || price.quantityScaleSnapshot === null || price.targetGroupSnapshot === null || !price.product.isActive) {
        throw new ServiceError(422, 'PRODUCT_NOT_READY', 'Produk tidak tersedia pada siklus', { productId: item.productId })
      }
      try { parseScaled(item.quantity, price.quantityScaleSnapshot as 0 | 2, 8, false) }
      catch { throw new ServiceError(400, 'INVALID_QUANTITY', 'Jumlah tidak sesuai satuan', { productId: item.productId }) }
      const old = oldLine.get(`${item.productId}:${item.priceType}`)
      const current = item.priceType === 'trader' ? (price.traderPrice ?? price.consumerPrice ?? price.price) : (price.consumerPrice ?? price.price)
      const unitPrice = pricingPending ? '0.00' : old?.unitPrice.toFixed(2) ?? current.toFixed(2)
      if (!pricingPending && parseScaled(unitPrice, 2, 10) === 0n) throw new ServiceError(422, 'PRICE_NOT_READY', 'Harga produk belum siap', { productId: item.productId })
      return { ...item, unitPrice, subtotal: pricingPending ? '0.00' : lineSubtotal(unitPrice, item.quantity) }
    })
    const oldQuantities = quantities(order.items)
    const newQuantities = quantities(nextLines)
    const increasing = [...newQuantities].some(([productId, value]) => value > (oldQuantities.get(productId) ?? 0n))
    if (increasing) {
      const periodStart = cycle.periodStart.toISOString().slice(0, 10)
      if (!canRecordOrder(periodStart, cycle.periodState, now)) {
        throw new ServiceError(409, 'ORDER_WINDOW_CLOSED', 'Jatah tidak dapat ditambah sebelum siklus dimulai atau setelah ditutup manual')
      }
      if (!pricingPending && needsRecapForOrderEntry(periodStart, Boolean(cycle.supplierRecap), now)) {
        throw new ServiceError(409, 'RECAP_REQUIRED', 'Rekap supplier harus dikonfirmasi sebelum menambah pesanan')
      }
      if (cycle.supplierRecap) {
        const available = await getCycleAvailability(tx, order.cycleId)
        for (const [productId, newQty] of newQuantities) {
          const oldQty = oldQuantities.get(productId) ?? 0n
          if (newQty <= oldQty) continue
          const row = available.items.find((item) => item.productId === productId)
          const capacity = row?.capacity ?? '0.00'
          const allocated = row?.allocated ?? '0.00'
          const asDecimal = (value: bigint) => `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`
          if (!canChangeAllocation(capacity, allocated, asDecimal(oldQty), asDecimal(newQty))) {
            throw new ServiceError(409, 'INSUFFICIENT_ALLOCATION', 'Jatah produk minggu ini tidak cukup', { productId, available: row?.availableToOrder ?? '0.00' })
          }
        }
      }
    }
    const totalAmount = sumMoney(nextLines.map((line) => line.subtotal))
    const paid = effectivePaid(order.payments)
    if (parseScaled(totalAmount, 2, 10) < parseScaled(paid, 2, 10)) {
      throw new ServiceError(409, 'TOTAL_BELOW_PAID', 'Total baru lebih kecil daripada pembayaran yang sudah diterima')
    }
    await tx.orderItem.deleteMany({ where: { orderId: input.id } })
    await tx.orderItem.createMany({ data: nextLines.map((line) => ({
      orderId: input.id, productId: line.productId, priceType: line.priceType,
      quantity: line.quantity, unitPrice: line.unitPrice, subtotal: line.subtotal,
    })) })
    const updated = await tx.order.update({
      where: { id: input.id },
      data: {
        totalAmount, notes: input.notes === undefined ? order.notes : input.notes, version: { increment: 1 },
        paymentStatus: pricingPending ? 'unpaid' : paid === totalAmount ? 'paid' : paid === '0.00' ? 'unpaid' : 'partial',
      }, include: { items: true },
    })
    await tx.cycle.update({ where: { id: order.cycleId }, data: { version: { increment: 1 } } })
    await tx.auditEvent.create({ data: {
      actorId: input.actorId, entityType: 'order', entityId: input.id, action: 'edited',
      before: { totalAmount: order.totalAmount.toFixed(2), itemCount: order.items.length },
      after: { totalAmount, itemCount: nextLines.length },
    } })
    return { status: 200, body: { id: input.id, version: updated.version, totalAmount, items: updated.items.map((item) => ({ productId: item.productId, priceType: item.priceType, quantity: item.quantity.toFixed(2), unitPrice: item.unitPrice.toFixed(2), subtotal: item.subtotal.toFixed(2) })) } }
  })
}

export async function cancelOrder(prisma: PrismaClient, input: { actorId: string; key: string; id: string; expectedVersion: number; reason: string }) {
  return runIdempotent(prisma, { actorId: input.actorId, operation: 'order.cancel', key: input.key, payload: input }, async (tx) => {
    const order = await loadLockedOrder(tx, input.id)
    checkVersion(order.version, input.expectedVersion)
    if (order.cancelledAt) throw new ServiceError(409, 'ORDER_ALREADY_CANCELLED', 'Pesanan sudah dibatalkan')
    if (order.orderStatus === 'shipped' || order.orderStatus === 'delivered') throw new ServiceError(409, 'ORDER_ALREADY_SHIPPED', 'Pesanan yang sudah keluar tidak dapat dibatalkan')
    if (parseScaled(effectivePaid(order.payments), 2, 10) > 0n) throw new ServiceError(409, 'PAYMENT_REVERSAL_REQUIRED', 'Koreksi pembayaran sebelum membatalkan pesanan')
    const cancelledAt = new Date()
    const updated = await tx.order.update({ where: { id: input.id }, data: { cancelledAt, cancellationReason: input.reason, version: { increment: 1 } } })
    await tx.cycle.update({ where: { id: order.cycleId }, data: { version: { increment: 1 } } })
    await tx.rotationSchedule.updateMany({ where: { cycleId: order.cycleId, memberId: order.memberId }, data: { status: 'scheduled' } })
    await tx.auditEvent.create({ data: { actorId: input.actorId, entityType: 'order', entityId: input.id, action: 'cancelled', reason: input.reason, after: { cancelledAt: cancelledAt.toISOString() } } })
    return { status: 200, body: { id: input.id, version: updated.version, cancelledAt: cancelledAt.toISOString() } }
  })
}

export async function restoreOrder(prisma: PrismaClient, input: { actorId: string; key: string; id: string; expectedVersion: number; reason: string; now?: Date }) {
  const now = input.now ?? new Date()
  return runIdempotent(prisma, { actorId: input.actorId, operation: 'order.restore', key: input.key, payload: { id: input.id, expectedVersion: input.expectedVersion, reason: input.reason } }, async (tx) => {
    const order = await loadLockedOrder(tx, input.id)
    checkVersion(order.version, input.expectedVersion)
    if (!order.cancelledAt) throw new ServiceError(409, 'ORDER_NOT_CANCELLED', 'Pesanan tidak sedang dibatalkan')
    const periodStart = order.cycle.periodStart.toISOString().slice(0, 10)
    const pricingPending = order.cycle.periodState === 'draft'
    if (!canRecordOrder(periodStart, order.cycle.periodState, now)) throw new ServiceError(409, 'ORDER_WINDOW_CLOSED', 'Pesanan tidak dapat dipulihkan sebelum siklus dimulai atau setelah ditutup manual')
    if (!pricingPending && needsRecapForOrderEntry(periodStart, Boolean(order.cycle.supplierRecap), now)) throw new ServiceError(409, 'RECAP_REQUIRED', 'Rekap supplier harus dikonfirmasi sebelum memulihkan pesanan')
    const prices = await tx.weeklyPrice.findMany({ where: { cycleId: order.cycleId } })
    const priceMap = new Map(prices.map((price) => [price.productId, price]))
    for (const item of order.items) {
      const price = priceMap.get(item.productId)
      if (!price || price.targetGroupSnapshot === null || (!pricingPending && item.unitPrice.lte(0))) throw new ServiceError(422, 'PRICE_NOT_READY', 'Harga atau mapping produk belum siap', { productId: item.productId })
    }
    if (order.cycle.supplierRecap) {
      const available = await getCycleAvailability(tx, order.cycleId)
      for (const [productId, quantity] of quantities(order.items)) {
        const row = available.items.find((item) => item.productId === productId)
        if (quantity > parseScaled(row?.availableToOrder ?? '0.00', 2, 8)) {
          throw new ServiceError(409, 'INSUFFICIENT_ALLOCATION', 'Jatah produk tidak cukup untuk pemulihan', { productId, available: row?.availableToOrder ?? '0.00' })
        }
      }
    }
    const updated = await tx.order.update({ where: { id: input.id }, data: { cancelledAt: null, cancellationReason: null, orderStatus: 'pending', version: { increment: 1 } } })
    await tx.cycle.update({ where: { id: order.cycleId }, data: { version: { increment: 1 } } })
    await tx.rotationSchedule.updateMany({ where: { cycleId: order.cycleId, memberId: order.memberId }, data: { status: 'ordered' } })
    await tx.auditEvent.create({ data: { actorId: input.actorId, entityType: 'order', entityId: input.id, action: 'restored', reason: input.reason } })
    return { status: 200, body: { id: input.id, version: updated.version, cancelledAt: null } }
  })
}

export async function updateFulfillment(prisma: PrismaClient, input: {
  actorId: string; key: string; id: string; expectedVersion: number; status: 'confirmed' | 'shipped' | 'delivered'
}) {
  return runIdempotent(prisma, { actorId: input.actorId, operation: 'order.fulfillment', key: input.key, payload: input }, async (tx) => {
    const order = await loadLockedOrder(tx, input.id)
    checkVersion(order.version, input.expectedVersion)
    if (order.cycle.periodState === 'draft') throw new ServiceError(409, 'PRICES_NOT_READY', 'Isi dan kunci harga sebelum memproses pengiriman')
    if (order.cancelledAt) throw new ServiceError(409, 'ORDER_CANCELLED', 'Pesanan dibatalkan')
    const next = { pending: 'confirmed', confirmed: 'shipped', shipped: 'delivered' }[order.orderStatus]
    if (next !== input.status) throw new ServiceError(409, 'INVALID_FULFILLMENT_TRANSITION', 'Status distribusi harus maju satu langkah')
    if (input.status === 'shipped') {
      const availability = await getCycleAvailability(tx, order.cycleId)
      if (availability.items[0]?.source !== 'received') throw new ServiceError(409, 'RECEIPT_REQUIRED', 'Penerimaan barang harus dikonfirmasi sebelum distribusi')
      for (const [productId, quantity] of quantities(order.items)) {
        const row = availability.items.find((item) => item.productId === productId)
        if (quantity > parseScaled(row?.physicalRemaining ?? '0.00', 2, 8)) {
          throw new ServiceError(409, 'INSUFFICIENT_PHYSICAL_STOCK', 'Barang layak belum cukup untuk pesanan ini', { productId, physicalRemaining: row?.physicalRemaining ?? '0.00' })
        }
      }
    }
    const updated = await tx.order.update({ where: { id: input.id }, data: { orderStatus: input.status, version: { increment: 1 } } })
    await tx.cycle.update({ where: { id: order.cycleId }, data: { version: { increment: 1 } } })
    await tx.auditEvent.create({ data: { actorId: input.actorId, entityType: 'order', entityId: input.id, action: 'fulfillment_changed', before: { status: order.orderStatus }, after: { status: input.status } } })
    return { status: 200, body: { id: input.id, version: updated.version, orderStatus: updated.orderStatus } }
  })
}
