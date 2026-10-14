import { type PrismaClient } from '@prisma/client'
import { lineSubtotal, parseScaled, sumMoney } from '../domain/money'
import { ServiceError, lockCycle, runIdempotent, type Tx } from './mutation'

type OrderLineInput = { productId: string; priceType: 'consumer' | 'trader'; quantity: string }

async function loadLockedOrder(tx: Tx, orderId: string, correction = false) {
  const existing = await tx.order.findUnique({ where: { id: orderId }, select: { cycleId: true } })
  if (!existing) throw new ServiceError(404, 'ORDER_NOT_FOUND', 'Pesanan tidak ditemukan')
  await lockCycle(tx, existing.cycleId)
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`
  if (!rows.length) throw new ServiceError(404, 'ORDER_NOT_FOUND', 'Pesanan tidak ditemukan')
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: { include: { product: true } }, payments: true, cycle: { include: { supplierRecap: { select: { id: true } } } } } })
  if (!correction && order.cycle.rulesVersion !== 2) throw new ServiceError(409, 'LEGACY_CYCLE_READ_ONLY', 'Pesanan lama perlu direkonsiliasi')
  if (!correction && !order.ledgerReconciledAt && order.cycle.periodState !== 'draft') throw new ServiceError(409, 'LEDGER_RECONCILIATION_REQUIRED', 'Saldo pesanan belum diverifikasi')
  return order
}

function effectivePaid(payments: { amount: { toFixed: (digits: number) => string }; reversedAt: Date | null }[]) {
  return sumMoney(payments.filter((payment) => !payment.reversedAt).map((payment) => payment.amount.toFixed(2)))
}

function checkVersion(actual: number, expected: number) {
  if (actual !== expected) throw new ServiceError(409, 'STALE_VERSION', 'Pesanan telah berubah; muat ulang', { currentVersion: actual })
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
  return runIdempotent(prisma, {
    actorId: input.actorId, operation: 'order.edit', key: input.key,
    payload: { id: input.id, expectedVersion: input.expectedVersion, items, notes: input.notes ?? null },
  }, async (tx) => {
    const order = await loadLockedOrder(tx, input.id, true)
    checkVersion(order.version, input.expectedVersion)
    if (order.cancelledAt) throw new ServiceError(409, 'ORDER_CANCELLED', 'Pulihkan pesanan sebelum mengubahnya')
    const cycle = order.cycle
    const pricingPending = cycle.rulesVersion === 2 && cycle.periodState === 'draft'
    const prices = await tx.weeklyPrice.findMany({ where: { cycleId: order.cycleId }, include: { product: true } })
    const priceMap = new Map(prices.map((price) => [price.productId, price]))
    const oldLine = new Map(order.items.map((item) => [`${item.productId}:${item.priceType}`, item]))
    const nextLines = items.map((item) => {
      const price = priceMap.get(item.productId)
      const old = oldLine.get(`${item.productId}:${item.priceType}`)
      const product = price?.product ?? old?.product
      if (!product || (!product.isActive && !old)) {
        throw new ServiceError(422, 'PRODUCT_NOT_READY', 'Produk tidak tersedia pada siklus', { productId: item.productId })
      }
      try { parseScaled(item.quantity, (price?.quantityScaleSnapshot ?? product.quantityScale) as 0 | 2, 8, false) }
      catch { throw new ServiceError(400, 'INVALID_QUANTITY', 'Jumlah tidak sesuai satuan', { productId: item.productId }) }
      const current = price ? item.priceType === 'trader' ? (price.traderPrice ?? price.consumerPrice ?? price.price) : (price.consumerPrice ?? price.price) : null
      const unitPrice = pricingPending ? '0.00' : old?.unitPrice.toFixed(2) ?? current?.toFixed(2) ?? '0.00'
      if (!pricingPending && parseScaled(unitPrice, 2, 10) === 0n) throw new ServiceError(422, 'PRICE_NOT_READY', 'Harga produk belum siap', { productId: item.productId })
      return { ...item, unitPrice, subtotal: pricingPending ? '0.00' : lineSubtotal(unitPrice, item.quantity) }
    })
    const totalAmount = sumMoney(nextLines.map((line) => line.subtotal))
    const paid = effectivePaid(order.payments)
    const wasPaid = !pricingPending && (order.ledgerReconciledAt ? paid === order.totalAmount.toFixed(2) && (paid !== '0.00' || order.paymentStatus === 'paid') : order.paymentStatus === 'paid')
    const totalChanged = totalAmount !== order.totalAmount.toFixed(2)
    if (totalChanged && parseScaled(paid, 2, 10) > 0n) {
      await tx.payment.updateMany({ where: { orderId: order.id, reversedAt: null }, data: { reversedAt: new Date(), reversedBy: input.actorId, reversalReason: 'Koreksi nilai pesanan; status lunas mengikuti total terkoreksi' } })
    }
    if ((totalChanged || !order.ledgerReconciledAt) && wasPaid && parseScaled(totalAmount, 2, 10) > 0n) await tx.payment.create({ data: { orderId: order.id, amount: totalAmount, method: 'other', actorId: input.actorId, occurredAt: order.paidAt, note: 'Koreksi pembayaran penuh mengikuti perubahan nilai pesanan' } })
    const nextPaid = wasPaid ? totalAmount : totalChanged ? '0.00' : paid
    await tx.orderItem.deleteMany({ where: { orderId: input.id } })
    await tx.orderItem.createMany({ data: nextLines.map((line) => ({
      orderId: input.id, productId: line.productId, priceType: line.priceType,
      quantity: line.quantity, unitPrice: line.unitPrice, subtotal: line.subtotal,
    })) })
    const updated = await tx.order.update({
      where: { id: input.id },
      data: {
        totalAmount, notes: input.notes === undefined ? order.notes : input.notes, version: { increment: 1 },
        paymentStatus: pricingPending ? 'unpaid' : wasPaid ? 'paid' : nextPaid === '0.00' ? 'unpaid' : 'partial',
        ...(wasPaid ? { ledgerReconciledAt: order.ledgerReconciledAt ?? new Date(), ledgerReconciledBy: order.ledgerReconciledBy ?? input.actorId } : {}),
      }, include: { items: true },
    })
    await tx.cycle.update({ where: { id: order.cycleId }, data: { version: { increment: 1 } } })
    await tx.auditEvent.create({ data: {
      actorId: input.actorId, entityType: 'order', entityId: input.id, action: 'edited',
      before: { totalAmount: order.totalAmount.toFixed(2), paidAmount: paid, items: order.items.map((item) => ({ productId: item.productId, priceType: item.priceType, quantity: item.quantity.toFixed(2), unitPrice: item.unitPrice.toFixed(2) })) },
      after: { totalAmount, items: nextLines, paidAmount: nextPaid, paymentStatus: updated.paymentStatus },
    } })
    return { status: 200, body: { id: input.id, version: updated.version, totalAmount, items: updated.items.map((item) => ({ productId: item.productId, priceType: item.priceType, quantity: item.quantity.toFixed(2), unitPrice: item.unitPrice.toFixed(2), subtotal: item.subtotal.toFixed(2) })) } }
  })
}

export async function cancelOrder(prisma: PrismaClient, input: { actorId: string; key: string; id: string; expectedVersion: number; reason: string }) {
  return runIdempotent(prisma, { actorId: input.actorId, operation: 'order.cancel', key: input.key, payload: input }, async (tx) => {
    const order = await loadLockedOrder(tx, input.id, true)
    checkVersion(order.version, input.expectedVersion)
    if (order.cancelledAt) throw new ServiceError(409, 'ORDER_ALREADY_CANCELLED', 'Pesanan sudah dibatalkan')
    const cancelledAt = new Date()
    await tx.payment.updateMany({ where: { orderId: order.id, reversedAt: null }, data: { reversedAt: cancelledAt, reversedBy: input.actorId, reversalReason: input.reason } })
    const updated = await tx.order.update({ where: { id: input.id }, data: { cancelledAt, cancellationReason: input.reason, paymentStatus: 'unpaid', paidAt: null, ...(order.cycle.rulesVersion === 2 && order.cycle.periodState === 'draft' ? {} : { ledgerReconciledAt: order.ledgerReconciledAt ?? cancelledAt, ledgerReconciledBy: order.ledgerReconciledBy ?? input.actorId }), version: { increment: 1 } } })
    await tx.cycle.update({ where: { id: order.cycleId }, data: { version: { increment: 1 } } })
    await tx.rotationSchedule.updateMany({ where: { cycleId: order.cycleId, memberId: order.memberId }, data: { status: 'scheduled' } })
    await tx.auditEvent.create({ data: { actorId: input.actorId, entityType: 'order', entityId: input.id, action: 'cancelled', reason: input.reason, before: { totalAmount: order.totalAmount.toFixed(2), paidAmount: effectivePaid(order.payments), orderStatus: order.orderStatus }, after: { cancelledAt: cancelledAt.toISOString(), paidAmount: '0.00' } } })
    return { status: 200, body: { id: input.id, version: updated.version, cancelledAt: cancelledAt.toISOString() } }
  })
}

export async function restoreOrder(prisma: PrismaClient, input: { actorId: string; key: string; id: string; expectedVersion: number; reason: string; now?: Date }) {
  return runIdempotent(prisma, { actorId: input.actorId, operation: 'order.restore', key: input.key, payload: { id: input.id, expectedVersion: input.expectedVersion, reason: input.reason } }, async (tx) => {
    const order = await loadLockedOrder(tx, input.id, true)
    checkVersion(order.version, input.expectedVersion)
    if (!order.cancelledAt) throw new ServiceError(409, 'ORDER_NOT_CANCELLED', 'Pesanan tidak sedang dibatalkan')
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
    const order = await loadLockedOrder(tx, input.id, true)
    checkVersion(order.version, input.expectedVersion)
    if (order.cycle.periodState === 'draft') throw new ServiceError(409, 'PRICES_NOT_READY', 'Isi dan kunci harga sebelum memproses pengiriman')
    if (order.cancelledAt) throw new ServiceError(409, 'ORDER_CANCELLED', 'Pesanan dibatalkan')
    const next = { pending: 'confirmed', confirmed: 'shipped', shipped: 'delivered' }[order.orderStatus]
    if (next !== input.status) throw new ServiceError(409, 'INVALID_FULFILLMENT_TRANSITION', 'Status distribusi harus maju satu langkah')
    const updated = await tx.order.update({ where: { id: input.id }, data: { orderStatus: input.status, version: { increment: 1 } } })
    await tx.cycle.update({ where: { id: order.cycleId }, data: { version: { increment: 1 } } })
    await tx.auditEvent.create({ data: { actorId: input.actorId, entityType: 'order', entityId: input.id, action: 'fulfillment_changed', before: { status: order.orderStatus }, after: { status: input.status } } })
    return { status: 200, body: { id: input.id, version: updated.version, orderStatus: updated.orderStatus } }
  })
}
