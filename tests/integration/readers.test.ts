import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { assertIsolatedTestDatabase } from '../../scripts/migration/test-db'
import { addCalendarDays } from '../../src/lib/domain/calendar'
import { getCycleAvailability } from '../../src/lib/services/availability'
import { changeTargets, createCycle, openCycle, setCyclePrices } from '../../src/lib/services/cycles'
import { saveReceiptDraft } from '../../src/lib/services/inventory'
import { ServiceError } from '../../src/lib/services/mutation'
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

test('historical targets remain visible and inventory reads preserve unknown stock', async () => {
  await assertIsolatedTestDatabase(prisma, 'hato_recap')
  const product = await prisma.product.findFirstOrThrow({ where: { targetGroup: 'AYAM', isActive: true } })
  const receiptProduct = await prisma.product.findFirstOrThrow({ where: { targetGroup: 'TAHU', isActive: true } })
  const group = await prisma.group.create({ data: { name: 'Historical reader fixture', level: 1 } })
  const member = await prisma.member.create({ data: { name: 'Historical reader member', phone: '000', level: 1, groupId: group.id } })
  const cycle = await prisma.cycle.create({ data: { label: 'Historical inventory', periodStart: new Date('2020-01-06'), orderDeadline: new Date('2020-01-09'), deliveryDate: new Date('2020-01-10'), status: 'completed' } })
  const order = await prisma.order.create({ data: { cycleId: cycle.id, memberId: member.id, totalAmount: '100000', orderStatus: 'delivered', items: { create: { productId: product.id, quantity: '10', unitPrice: '10000', subtotal: '100000' } } } })
  const cancelledMember = await prisma.member.create({ data: { name: 'Cancelled fixture', phone: '000', level: 1, groupId: group.id } })
  await prisma.order.create({ data: { cycleId: cycle.id, memberId: cancelledMember.id, cancelledAt: new Date(), items: { create: { productId: product.id, quantity: '99', unitPrice: '10000', subtotal: '990000' } } } })
  await changeTargets(prisma, { actorId, key: randomUUID(), id: cycle.id, expectedVersion: 0, reason: 'Historical target verified', targets: [{ groupCode: 'AYAM', quantity: '20' }, { groupCode: 'TAHU', quantity: '20' }] })
  await prisma.goodsReceipt.create({ data: { cycleId: cycle.id, items: { create: { productId: receiptProduct.id, orderedQty: '5', receivedQty: '5', damagedQty: '1', purchasePrice: '1000' } } } })
  const before = await prisma.cycle.findUniqueOrThrow({ where: { id: cycle.id }, include: { orders: { include: { items: true } }, goodsReceipt: { include: { items: true } } } })
  const auditsBefore = await prisma.auditEvent.count()
  const dashboard = await getDashboardSummary(prisma, cycle.id)
  assert.equal(dashboard.targets.find((item) => item.groupCode === 'AYAM')?.target, '20.00')
  assert.equal(dashboard.targets.find((item) => item.groupCode === 'TAHU')?.target, '20.00')
  assert.equal(dashboard.targets.every((item) => item.demand === null && item.progress === null), true)
  const inventory = await getCycleAvailability(prisma, cycle.id)
  assert.equal(inventory.historical, true)
  assert.equal(inventory.items.find((item) => item.productId === product.id)?.allocated, '10.00')
  assert.equal(inventory.items.find((item) => item.productId === product.id)?.shipped, '10.00')
  assert.equal(inventory.items.some((item) => item.productId === receiptProduct.id), true)
  assert.equal(inventory.items.every((item) => item.source === 'unknown' && item.capacity === null && item.physicalRemaining === null && item.availableToOrder === null), true)
  await assert.rejects(() => saveReceiptDraft(prisma, { actorId, key: randomUUID(), cycleId: cycle.id, expectedVersion: 1, items: [] }), (error: unknown) => error instanceof ServiceError && error.code === 'LEGACY_CYCLE_READ_ONLY')
  assert.equal(await prisma.auditEvent.count(), auditsBefore)
  assert.deepEqual(await prisma.cycle.findUniqueOrThrow({ where: { id: cycle.id }, include: { orders: { include: { items: true } }, goodsReceipt: { include: { items: true } } } }), before)
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).totalAmount.toFixed(2), '100000.00')
})
