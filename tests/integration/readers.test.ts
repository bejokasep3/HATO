import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { assertIsolatedTestDatabase } from '../../scripts/migration/test-db'
import { addCalendarDays } from '../../src/lib/domain/calendar'
import { getCycleAvailability } from '../../src/lib/services/availability'
import { createCycle, openCycle, setCyclePrices } from '../../src/lib/services/cycles'
import { getDashboardSummary, getCycleSummary } from '../../src/lib/services/operational-summary'
import { createOrder } from '../../src/lib/services/orders'
import { addPayment } from '../../src/lib/services/payments'
import { getReports } from '../../src/lib/services/reports'

const prisma = new PrismaClient()
const actorId = '90000000-0000-4000-8000-000000000010'
const periodStart = addCalendarDays('2026-09-28', 7 * (40000 + Math.floor(Math.random() * 10000)))
const monday = new Date(`${periodStart}T05:00:00.000Z`)

test('operational readers use target snapshots and the payment ledger without writing', async () => {
  await assertIsolatedTestDatabase(prisma, 'hato_recap')
  const products = await prisma.product.findMany({ where: { isActive: true } })
  const ayam = products.find((product) => product.targetGroup === 'AYAM')!
  const tahu = products.find((product) => product.targetGroup === 'TAHU')!
  assert(ayam && tahu)
  const group = await prisma.group.create({ data: { name: `Kelompok Reader ${randomUUID()}`, level: 1 } })
  const member = await prisma.member.create({ data: { name: 'Anggota Reader', phone: randomUUID(), level: 1, groupId: group.id } })
  const created = await createCycle(prisma, {
    actorId, key: randomUUID(), periodStart,
    targets: [{ groupCode: 'AYAM', quantity: '10.00' }, { groupCode: 'TAHU', quantity: '10.00' }],
  })
  const cycleId = created.body.id as string
  await setCyclePrices(prisma, {
    actorId, key: randomUUID(), id: cycleId, expectedVersion: 0,
    items: products.map((product) => ({ productId: product.id, consumerPrice: '10000.00', traderPrice: '9000.00' })),
  })
  await openCycle(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 1 })
  const order = await createOrder(prisma, {
    actorId, key: randomUUID(), cycleId, memberId: member.id, now: monday,
    items: [
      { productId: ayam.id, priceType: 'consumer', quantity: '5.00' },
      { productId: tahu.id, priceType: 'consumer', quantity: '2.00' },
    ],
  })
  await addPayment(prisma, {
    actorId, key: randomUUID(), orderId: order.body.id as string,
    amount: '30000.00', method: 'cash', note: 'Cicilan reader',
  })

  const mutationsBefore = await prisma.mutationRequest.count()
  const auditsBefore = await prisma.auditEvent.count()
  const [summary, dashboard, availability, targetReportResult, financialReportResult] = await Promise.all([
    getCycleSummary(prisma, cycleId),
    getDashboardSummary(prisma, cycleId),
    getCycleAvailability(prisma, cycleId),
    getReports(prisma, 'targets'),
    getReports(prisma, 'financial'),
  ])
  const targetReport = targetReportResult as { cycleReports: Array<{ id: string; targets: Array<{ status: string }> }> }
  const financialReport = financialReportResult as { cycleReports: Array<{ id: string; receivedPayments: string }> }
  assert.equal(summary.targets.find((target) => target.groupCode === 'AYAM')?.target, '10.00')
  assert.equal(summary.targets.find((target) => target.groupCode === 'AYAM')?.demand, '5.00')
  assert.equal(summary.targets.find((target) => target.groupCode === 'TAHU')?.demand, '2.00')
  assert.deepEqual(summary.finances, {
    orderCount: 1,
    orderValue: '70000.00',
    receivedPayments: '30000.00',
    knownOutstanding: '40000.00',
    unknownBalanceCount: 0,
    totalIncomplete: false,
    purchaseValue: null,
  })
  assert.equal(dashboard.finances?.knownOutstanding, '40000.00')
  assert.equal(availability.items.every((item) => item.source === 'unknown'), true)
  assert.equal(availability.items.every((item) => item.availableToOrder === null), true)
  assert.equal(targetReport.cycleReports.find((cycle) => cycle.id === cycleId)?.targets[0]?.status, 'known')
  const financialCycle = financialReport.cycleReports.find((cycle) => cycle.id === cycleId)
  assert.equal(financialCycle?.receivedPayments, '30000.00')
  assert.equal(await prisma.mutationRequest.count(), mutationsBefore)
  assert.equal(await prisma.auditEvent.count(), auditsBefore)
})

test.after(async () => prisma.$disconnect())
