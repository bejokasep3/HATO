import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { assertIsolatedTestDatabase } from '../../scripts/migration/test-db'
import { createCycle, setCyclePrices } from '../../src/lib/services/cycles'
import { createOrder } from '../../src/lib/services/orders'
import { getOrderPayments, settleOrder } from '../../src/lib/services/payments'
import { ServiceError } from '../../src/lib/services/mutation'
import { addCalendarDays, cycleTiming } from '../../src/lib/domain/calendar'

const prisma = new PrismaClient()
const actorId = '30000000-0000-4000-8000-000000000099'
const start = addCalendarDays('2026-09-28', 7 * (200000 + Math.floor(Math.random() * 10000)))
const targets = [{ groupCode: 'AYAM' as const, quantity: '20' }, { groupCode: 'TAHU' as const, quantity: '10' }]

test('weeks open immediately using prior prices and later price edits preserve existing bills', async () => {
  await assertIsolatedTestDatabase(prisma)
  await prisma.product.updateMany({ where: { isActive: true }, data: { targetGroup: 'AYAM', quantityScale: 2 } })
  const product = await prisma.product.findFirstOrThrow({ where: { isActive: true } })
  const previous = await createCycle(prisma, { actorId, key: randomUUID(), periodStart: start, targets })
  await setCyclePrices(prisma, { actorId, key: randomUUID(), id: previous.body.id as string, expectedVersion: 0, items: [{ productId: product.id, consumerPrice: '100', traderPrice: '80' }] })
  const periodStart = addCalendarDays(start, 7)
  const input = { actorId, key: randomUUID(), periodStart, targets, copyPreviousPrices: false }
  const created = await createCycle(prisma, input)
  assert.deepEqual(await createCycle(prisma, input), created)
  const cycleId = created.body.id as string
  assert.equal(created.body.periodState, 'open')
  const prices = await prisma.weeklyPrice.findUniqueOrThrow({ where: { cycleId_productId: { cycleId, productId: product.id } } })
  assert.equal(prices.consumerPrice?.toFixed(2), '100.00')
  assert.equal(prices.traderPrice?.toFixed(2), '80.00')
  const group = await prisma.group.create({ data: { name: 'Automatic price fixture', level: 1 } })
  const members = await Promise.all([0, 1].map((at) => prisma.member.create({ data: { name: 'Automatic price member ' + at, phone: '000', level: 1, groupId: group.id } })))
  const now = new Date(periodStart + 'T05:00:00Z')
  const first = await createOrder(prisma, { actorId, key: randomUUID(), cycleId, memberId: members[0].id, now, items: [{ productId: product.id, priceType: 'consumer', quantity: '2' }] })
  assert.equal(first.body.totalAmount, '200.00')
  assert.equal(first.body.pricingPending, false)
  await settleOrder(prisma, { actorId, key: randomUUID(), orderId: first.body.id as string, expectedVersion: 0 })
  await setCyclePrices(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 1, items: [{ productId: product.id, consumerPrice: '150', traderPrice: '120' }] })
  assert.equal((await getOrderPayments(prisma, first.body.id as string)).summary.paidAmount, '200.00')
  assert.equal((await prisma.orderItem.findFirstOrThrow({ where: { orderId: first.body.id as string } })).unitPrice.toFixed(2), '100.00')
  const second = await createOrder(prisma, { actorId, key: randomUUID(), cycleId, memberId: members[1].id, now, items: [{ productId: product.id, priceType: 'trader', quantity: '1' }] })
  assert.equal(second.body.totalAmount, '120.00')
  assert.equal(cycleTiming({ periodStart, periodState: 'open' }, now).effectiveStatus, 'open')
  const added = await prisma.product.create({ data: { name: 'New price fixture', unit: 'kg', targetGroup: 'AYAM', quantityScale: 2 } })
  const nextStart = addCalendarDays(periodStart, 7)
  const next = await createCycle(prisma, { actorId, key: randomUUID(), periodStart: nextStart, targets })
  assert.equal(next.body.periodState, 'open')
  const nextId = next.body.id as string
  await assert.rejects(() => createOrder(prisma, { actorId, key: randomUUID(), cycleId: nextId, memberId: members[0].id, now: new Date(nextStart + 'T05:00:00Z'), items: [{ productId: added.id, priceType: 'consumer', quantity: '1' }] }), (error: unknown) => error instanceof ServiceError && error.code === 'PRICE_NOT_READY')
  await setCyclePrices(prisma, { actorId, key: randomUUID(), id: nextId, expectedVersion: 0, items: [{ productId: added.id, consumerPrice: '50', traderPrice: '40' }] })
  const newItemOrder = await createOrder(prisma, { actorId, key: randomUUID(), cycleId: nextId, memberId: members[0].id, now: new Date(nextStart + 'T05:00:00Z'), items: [{ productId: added.id, priceType: 'consumer', quantity: '1' }] })
  assert.equal(newItemOrder.body.totalAmount, '50.00')
})
test.after(async () => prisma.$disconnect())
