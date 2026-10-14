import assert from 'node:assert/strict'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { assertIsolatedTestDatabase } from '../../scripts/migration/test-db'
import { getCumulativeStock } from '../../src/lib/services/cumulative-stock'
import { getDashboardSummary } from '../../src/lib/services/operational-summary'

const prisma = new PrismaClient()
test('cumulative stock includes earlier leftovers and excludes cancelled orders and future weeks', async () => {
  await assertIsolatedTestDatabase(prisma, 'hato_stock')
  const ayam = await prisma.product.create({ data: { name: 'Stock chicken fixture', unit: 'kg', targetGroup: 'AYAM', quantityScale: 2 } })
  const snapshot = await prisma.product.create({ data: { name: 'Snapshot fixture', unit: 'kg', targetGroup: 'NONE', quantityScale: 2 } })
  const tahu = await prisma.product.create({ data: { name: 'Stock tofu fixture', unit: 'bungkus', targetGroup: 'TAHU', quantityScale: 0 } })
  const excluded = await prisma.product.create({ data: { name: 'Excluded fixture', unit: 'kg', targetGroup: 'NONE', quantityScale: 2 } })
  const group = await prisma.group.create({ data: { name: 'Stock fixture group', level: 1 } })
  const week = async (start: string, rulesVersion: number | null, chicken: string, tofu: string) => prisma.cycle.create({ data: {
    label: 'Stock fixture ' + start, periodStart: new Date(start), orderDeadline: new Date(start), deliveryDate: new Date(start),
    rulesVersion, status: 'completed', periodState: rulesVersion === 2 ? 'closed' : null,
    targets: { create: [{ groupCode: 'AYAM', quantity: chicken, unit: 'kg' }, { groupCode: 'TAHU', quantity: tofu, unit: 'bungkus' }] },
  } })
  const first = await week('2020-01-06', null, '20', '10')
  const second = await week('2020-01-13', 2, '15', '10')
  const future = await week('2020-02-03', null, '999', '999')
  await prisma.weeklyPrice.createMany({ data: [{ productId: snapshot.id, targetGroupSnapshot: 'AYAM' as const }, { productId: tahu.id, targetGroupSnapshot: 'TAHU' as const }].map((item) => ({ ...item, cycleId: second.id, price: '1', unitSnapshot: 'kg', quantityScaleSnapshot: 2 })) })
  const order = async (cycleId: string, items: Array<{ productId: string; quantity: string }>, cancelled = false) => {
    const member = await prisma.member.create({ data: { name: 'Stock fixture member', phone: '000', level: 1, groupId: group.id } })
    return prisma.order.create({ data: { cycleId, memberId: member.id, cancelledAt: cancelled ? new Date() : null,
      totalAmount: items.reduce((sum, item) => sum + Number(item.quantity), 0).toFixed(2),
      items: { create: items.map((item) => ({ ...item, unitPrice: '1', subtotal: item.quantity })) },
    } })
  }
  await order(first.id, [{ productId: ayam.id, quantity: '10' }, { productId: tahu.id, quantity: '3' }, { productId: excluded.id, quantity: '50' }])
  await order(second.id, [{ productId: snapshot.id, quantity: '7' }, { productId: tahu.id, quantity: '5' }])
  await order(first.id, [{ productId: ayam.id, quantity: '99' }], true)
  await order(future.id, [{ productId: ayam.id, quantity: '900' }])
  const now = new Date('2020-01-19T17:00:00Z')
  const mutationCount = await prisma.mutationRequest.count()
  const auditCount = await prisma.auditEvent.count()
  const stock = await getCumulativeStock(prisma, now)
  assert.equal(stock.asOfDate, '2020-01-20')
  assert.equal(stock.includedWeekCount, 2)
  assert.deepEqual(stock.groups.map((entry) => [entry.groupCode, entry.incomingQuantity, entry.orderedQuantity, entry.remainingQuantity]), [
    ['AYAM', '35.00', '17.00', '18.00'], ['TAHU', '20.00', '8.00', '12.00'],
  ])
  const dashboard = await getDashboardSummary(prisma, null, now)
  assert.equal(dashboard.hasCycle, false)
  assert('cumulativeStock' in dashboard)
  assert.deepEqual(dashboard.cumulativeStock, stock)
  assert.equal(await prisma.mutationRequest.count(), mutationCount)
  assert.equal(await prisma.auditEvent.count(), auditCount)

  await prisma.cycleTarget.delete({ where: { cycleId_groupCode: { cycleId: second.id, groupCode: 'TAHU' } } })
  const incomplete = (await getCumulativeStock(prisma, now)).groups[1]
  assert.equal(incomplete.incomingQuantity, '10.00')
  assert.equal(incomplete.missingWeekCount, 1)
  assert.equal(incomplete.remainingQuantity, null)
  await prisma.cycleTarget.create({ data: { cycleId: second.id, groupCode: 'TAHU', quantity: '10', unit: 'bungkus' } })
  await prisma.cycleTarget.update({ where: { cycleId_groupCode: { cycleId: first.id, groupCode: 'AYAM' } }, data: { quantity: '0' } })
  assert.equal((await getCumulativeStock(prisma, now)).groups[0].remainingQuantity, '-2.00')
  const unmapped = await prisma.product.create({ data: { name: 'Unmapped stock fixture', unit: 'kg' } })
  await order(first.id, [{ productId: unmapped.id, quantity: '1' }])
  assert((await getCumulativeStock(prisma, now)).groups.every((entry) => entry.unmappedItemCount === 1 && entry.remainingQuantity === null))
})
test.after(async () => prisma.$disconnect())
