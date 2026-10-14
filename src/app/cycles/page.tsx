'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight, CalendarDays, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPost, newIdempotencyKey } from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useOperationalMode } from '@/components/AppShell'
import { StartWeekButton } from '@/components/StartWeekButton'
import { currentWeekStart, cycleTiming, cycleStatusLabel } from '@/lib/domain/calendar'
import { useBusinessTime } from '../../../shared/use-business-time'

type CycleItem = {
  evaluatedAt?: string
  id: string
  label: string
  periodStart: string
  periodEnd: string | null
  supplierDeadline: string | null
  deliveryDate: string
  periodState: 'draft' | 'open' | 'closed' | null
  status: string
  notes?: string | null
  totalOrders: number
  totalRotation: number
  orderValue: string
  receivedPayments: string
  knownOutstanding: string
  unknownBalanceCount: number
  version: number
  targets: Array<{ groupCode: 'AYAM' | 'TAHU'; quantity: string; unit: string }>
}

function nextMonday() {
  return currentWeekStart(new Date())
}

export default function CyclesPage() {
  const router = useRouter()
  const { operationalSchema } = useOperationalMode()
  const canMutate = operationalSchema === true
  const [cycles, setCycles] = useState<CycleItem[]>([])
  const now = useBusinessTime(cycles[0]?.evaluatedAt)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [periodStart, setPeriodStart] = useState(nextMonday)
  const [ayamTarget, setAyamTarget] = useState('10')
  const [tahuTarget, setTahuTarget] = useState('10')
  const [notes, setNotes] = useState('')
  const pendingAttempt = useRef<{ signature: string; key: string } | null>(null)

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try { setCycles(await apiGet<CycleItem[]>('/api/cycles')) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Daftar siklus gagal dimuat.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const task = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(task)
  }, [load])

  async function create(event: FormEvent) {
    event.preventDefault()
    if (!canMutate) return
    setSubmitting(true)
    try {
      const body = {
        periodStart,
        copyPreviousPrices: false,
        targets: [
          { groupCode: 'AYAM', quantity: Number(ayamTarget).toFixed(2) },
          { groupCode: 'TAHU', quantity: Number(tahuTarget).toFixed(2) },
        ],
        notes: notes.trim() || null,
      }
      const signature = JSON.stringify(body)
      if (pendingAttempt.current?.signature !== signature) pendingAttempt.current = { signature, key: newIdempotencyKey() }
      const cycle = await apiPost<CycleItem>('/api/cycles', body, { idempotencyKey: pendingAttempt.current.key })
      pendingAttempt.current = null
      toast.success('Minggu dibuat. Pesanan dapat dicatat, harga menyusul.')
      setOpen(false)
      router.push(`/cycles/${cycle.id}?cycleId=${cycle.id}`)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Siklus gagal dibuat.')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold text-emerald-800">Periode kerja</p><h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Siklus mingguan</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Setiap siklus berjalan Senin–Minggu, direkap Selasa, dan menerima barang Kamis.</p></div>
        <div className="flex flex-wrap gap-2"><StartWeekButton /><Button onClick={() => setOpen(true)} disabled={!canMutate} icon={<Plus className="h-4 w-4" />}>Jadwalkan minggu lain</Button></div>
      </header>

      {error ? <div className="flex items-center justify-between gap-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-900" role="alert"><span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}</span><Button size="sm" variant="ghost" onClick={() => void load()} icon={<RefreshCw className="h-4 w-4" />}>Coba lagi</Button></div> : null}

      {loading ? <div className="grid gap-4 md:grid-cols-2" aria-busy="true">{[0, 1, 2, 3].map((item) => <div key={item} className="h-52 animate-pulse rounded-xl bg-slate-200/60" />)}</div> : null}

      {!loading && cycles.length === 0 ? (
        <section className="mx-auto max-w-xl border-y border-slate-200 py-12 text-center"><CalendarDays className="mx-auto h-8 w-8 text-emerald-800" /><h2 className="mt-4 text-xl font-black text-slate-950">Belum ada siklus</h2><p className="mt-2 text-sm text-slate-600">Buat minggu kerja pertama dan tetapkan target pembelian minimumnya.</p><Button className="mt-5" onClick={() => setOpen(true)} disabled={!canMutate} icon={<Plus className="h-4 w-4" />}>Buat siklus pertama</Button></section>
      ) : null}

      {!loading && cycles.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {cycles.map((cycle) => {
            const timing = cycleTiming(cycle, now)
            const ayam = cycle.targets.find((target) => target.groupCode === 'AYAM')
            const tahu = cycle.targets.find((target) => target.groupCode === 'TAHU')
            return (
              <article key={cycle.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h2 className="text-lg font-extrabold text-slate-950">{cycle.label}</h2><p className="mt-1 text-xs text-slate-500">{formatDate(cycle.periodStart)}–{formatDate(cycle.periodEnd ?? cycle.deliveryDate)}</p></div>
                    <Badge variant={timing.calendarStatus === 'current' ? 'emerald' : 'slate'} dot>{cycleStatusLabel(timing.effectiveStatus)}</Badge>
                  </div>
                  <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 border-y border-slate-200 py-4 text-sm">
                    <div><dt className="text-xs font-semibold text-slate-500">Target ayam</dt><dd className="mt-1 font-extrabold tabular-nums text-slate-900">{ayam ? `${Number(ayam.quantity).toLocaleString('id-ID')} ${ayam.unit}` : 'Belum diketahui'}</dd></div>
                    <div><dt className="text-xs font-semibold text-slate-500">Target tahu</dt><dd className="mt-1 font-extrabold tabular-nums text-slate-900">{tahu ? `${Number(tahu.quantity).toLocaleString('id-ID')} ${tahu.unit}` : 'Belum diketahui'}</dd></div>
                    <div><dt className="text-xs font-semibold text-slate-500">Pesanan aktif</dt><dd className="mt-1 font-extrabold tabular-nums text-slate-900">{cycle.totalOrders}</dd></div>
                    <div><dt className="text-xs font-semibold text-slate-500">Nilai pesanan</dt><dd className="mt-1 font-extrabold tabular-nums text-slate-900">{formatCurrency(cycle.orderValue)}</dd></div>
                  </dl>
                  <p className="mt-3 text-xs text-slate-600">Rekap {cycle.supplierDeadline ? formatDate(cycle.supplierDeadline, { weekday: 'long', day: 'numeric', month: 'short' }) : 'belum diketahui'} · barang tiba {formatDate(cycle.deliveryDate, { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                  {cycle.unknownBalanceCount > 0 ? <p className="mt-2 text-xs font-semibold text-amber-800">{cycle.unknownBalanceCount} {'saldo lama belum diverifikasi'}</p> : null}
                </div>
                <Link href={`/cycles/${cycle.id}?cycleId=${cycle.id}`} className="mt-5 inline-flex items-center justify-end gap-1 text-sm font-bold text-emerald-800 hover:text-emerald-950">Buka minggu <ArrowRight className="h-4 w-4" /></Link>
              </article>
            )
          })}
        </div>
      ) : null}

      <Modal isOpen={open} onClose={() => !submitting && setOpen(false)} title="Buat siklus mingguan" description="Tanggal rekap Selasa, barang tiba Kamis, dan akhir periode Minggu dihitung otomatis dari tanggal Senin." icon={<CalendarDays className="h-4 w-4" />}>
        <form onSubmit={create} className="space-y-5">
          <div><label htmlFor="period-start" className="mb-1.5 block text-sm font-bold text-slate-800">Senin pertama</label><input id="period-start" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} required className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-emerald-700" /><p className="mt-1 text-xs text-slate-500">Harus jatuh pada hari Senin.</p></div>
          <fieldset><legend className="text-sm font-bold text-slate-800">Target minimum minggu ini</legend><p className="mt-1 text-xs text-slate-500">Pesanan boleh melebihi angka ini. Pembelian supplier tetap minimal sejumlah target.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Ayam <span className="font-normal text-slate-500">(kg)</span><input inputMode="decimal" value={ayamTarget} onChange={(event) => setAyamTarget(event.target.value.replace(',', '.'))} pattern="\d+(\.\d{1,2})?" required className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm tabular-nums focus:border-emerald-700" /></label><label className="text-sm font-semibold text-slate-700">Tahu <span className="font-normal text-slate-500">(bungkus)</span><input inputMode="numeric" value={tahuTarget} onChange={(event) => setTahuTarget(event.target.value)} pattern="\d+" required className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm tabular-nums focus:border-emerald-700" /></label></div></fieldset>
          <div><label htmlFor="cycle-notes" className="mb-1.5 block text-sm font-bold text-slate-800">Catatan <span className="font-normal text-slate-500">(opsional)</span></label><textarea id="cycle-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-700" placeholder="Contoh: jadwal supplier berubah minggu ini" /></div>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>Batal</Button><Button type="submit" disabled={submitting || !canMutate}>{submitting ? 'Menyimpan…' : 'Buat sebagai draf'}</Button></div>
        </form>
      </Modal>
    </div>
  )
}
