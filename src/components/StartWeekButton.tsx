'use client'

import { FormEvent, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPost, newIdempotencyKey } from '@/lib/api-client'
import { currentWeekStart } from '@/lib/domain/calendar'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useOperationalMode } from '@/components/AppShell'

type Week = { id: string; periodStart: string; periodState?: string | null }

export function StartWeekButton() {
  const router = useRouter()
  const { operationalSchema } = useOperationalMode()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [periodStart, setPeriodStart] = useState('')
  const [ayam, setAyam] = useState('')
  const [tahu, setTahu] = useState('')
  const [error, setError] = useState('')
  const attempt = useRef<{ signature: string; key: string } | null>(null)

  async function findWeek(start: string) {
    const weeks = await apiGet<Week[]>('/api/cycles')
    return weeks.find((week) => week.periodStart.slice(0, 10) === start)
  }

  function showWeek(week: Week) {
    router.push(`/orders?cycleId=${week.id}${['draft', 'open'].includes(week.periodState ?? '') ? '&new=1' : ''}`)
    router.refresh()
  }

  async function start() {
    setBusy(true)
    try {
      const monday = currentWeekStart(new Date())
      const existing = await findWeek(monday)
      if (existing) { showWeek(existing); return }
      setPeriodStart(monday)
      setError('')
      setOpen(true)
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Minggu kerja gagal diperiksa. Coba lagi.') }
    finally { setBusy(false) }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const body = {
      periodStart,
      targets: [{ groupCode: 'AYAM', quantity: Number(ayam).toFixed(2) }, { groupCode: 'TAHU', quantity: Number(tahu).toFixed(2) }],
    }
    const signature = JSON.stringify(body)
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: newIdempotencyKey() }
    try {
      const existing = await findWeek(periodStart)
      const week = existing ?? await apiPost<Week>('/api/cycles', body, { idempotencyKey: attempt.current.key })
      attempt.current = null
      setOpen(false)
      showWeek(week)
    } catch (cause) {
      const existing = await findWeek(periodStart).catch(() => undefined)
      if (existing) { setOpen(false); showWeek(existing) }
      else setError(cause instanceof Error ? cause.message : 'Minggu kerja gagal disimpan. Coba lagi.')
    } finally { setBusy(false) }
  }

  return <>
    <Button variant="secondary" disabled={operationalSchema !== true || busy} onClick={() => void start()} icon={<CalendarDays className="h-4 w-4" />}>{busy ? 'Memeriksa…' : 'Mulai minggu ini'}</Button>
    <Modal isOpen={open} onClose={() => !busy && setOpen(false)} title="Mulai minggu ini" description={`Mulai Senin, ${periodStart ? formatDate(periodStart) : ''}. Isi target, lalu catat pesanan. Harga terakhir otomatis digunakan dan dapat diubah di pengaturan minggu.`} icon={<CalendarDays className="h-4 w-4" />}>
      <form onSubmit={save} className="space-y-5">
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-bold text-slate-900">Target minimum pembelian</legend>
          <label className="text-sm font-semibold text-slate-800">Ayam (kg)<input required inputMode="decimal" pattern="\d+(\.\d{1,2})?" value={ayam} onChange={(event) => setAyam(event.target.value.replace(',', '.'))} className="mt-2 min-h-11 w-full rounded-lg border border-slate-500 px-3 text-slate-950" /></label>
          <label className="text-sm font-semibold text-slate-800">Tahu (bungkus)<input required inputMode="numeric" pattern="\d+" value={tahu} onChange={(event) => setTahu(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-slate-500 px-3 text-slate-950" /></label>
        </fieldset>
        <p className="text-sm text-slate-600">Jumlah pesanan langsung tercatat. Harga terakhir otomatis digunakan. Tagihan langsung dihitung saat pesanan disimpan.</p>
        {error ? <p role="alert" className="text-sm text-rose-800">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4"><Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Batal</Button><Button type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Mulai & input pesanan'}</Button></div>
      </form>
    </Modal>
  </>
}
