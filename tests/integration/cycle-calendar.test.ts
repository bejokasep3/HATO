import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { assertIsolatedTestDatabase } from '../../scripts/migration/test-db'
import { createCycle } from '../../src/lib/services/cycles'
import { getCycleSummary, getDashboardSummary } from '../../src/lib/services/operational-summary'
import { getLegacyDashboardSummary } from '../../src/lib/services/legacy-dashboard'

const prisma = new PrismaClient()
const actorId = '40000000-0000-4000-8000-000000000099'

test('dashboard tracks the current week, shows gaps, and preserves explicit history without writes', async () => {
  await assertIsolatedTestDatabase(prisma, 'hato_calendar')
  await prisma.product.updateMany({ where: { isActive: true }, data: { targetGroup: 'AYAM', quantityScale: 2 } })
  const ids: string[] = []
  for (const periodStart of ['2049-12-27', '2050-01-03', '2050-01-17']) {
    const result = await createCycle(prisma, { actorId, key: randomUUID(), periodStart, targets: [{ groupCode: 'AYAM', quantity: '20.00' }, { groupCode: 'TAHU', quantity: '10.00' }] })
    ids.push(result.body.id as string)
  }
  const before = await prisma.cycle.findMany({ orderBy: { id: 'asc' } })
  const audits = await prisma.auditEvent.count()
  const sunday = await getDashboardSummary(prisma, undefined, new Date('2050-01-02T16:59:59Z'))
  assert.equal(sunday.currentCycle?.id, ids[0])
  const monday = await getDashboardSummary(prisma, undefined, new Date('2050-01-02T17:00:00Z'))
  assert.equal(monday.currentCycle?.id, ids[1])
  assert.equal(monday.currentCycle?.effectiveStatus, 'awaiting_prices')
  const gap = await getDashboardSummary(prisma, undefined, new Date('2050-01-09T17:00:00Z'))
  assert.equal(gap.hasCycle, false)
  assert.equal(gap.currentCycle, null)
  assert.equal(gap.allCycles.find((cycle) => cycle.id === ids[1])?.effectiveStatus, 'ended')
  assert.equal(gap.allCycles.find((cycle) => cycle.id === ids[2])?.effectiveStatus, 'upcoming')
  const history = await getDashboardSummary(prisma, ids[1], new Date('2050-01-10T05:00:00Z'))
  assert.equal(history.currentCycle?.id, ids[1])
  assert.equal(history.currentCycle?.acceptsNewOrders, false)
  const summary = await getCycleSummary(prisma, ids[1], new Date('2050-01-10T05:00:00Z'))
  assert.equal(summary.cycle.effectiveStatus, 'ended')
  const legacyGap = await getLegacyDashboardSummary(prisma, undefined, new Date('2050-01-10T05:00:00Z'))
  assert.equal(legacyGap.hasCycle, false)
  const legacyFriday = await getLegacyDashboardSummary(prisma, undefined, new Date('2026-09-25T05:00:00Z'))
  assert.equal(legacyFriday.currentCycle?.periodStart, '2026-09-21')
  assert.equal(legacyFriday.currentCycle?.calendarStatus, 'current')
  assert.deepEqual(await prisma.cycle.findMany({ orderBy: { id: 'asc' } }), before)
  assert.equal(await prisma.auditEvent.count(), audits)
})

test.after(async () => prisma.$disconnect())
