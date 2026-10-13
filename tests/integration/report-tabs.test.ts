import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { assertIsolatedTestDatabase } from '../../scripts/migration/test-db'
import { getReportTabs } from '../../src/lib/services/report-tabs'
import { getRanking } from '../../src/lib/services/ranking'
import { createCycle, setCyclePrices, openCycle } from '../../src/lib/services/cycles'
import { createOrder } from '../../src/lib/services/orders'
import { addPayment, reversePayment } from '../../src/lib/services/payments'
import { cancelOrder } from '../../src/lib/services/order-mutations'

const prisma = new PrismaClient()
const actorId = '90000000-0000-4000-8000-000000000010'

test('restored report tabs accept operational data, full receivables, installments and unknown legacy balances', async () => {
  await assertIsolatedTestDatabase(prisma, 'hato_recap')
  const products = await prisma.product.findMany({ where: { isActive: true } })
  const productId = products.find((product) => product.targetGroup === 'AYAM')!.id
  const group = await prisma.group.create({ data: { name: 'Report Compatibility Test', level: 2 } })
  const members = await Promise.all(Array.from({ length: 34 }, (_, index) => prisma.member.create({ data: { name: `Report Test ${index}`, phone: `000${index}`, groupId: group.id, level: 2 } })))
  const targets = [{ groupCode: 'AYAM' as const, quantity: '100.00' }, { groupCode: 'TAHU' as const, quantity: '10.00' }]
  const created = await createCycle(prisma, { actorId, key: randomUUID(), periodStart: '2040-01-02', targets, copyPreviousPrices: false })
  const cycleId = created.body.id as string
  await setCyclePrices(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 0, items: products.map((product) => ({ productId: product.id, consumerPrice: '10000.00', traderPrice: '9000.00' })) })
  await openCycle(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 1 })
  const now = new Date('2040-01-02T03:00:00Z')
  const items = [{ productId, priceType: 'consumer' as const, quantity: '1.00' }]
  const ids: string[] = []
  for (const member of members) {
    const order = await createOrder(prisma, { actorId, key: randomUUID(), cycleId, memberId: member.id, items, now })
    ids.push(order.body.id as string)
  }
  const payment = await addPayment(prisma, { actorId, key: randomUUID(), orderId: ids[0], amount: '3000.00', method: 'cash' })
  const reversed = await addPayment(prisma, { actorId, key: randomUUID(), orderId: ids[0], amount: '2000.00', method: 'cash' })
  await reversePayment(prisma, { actorId, key: randomUUID(), paymentId: reversed.body.id as string, reason: 'Correction' })
  assert(payment.body.id)
  await cancelOrder(prisma, { actorId, key: randomUUID(), id: ids[1], expectedVersion: 0, reason: 'Cancelled test' })
  const draft = await createCycle(prisma, { actorId, key: randomUUID(), periodStart: '2040-01-09', targets, copyPreviousPrices: false })
  await createOrder(prisma, { actorId, key: randomUUID(), cycleId: draft.body.id as string, memberId: members[0].id, items, now: new Date('2040-01-09T03:00:00Z') })
  const auditBefore = await prisma.auditEvent.count()
  const mutationBefore = await prisma.mutationRequest.count()
  const [targetsReport, financialReport, commodityReport, memberReport, receivableReport, ranking] = await Promise.all([
    getReportTabs(prisma, 'targets'), getReportTabs(prisma, 'financial'), getReportTabs(prisma, 'commodity'), getReportTabs(prisma, 'member'), getReportTabs(prisma, 'receivable'), getRanking(prisma),
  ])
  assert('cycleReports' in targetsReport && targetsReport.cycleReports)
  const target = targetsReport.cycleReports.find((cycle) => cycle.cycleId === cycleId)!
  assert.equal(target.chicken.target, 100)
  assert.equal(target.chicken.sold, 33)
  assert.equal(target.chicken.goodsIn, null)
  assert.equal(target.chicken.endingStock, null)
  assert('cycles' in financialReport && financialReport.cycles)
  const finances = financialReport.cycles.find((cycle) => cycle.cycleId === cycleId)!
  assert.equal(finances.paidRevenue, 3000)
  assert.equal(finances.unpaidRevenue, 327000)
  assert.equal(finances.totalCost, null)
  assert.equal(finances.grossMargin, null)
  assert('commodities' in commodityReport && commodityReport.commodities)
  assert.equal(commodityReport.commodities.find((product) => product.productId === productId)?.grossProfit, null)
  assert.equal(commodityReport.commodities.find((product) => product.productId === productId)?.totalRevenue, null)
  assert.equal(commodityReport.commodities.find((product) => product.productId === productId)?.totalReceivedQty, null)
  assert('orders' in receivableReport && receivableReport.orders)
  assert.equal(receivableReport.orders.filter((order) => order.cycleId === cycleId).length, 33)
  assert.equal(receivableReport.orders.find((order) => order.orderId === ids[0])?.totalAmount, 7000)
  assert.equal(receivableReport.orders.some((order) => order.orderId === ids[1]), false)
  assert(receivableReport.unknownBalanceCount > 0)
  assert('members' in memberReport && memberReport.members)
  const memberBalance = memberReport.members.find((member) => member.memberId === members[0].id)!
  assert('unpaidAmount' in memberBalance)
  assert.equal(memberBalance.unpaidAmount, null)
  const ranked = ranking.leaderboard.find((member) => member.id === members[0].id)!
  assert.equal(ranked.orderCount, 1)
  assert.equal(ranked.score, 11)
  assert.deepEqual(ranked.badges, ['🌱 Aktif'])
  assert.equal(ranking.leaderboard.find((member) => member.id === members[1].id)?.score, 0)
  assert.equal(await prisma.auditEvent.count(), auditBefore)
  assert.equal(await prisma.mutationRequest.count(), mutationBefore)
})

test.after(async () => prisma.$disconnect())
