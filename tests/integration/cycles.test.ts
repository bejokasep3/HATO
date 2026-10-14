import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { addCalendarDays } from '../../src/lib/domain/calendar'
import { changeTargets, closeCycle, createCycle, openCycle, setCyclePrices } from '../../src/lib/services/cycles'
import { ServiceError } from '../../src/lib/services/mutation'
import { assertIsolatedTestDatabase } from '../../scripts/migration/test-db'
import { getCycleSummary } from '../../src/lib/services/operational-summary'

const prisma = new PrismaClient()
const actorId = '00000000-0000-4000-8000-000000000099'
const start = addCalendarDays('2026-09-28', 7 * (200 + Math.floor(Math.random() * 100000)))
const targets = [{ groupCode: 'AYAM' as const, quantity: '10.00' }, { groupCode: 'TAHU' as const, quantity: '10.00' }]

test('cycle create, replay, open, target change and close leave legacy records intact', async () => {
  await assertIsolatedTestDatabase(prisma)
  await prisma.product.update({
    where: { id: '00000000-0000-4000-8000-000000000003' },
    data: { targetGroup: 'AYAM', quantityScale: 2 },
  })
  const oldOrder = await prisma.order.findUniqueOrThrow({ where: { id: '00000000-0000-4000-8000-000000000006' } })

  const key = randomUUID()
  const first = await createCycle(prisma, { actorId, key, periodStart: start, targets })
  assert.equal(first.status, 201)
  const cycleId = first.body.id as string
  const replay = await createCycle(prisma, { actorId, key, periodStart: start, targets })
  assert.deepEqual(replay, first)
  await assert.rejects(
    () => createCycle(prisma, { actorId, key, periodStart: start, targets: [{ groupCode: 'AYAM', quantity: '12.00' }, targets[1]] }),
    (error: unknown) => error instanceof ServiceError && error.code === 'IDEMPOTENCY_CONFLICT',
  )
  await assert.rejects(
    () => createCycle(prisma, { actorId, key: randomUUID(), periodStart: start, targets }),
    (error: unknown) => error instanceof ServiceError && error.code === 'WEEK_ALREADY_EXISTS',
  )

  const draft = await prisma.cycle.findUniqueOrThrow({ where: { id: cycleId }, include: { targets: true, weeklyPrices: true, rotationSchedules: true } })
  assert.equal(draft.periodState, 'draft')
  assert.equal(draft.targets.length, 2)
  assert.equal(draft.weeklyPrices.length, 1)
  assert.equal(draft.weeklyPrices[0].targetGroupSnapshot, 'AYAM')
  assert.equal(draft.rotationSchedules.length, 1)
  await prisma.weeklyPrice.updateMany({ where: { cycleId }, data: { price: 0, consumerPrice: 0, traderPrice: 0 } })
  await assert.rejects(
    () => openCycle(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 0 }),
    (error: unknown) => error instanceof ServiceError && error.code === 'PRICES_NOT_READY',
  )
  const priced = await setCyclePrices(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 0, items: [{ productId: draft.weeklyPrices[0].productId, consumerPrice: '50000.00', traderPrice: '50000.00' }] })
  assert.equal(priced.body.version, 1)
  const opened = await openCycle(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 1 })
  assert.equal(opened.body.periodState, 'open')
  assert.equal(opened.body.version, 2)
  await assert.rejects(
    () => setCyclePrices(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 2, items: [{ productId: draft.weeklyPrices[0].productId, consumerPrice: '60000.00', traderPrice: '60000.00' }] }),
    (error: unknown) => error instanceof ServiceError && error.code === 'PRICES_LOCKED',
  )

  const changed = await changeTargets(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 2, reason: 'Target uji', targets: [{ groupCode: 'AYAM', quantity: '0.00' }, targets[1]] })
  assert.equal(changed.body.version, 3)
  assert((changed.body.targets as { groupCode: string; quantity: string }[]).some((item) => item.groupCode === 'AYAM' && item.quantity === '0.00'))
  await assert.rejects(
    () => closeCycle(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 2 }),
    (error: unknown) => error instanceof ServiceError && error.code === 'STALE_VERSION',
  )
  const closed = await closeCycle(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 3 })
  assert.equal(closed.body.periodState, 'closed')
  assert.equal(closed.body.version, 4)
  const unchanged = await prisma.order.findUniqueOrThrow({ where: { id: oldOrder.id } })
  assert.equal(unchanged.paymentStatus, oldOrder.paymentStatus)
  assert.equal(unchanged.orderStatus, oldOrder.orderStatus)
})

test('different keys racing for the same week create at most one cycle', async () => {
  await assertIsolatedTestDatabase(prisma)
  const periodStart = addCalendarDays(start, 7)
  const results = await Promise.allSettled([
    createCycle(prisma, { actorId, key: randomUUID(), periodStart, targets }),
    createCycle(prisma, { actorId, key: randomUUID(), periodStart, targets }),
  ])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1)
  assert.equal(await prisma.cycle.count({ where: { weekKey: new Date(`${periodStart}T00:00:00.000Z`) } }), 1)
})

test('legacy target corrections preserve historical prices, orders and unknown balances', async () => {
  await assertIsolatedTestDatabase(prisma)
  const cycle = await prisma.cycle.findFirstOrThrow({ where: { rulesVersion: null }, include: { weeklyPrices: true, orders: { include: { items: true, payments: true } } } })
  const input = { actorId, key: randomUUID(), id: cycle.id, expectedVersion: cycle.version, reason: 'Verified target from historical notes', targets: [{ groupCode: 'AYAM' as const, quantity: '12.50' }, { groupCode: 'TAHU' as const, quantity: '18.00' }] }
  const corrected = await changeTargets(prisma, input)
  assert.deepEqual(await changeTargets(prisma, input), corrected)
  const after = await prisma.cycle.findUniqueOrThrow({ where: { id: cycle.id }, include: { weeklyPrices: true, orders: { include: { items: true, payments: true } } } })
  assert.equal(after.rulesVersion, null)
  assert.equal(after.status, cycle.status)
  assert.equal(after.periodStart.toISOString(), cycle.periodStart.toISOString())
  assert.deepEqual(after.weeklyPrices, cycle.weeklyPrices)
  assert.deepEqual(after.orders, cycle.orders)
  const summary = await getCycleSummary(prisma, cycle.id)
  assert.equal(summary.targets.find((target) => target.groupCode === 'AYAM')?.target, '12.50')
  assert.equal(summary.targets.find((target) => target.groupCode === 'AYAM')?.demand, null)
  await assert.rejects(() => changeTargets(prisma, { ...input, key: randomUUID() }), (error: unknown) => error instanceof ServiceError && error.code === 'STALE_VERSION')
  await assert.rejects(() => openCycle(prisma, { actorId, key: randomUUID(), id: cycle.id, expectedVersion: after.version }), (error: unknown) => error instanceof ServiceError && error.code === 'LEGACY_CYCLE_READ_ONLY')
})

test.after(async () => prisma.$disconnect())
