import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { assertIsolatedTestDatabase } from '../../scripts/migration/test-db'
import { ServiceError } from '../../src/lib/services/mutation'
import { cancelOrder, editOrder, restoreOrder, updateFulfillment } from '../../src/lib/services/order-mutations'
import { addPayment, getOrderPayments, getReceivables, settleOrder } from '../../src/lib/services/payments'
import { getCycleSummary } from '../../src/lib/services/operational-summary'

const prisma = new PrismaClient()
const actorId = '40000000-0000-4000-8000-000000000099'
test('ended legacy orders can be corrected, settled and deleted without changing original evidence', async () => {
  await assertIsolatedTestDatabase(prisma, 'hato_recap')
  const product = await prisma.product.findFirstOrThrow({ where: { targetGroup: 'AYAM', isActive: true } })
  const group = await prisma.group.create({ data: { name: 'Simple flow fixture', level: 1 } })
  const member = await prisma.member.create({ data: { name: 'Simple flow member', phone: '000', level: 1, groupId: group.id } })
  const cycle = await prisma.cycle.create({ data: { label: 'Ended legacy fixture', periodStart: new Date('2020-01-06'), orderDeadline: new Date('2020-01-09'), deliveryDate: new Date('2020-01-10'), status: 'completed', targets: { create: [{ groupCode: 'AYAM', quantity: '20', unit: 'kg' }, { groupCode: 'TAHU', quantity: '10', unit: 'bungkus' }] } } })
  const order = await prisma.order.create({ data: { cycleId: cycle.id, memberId: member.id, totalAmount: '100000', orderStatus: 'delivered', items: { create: { productId: product.id, quantity: '10', unitPrice: '10000', subtotal: '100000' } } } })
  const input = { actorId, key: randomUUID(), orderId: order.id, expectedVersion: 0 }
  await assert.rejects(() => settleOrder(prisma, { ...input, expectedVersion: 1 }), (error: unknown) => error instanceof ServiceError && error.code === 'STALE_VERSION')
  const settled = await settleOrder(prisma, input)
  assert.deepEqual(await settleOrder(prisma, input), settled)
  assert.equal((await getOrderPayments(prisma, order.id)).summary.status, 'paid')
  assert.equal(await prisma.payment.count({ where: { orderId: order.id } }), 1)
  assert.equal((await getReceivables(prisma, { page: 1, pageSize: 20, cycleId: cycle.id })).totalCount, 0)
  const editInput = { actorId, key: randomUUID(), id: order.id, expectedVersion: 1, items: [{ productId: product.id, priceType: 'consumer' as const, quantity: '5' }] }
  const edited = await editOrder(prisma, editInput)
  assert.deepEqual(await editOrder(prisma, editInput), edited)
  const after = await getOrderPayments(prisma, order.id)
  assert.equal(after.summary.status, 'paid')
  assert.equal(after.summary.paidAmount, '50000.00')
  assert.equal(after.payments.filter((payment) => Boolean(payment.reversedAt)).length, 1)
  assert.equal(after.payments.filter((payment) => !payment.reversedAt).length, 1)
  const raised = await editOrder(prisma, { ...editInput, key: randomUUID(), expectedVersion: 2, items: [{ ...editInput.items[0], quantity: '25' }] })
  assert.equal(raised.body.totalAmount, '250000.00')
  assert.equal((await getOrderPayments(prisma, order.id)).summary.paidAmount, '250000.00')
  assert.equal((await getCycleSummary(prisma, cycle.id)).targets[0].demand, '25.00')
  assert.equal((await getCycleSummary(prisma, cycle.id)).targets[0].progress?.excess, '5.00')
  const cancelInput = { actorId, key: randomUUID(), id: order.id, expectedVersion: 3, reason: 'Correct duplicate historic record' }
  const cancelled = await cancelOrder(prisma, cancelInput)
  assert.deepEqual(await cancelOrder(prisma, cancelInput), cancelled)
  assert.equal(await prisma.payment.count({ where: { orderId: order.id, reversedAt: null } }), 0)
  assert.equal((await getCycleSummary(prisma, cycle.id)).finances.orderCount, 0)
  assert.equal((await getCycleSummary(prisma, cycle.id)).targets[0].demand, '0.00')
  assert.equal((await getReceivables(prisma, { page: 1, pageSize: 20, cycleId: cycle.id })).totalCount, 0)
  await assert.rejects(() => settleOrder(prisma, { ...input, key: randomUUID(), expectedVersion: 4 }), (error: unknown) => error instanceof ServiceError && error.code === 'ORDER_CANCELLED')
  await restoreOrder(prisma, { actorId, key: randomUUID(), id: order.id, expectedVersion: 4, reason: 'Undo deletion' })
  await assert.rejects(() => addPayment(prisma, { actorId, key: randomUUID(), orderId: order.id, amount: '1', method: 'cash', requireFull: true }), (error: unknown) => error instanceof ServiceError && error.code === 'FULL_PAYMENT_REQUIRED')
  assert.equal((await getReceivables(prisma, { page: 1, pageSize: 20, cycleId: cycle.id })).totalCount, 1)
  const restoredOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
  const attempts = await Promise.allSettled([0, 1].map(() => settleOrder(prisma, { ...input, key: randomUUID(), expectedVersion: restoredOrder.version })))
  assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(await prisma.payment.count({ where: { orderId: order.id, reversedAt: null } }), 1)
  const active = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
  const confirmed = await updateFulfillment(prisma, { actorId, key: randomUUID(), id: order.id, expectedVersion: active.version, status: 'confirmed' })
  await updateFulfillment(prisma, { actorId, key: randomUUID(), id: order.id, expectedVersion: confirmed.body.version as number, status: 'shipped' })
  assert.equal(await prisma.goodsReceipt.count({ where: { cycleId: cycle.id } }), 0)
  assert.equal((await prisma.cycle.findUniqueOrThrow({ where: { id: cycle.id } })).rulesVersion, null)
  assert.equal((await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } })).unitPrice.toFixed(2), '10000.00')
})
test.after(async () => prisma.$disconnect())
