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

export function currentWeekStart(instant: Date): string {
  const today = businessDate(instant)
  const day = asUtcDate(today).getUTCDay()
  return addCalendarDays(today, day === 0 ? -6 : 1 - day)
}

export type CycleCalendarInput = { periodStart: string; periodEnd?: string | null; periodState?: string | null; status?: string }
export type EffectiveCycleStatus = 'upcoming' | 'awaiting_prices' | 'open' | 'closed' | 'ended' | 'legacy'

export function cycleTiming(cycle: CycleCalendarInput, now: Date) {
  const start = cycle.periodStart.slice(0, 10)
  const end = cycle.periodEnd?.slice(0, 10) ?? addCalendarDays(start, 6)
  asUtcDate(start)
  asUtcDate(end)
  const today = businessDate(now)
  const calendarStatus = today < start ? 'upcoming' : today > end ? 'ended' : 'current'
  const state = cycle.periodState ?? (cycle.status === 'open' ? 'open' : cycle.status === 'draft' ? 'draft' : ['closed', 'delivered', 'completed'].includes(cycle.status ?? '') ? 'closed' : null)
  const effectiveStatus: EffectiveCycleStatus = calendarStatus === 'upcoming' ? 'upcoming'
    : calendarStatus === 'ended' ? 'ended'
      : state === 'closed' ? 'closed' : state === 'draft' ? 'awaiting_prices' : state === 'open' ? 'open' : 'legacy'
  return {
    calendarStatus, effectiveStatus,
    acceptsNewOrders: calendarStatus === 'current' && (state === 'draft' || state === 'open'),
    allowsManagerEntry: calendarStatus !== 'upcoming' && (state === 'draft' || state === 'open'),
    startsAt: new Date(`${start}T00:00:00+07:00`).toISOString(),
    endsAt: new Date(`${addCalendarDays(end, 1)}T00:00:00+07:00`).toISOString(),
    evaluatedAt: now.toISOString(),
  }
}

export function cycleStatusLabel(status: EffectiveCycleStatus): string {
  return { upcoming: 'Akan datang', awaiting_prices: 'Minggu ini · Harga menyusul', open: 'Minggu ini · Dibuka', closed: 'Ditutup', ended: 'Berakhir', legacy: 'Perlu verifikasi' }[status]
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

export function canRecordOrder(periodStart: string, periodState: string | null, now: Date): boolean {
  cycleDates(periodStart)
  return cycleTiming({ periodStart, periodState }, now).allowsManagerEntry
}

export function needsRecapForOrderEntry(periodStart: string, hasRecap: boolean, now: Date): boolean {
  return cycleTiming({ periodStart }, now).calendarStatus !== 'ended' && needsConfirmedRecap(periodStart, hasRecap, now)
}
