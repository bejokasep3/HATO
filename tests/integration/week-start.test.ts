import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { assertIsolatedTestDatabase } from '../../scripts/migration/test-db'
import { createCycle, openCycle, setCyclePrices } from '../../src/lib/services/cycles'
import { createOrder } from '../../src/lib/services/orders'
import { cancelOrder, editOrder, restoreOrder, updateFulfillment } from '../../src/lib/services/order-mutations'
import { addPayment } from '../../src/lib/services/payments'
import { ServiceError } from '../../src/lib/services/mutation'
import { getCycleSummary } from '../../src/lib/services/operational-summary'
import { addCalendarDays, cycleTiming } from '../../src/lib/domain/calendar'

const prisma = new PrismaClient()
const actorId = '30000000-0000-4000-8000-000000000099'
const start = addCalendarDays('2050-01-03', 7 * Math.floor(Math.random() * 100000))
const now = new Date(`${start}T03:00:00.000Z`)
const targets = [{ groupCode: 'AYAM' as const, quantity: '20.00' }, { groupCode: 'TAHU' as const, quantity: '10.00' }]
const errorCode = (code: string) => (error: unknown) => error instanceof ServiceError && error.code === code

test('start week, record quantities, then lock prices without changing older bills', async () => {
  await assertIsolatedTestDatabase(prisma)
  const legacyBefore = await prisma.order.findUniqueOrThrow({ where: { id: '00000000-0000-4000-8000-000000000006' }, include: { items: true } })
  await prisma.product.updateMany({ where: { isActive: true }, data: { targetGroup: 'AYAM', quantityScale: 2 } })
  const products = await prisma.product.findMany({ where: { isActive: true } })
  const productId = products[0].id
  const group = await prisma.group.create({ data: { name: 'Minggu Baru Uji', level: 1 } })
  const members = await Promise.all([0, 1, 2].map((index) => prisma.member.create({ data: { groupId: group.id, name: `Pesanan Uji ${index}`, phone: `00000${index}`, level: 1 } })))
  const input = { actorId, key: randomUUID(), periodStart: start, targets, copyPreviousPrices: false }
  const created = await createCycle(prisma, input)
  assert.deepEqual(await createCycle(prisma, input), created)
  const cycleId = created.body.id as string
  await assert.rejects(() => createCycle(prisma, { ...input, key: randomUUID() }), errorCode('WEEK_ALREADY_EXISTS'))
  const initial = await prisma.weeklyPrice.findMany({ where: { cycleId } })
  assert(initial.every((price) => price.price.isZero() && price.consumerPrice === null))
  const items = [{ productId, priceType: 'consumer' as const, quantity: '1.50' }, { productId, priceType: 'trader' as const, quantity: '2.00' }]
  const orderInput = { actorId, key: randomUUID(), cycleId, memberId: members[0].id, items, now }
  const order = await createOrder(prisma, orderInput)
  assert.deepEqual(await createOrder(prisma, orderInput), order)
  assert.equal(order.body.pricingPending, true)
  assert.equal(order.body.totalAmount, '0.00')
  assert.deepEqual(order.body.paymentSummary, { status: 'unverified', paidAmount: null, outstandingAmount: null })
  const demand = await getCycleSummary(prisma, cycleId)
  assert.equal(demand.targets.find((target) => target.groupCode === 'AYAM')?.demand, '3.50')
  const orderId = order.body.id as string
  await assert.rejects(() => addPayment(prisma, { actorId, key: randomUUID(), orderId, amount: '1.00', method: 'cash' }), errorCode('PRICES_NOT_READY'))
  await assert.rejects(() => updateFulfillment(prisma, { actorId, key: randomUUID(), id: orderId, expectedVersion: 0, status: 'confirmed' }), errorCode('PRICES_NOT_READY'))
  await assert.rejects(() => createOrder(prisma, { ...orderInput, key: randomUUID(), memberId: members[1].id, now: new Date(`${addCalendarDays(start, -1)}T16:59:59Z`) }), errorCode('ORDER_WINDOW_CLOSED'))
  const edited = await editOrder(prisma, { actorId, key: randomUUID(), id: orderId, expectedVersion: 0, items, now })
  assert.equal(edited.body.totalAmount, '0.00')
  await cancelOrder(prisma, { actorId, key: randomUUID(), id: orderId, expectedVersion: 1, reason: 'Uji pembatalan' })
  await restoreOrder(prisma, { actorId, key: randomUUID(), id: orderId, expectedVersion: 2, reason: 'Uji pemulihan', now })
  const cancelled = await createOrder(prisma, { actorId, key: randomUUID(), cycleId, memberId: members[1].id, now, items: [{ productId, priceType: 'consumer', quantity: '1.00' }] })
  await cancelOrder(prisma, { actorId, key: randomUUID(), id: cancelled.body.id as string, expectedVersion: 0, reason: 'Tidak jadi pesan' })
  const version = (await prisma.cycle.findUniqueOrThrow({ where: { id: cycleId } })).version
  await assert.rejects(() => openCycle(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: version }), errorCode('PRICES_NOT_READY'))
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).ledgerReconciledAt, null)
  const priced = await setCyclePrices(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: version, items: products.map((product) => ({ productId: product.id, consumerPrice: '10000.00', traderPrice: '8000.00' })) })
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).totalAmount.toFixed(2), '0.00')
  const openInput = { actorId, key: randomUUID(), id: cycleId, expectedVersion: priced.body.version as number }
  const opened = await openCycle(prisma, openInput)
  assert.deepEqual(await openCycle(prisma, openInput), opened)
  const final = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } })
  assert.equal(final.totalAmount.toFixed(2), '31000.00')
  assert(final.ledgerReconciledAt)
  assert.equal(final.version, 4)
  assert.deepEqual(final.items.map((item) => item.unitPrice.toFixed(2)).sort(), ['10000.00', '8000.00'])
  const cancelledAfter = await prisma.order.findUniqueOrThrow({ where: { id: cancelled.body.id as string } })
  assert(cancelledAfter.cancelledAt)
  assert.equal(cancelledAfter.totalAmount.toFixed(2), '10000.00')
  const summary = await getCycleSummary(prisma, cycleId)
  assert.equal(summary.finances.knownOutstanding, '31000.00')
  assert.equal(summary.finances.unknownBalanceCount, 0)
  await assert.rejects(() => setCyclePrices(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: opened.body.version as number, items: [] }), errorCode('PRICES_LOCKED'))
  await addPayment(prisma, { actorId, key: randomUUID(), orderId, amount: '10000.00', method: 'cash' })
  const legacyAfter = await prisma.order.findUniqueOrThrow({ where: { id: legacyBefore.id }, include: { items: true } })
  assert.deepEqual(legacyAfter, legacyBefore)
})

