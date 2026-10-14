import assert from 'node:assert/strict'
import test from 'node:test'
import { canRecordOrder, currentWeekStart, cycleTiming, needsRecapForOrderEntry } from '../../src/lib/domain/calendar'
import { formatDate as webDate } from '../../src/lib/utils'
import { formatDate as mobileDate } from '../../mobile/lib/utils'

test('new week follows Monday midnight WIB across Sunday and year boundary', () => {
  assert.equal(currentWeekStart(new Date('2026-10-11T16:59:59Z')), '2026-10-05')
  assert.equal(currentWeekStart(new Date('2026-10-11T17:00:00Z')), '2026-10-12')
  assert.equal(currentWeekStart(new Date('2026-10-13T08:00:00Z')), '2026-10-12')
  assert.equal(currentWeekStart(new Date('2027-01-01T00:00:00Z')), '2026-12-28')
})

test('cycle status changes exactly at Monday midnight WIB without changing stored workflow', () => {
  const cycle = { periodStart: '2026-10-12', periodEnd: '2026-10-18', periodState: 'open' }
  assert.equal(cycleTiming(cycle, new Date('2026-10-11T16:59:59Z')).effectiveStatus, 'upcoming')
  assert.equal(cycleTiming(cycle, new Date('2026-10-11T17:00:00Z')).effectiveStatus, 'open')
  assert.equal(cycleTiming(cycle, new Date('2026-10-18T16:59:59Z')).acceptsNewOrders, true)
  const ended = cycleTiming(cycle, new Date('2026-10-18T17:00:00Z'))
  assert.equal(ended.effectiveStatus, 'ended')
  assert.equal(ended.acceptsNewOrders, false)
  assert.equal(ended.allowsManagerEntry, true)
  assert.equal(ended.endsAt, '2026-10-18T17:00:00.000Z')
  assert.equal(cycle.periodState, 'open')
})

test('manager entry supports ended weeks but respects manual closure and future weeks', () => {
  const now = new Date('2026-10-13T08:00:00Z')
  assert.equal(canRecordOrder('2026-10-05', 'draft', now), true)
  assert.equal(canRecordOrder('2026-10-05', 'open', now), true)
  assert.equal(canRecordOrder('2026-10-05', 'closed', now), false)
  assert.equal(canRecordOrder('2026-10-19', 'open', now), false)
  assert.equal(needsRecapForOrderEntry('2026-10-05', false, now), false)
  assert.equal(needsRecapForOrderEntry('2026-10-12', false, new Date('2026-10-14T08:00:00Z')), true)
})

test('drafts, manual closure, legacy weeks and year changes have automatic calendar status', () => {
  const week = { periodStart: '2026-12-28', periodState: 'draft' }
  const now = new Date('2027-01-01T12:00:00Z')
  assert.equal(cycleTiming(week, now).effectiveStatus, 'open')
  assert.equal(cycleTiming(week, now).acceptsNewOrders, true)
  assert.equal(cycleTiming({ ...week, periodState: 'closed' }, now).effectiveStatus, 'closed')
  assert.equal(cycleTiming({ ...week, periodState: 'closed' }, now).acceptsNewOrders, false)
  assert.equal(cycleTiming(week, new Date('2027-01-03T17:00:00Z')).effectiveStatus, 'ended')
  assert.equal(cycleTiming({ periodStart: '2026-12-28', status: 'open' }, now).effectiveStatus, 'open')
})

test('web and mobile show calendar dates in WIB even on a device in another timezone', () => {
  const previous = process.env.TZ
  process.env.TZ = 'America/New_York'
  try {
    for (const format of [webDate, mobileDate]) {
      assert.equal(format('2026-10-19'), '19 Okt 2026')
      assert.match(format('2026-10-19', { weekday: 'long' }), /Senin/)
      assert.equal(format('2026-10-18T17:00:00Z'), '19 Okt 2026')
    }
  } finally {
    if (previous === undefined) delete process.env.TZ
    else process.env.TZ = previous
  }
})
