const BUSINESS_ZONE = 'Asia/Jakarta'

function asUtcDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('INVALID_DATE')
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) throw new Error('INVALID_DATE')
  return date
}

export function addCalendarDays(date: string, days: number): string {
  const value = asUtcDate(date)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function businessDate(instant: Date): string {
  if (Number.isNaN(instant.valueOf())) throw new Error('INVALID_INSTANT')
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant)
  const part = (type: string) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function cycleDates(periodStart: string) {
  const monday = asUtcDate(periodStart)
  if (monday.getUTCDay() !== 1) throw new Error('CYCLE_MUST_START_MONDAY')
  return {
    periodStart,
    supplierDeadline: addCalendarDays(periodStart, 1),
    deliveryDate: addCalendarDays(periodStart, 3),
    periodEnd: addCalendarDays(periodStart, 6),
    nextPeriodStart: addCalendarDays(periodStart, 7),
  }
}

export function canIncreaseOrder(periodStart: string, periodState: 'draft' | 'open' | 'closed', now: Date): boolean {
  const dates = cycleDates(periodStart)
  const today = businessDate(now)
  return periodState === 'open' && today >= dates.periodStart && today < dates.nextPeriodStart
}

export function needsConfirmedRecap(periodStart: string, hasRecap: boolean, now: Date): boolean {
  return !hasRecap && businessDate(now) > cycleDates(periodStart).supplierDeadline
}