test('ended weeks allow late entry, quantity correction and restore without reopening the calendar', async () => {
  await assertIsolatedTestDatabase(prisma)
  const periodStart = addCalendarDays(start, -14)
  const lateNow = new Date(`${start}T03:00:00Z`)
  const group = await prisma.group.create({ data: { name: 'Koreksi Minggu Lama', level: 1 } })
  const members = await Promise.all([0, 1].map((index) => prisma.member.create({ data: { groupId: group.id, name: `Terlambat ${index}`, phone: `00100${index}`, level: 1 } })))
  const products = await prisma.product.findMany({ where: { isActive: true } })
  const productId = products[0].id
  const created = await createCycle(prisma, { actorId, key: randomUUID(), periodStart, targets, copyPreviousPrices: false })
  const cycleId = created.body.id as string
  const items = [{ productId, priceType: 'consumer' as const, quantity: '1.00' }]
  const order = await createOrder(prisma, { actorId, key: randomUUID(), cycleId, memberId: members[0].id, items, now: lateNow })
  assert.equal(order.body.pricingPending, true)
  const orderId = order.body.id as string
  await editOrder(prisma, { actorId, key: randomUUID(), id: orderId, expectedVersion: 0, items: [{ ...items[0], quantity: '2.00' }], now: lateNow })
  await cancelOrder(prisma, { actorId, key: randomUUID(), id: orderId, expectedVersion: 1, reason: 'Koreksi input' })
  await restoreOrder(prisma, { actorId, key: randomUUID(), id: orderId, expectedVersion: 2, reason: 'Catatan diverifikasi', now: lateNow })
  const version = (await prisma.cycle.findUniqueOrThrow({ where: { id: cycleId } })).version
  const prices = await setCyclePrices(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: version, items: products.map((product) => ({ productId: product.id, consumerPrice: '10000.00', traderPrice: '8000.00' })) })
  await openCycle(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: prices.body.version as number })
  const priced = await createOrder(prisma, { actorId, key: randomUUID(), cycleId, memberId: members[1].id, items, now: lateNow })
  assert.equal(priced.body.totalAmount, '10000.00')
  const pricedId = priced.body.id as string
  const audit = await prisma.auditEvent.findFirstOrThrow({ where: { entityId: pricedId, action: 'created' } })
  assert.equal((audit.after as { recordedAfterEnd: boolean }).recordedAfterEnd, true)
  await cancelOrder(prisma, { actorId, key: randomUUID(), id: pricedId, expectedVersion: 0, reason: 'Koreksi catatan lama' })
  await restoreOrder(prisma, { actorId, key: randomUUID(), id: pricedId, expectedVersion: 1, reason: 'Verifikasi catatan lama', now: lateNow })
  await editOrder(prisma, { actorId, key: randomUUID(), id: orderId, expectedVersion: 4, items: [{ ...items[0], quantity: '3.00' }], now: lateNow })
  await addPayment(prisma, { actorId, key: randomUUID(), orderId, amount: '20000.00', method: 'cash' })
  const paid = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
  await assert.rejects(() => editOrder(prisma, { actorId, key: randomUUID(), id: orderId, expectedVersion: paid.version, items, now: lateNow }), errorCode('TOTAL_BELOW_PAID'))
  const cycle = await prisma.cycle.findUniqueOrThrow({ where: { id: cycleId } })
  assert.equal(cycleTiming({ periodStart, periodState: cycle.periodState }, lateNow).effectiveStatus, 'ended')
  await prisma.cycle.update({ where: { id: cycleId }, data: { periodState: 'closed' } })
  await assert.rejects(() => editOrder(prisma, { actorId, key: randomUUID(), id: orderId, expectedVersion: paid.version, items: [{ ...items[0], quantity: '4.00' }], now: lateNow }), errorCode('ORDER_WINDOW_CLOSED'))
})

test.after(async () => { await prisma.$disconnect() })
