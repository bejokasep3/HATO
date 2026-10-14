'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle, ArrowLeft, LockKeyhole, Pencil, RefreshCw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPatch, apiPost, apiPut, newIdempotencyKey } from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useOperationalMode } from '@/components/AppShell'
import { cycleTiming, cycleStatusLabel } from '@/lib/domain/calendar'
import { useBusinessTime } from '../../../../shared/use-business-time'

type Operational = {
  cycle: {
    evaluatedAt?: string
    id: string; label: string; periodStart: string; periodEnd: string | null; supplierDeadline: string | null
    deliveryDate: string; periodState: 'draft' | 'open' | 'closed' | null; version: number; rulesVersion: number
    notes?: string | null; recapConfirmedAt: string | null; receiptStatus: string
  }
  targets: Array<{ groupCode: 'AYAM' | 'TAHU'; unit: string; target: string | null; demand: string | null; status: string; progress: null | { percentage: number | null; shortfall: string; excess: string; plannedPurchase: string } }>
  rotation: { scheduledCount: number; orderedCount: number; pendingMembers: Array<{ id: string; name: string; groupName: string }> }
  finances: { orderCount: number; orderValue: string; receivedPayments: string; knownOutstanding: string; unknownBalanceCount: number; totalIncomplete: boolean; purchaseValue: string | null }
}

type DetailResponse = { operational: Operational }
type PriceRow = { id: string; productId: string; consumerPrice: number; traderPrice: number; product: { name: string; unit: string; isActive: boolean } }
function mutationKey(ref: React.MutableRefObject<{ signature: string; key: string } | null>, signature: string) {
  if (ref.current?.signature === signature) return ref.current.key
  const value = { signature, key: newIdempotencyKey() }
  ref.current = value
  return value.key
}

export default function CycleDetailPage() {
  const { operationalSchema } = useOperationalMode()
  const canMutate = operationalSchema === true
  const params = useParams<{ id: string }>()
  const cycleId = params.id
  const [detail, setDetail] = useState<Operational | null>(null)
  const now = useBusinessTime(detail?.cycle.evaluatedAt)
  const [prices, setPrices] = useState<PriceRow[]>([])
  const [priceInputs, setPriceInputs] = useState<Record<string, { consumer: string; trader: string }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')
  const [targetModal, setTargetModal] = useState(false)
  const [closeModal, setCloseModal] = useState(false)
  const [ayamTarget, setAyamTarget] = useState('10')
  const [tahuTarget, setTahuTarget] = useState('10')
  const [targetReason, setTargetReason] = useState('Penyesuaian target minggu ini')
  const keyRef = useRef<{ signature: string; key: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [detailResult, priceResult] = await Promise.allSettled([
        apiGet<DetailResponse>(`/api/cycles/${cycleId}`),
        apiGet<PriceRow[]>(`/api/cycles/${cycleId}/prices`),
      ])
      if (detailResult.status === 'rejected') throw detailResult.reason
      setDetail(detailResult.value.operational)
      const targetAyam = detailResult.value.operational.targets.find((target) => target.groupCode === 'AYAM')?.target
      const targetTahu = detailResult.value.operational.targets.find((target) => target.groupCode === 'TAHU')?.target
      setAyamTarget(targetAyam ?? '')
      setTahuTarget(targetTahu ?? '')
      if (priceResult.status === 'fulfilled') {
        setPrices(priceResult.value)
        setPriceInputs(Object.fromEntries(priceResult.value.map((price) => [price.productId, { consumer: String(price.consumerPrice || ''), trader: String(price.traderPrice || '') }])))
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Detail siklus gagal dimuat.')
    } finally { setLoading(false) }
  }, [cycleId])

  useEffect(() => {
    const task = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(task)
  }, [load])

  async function runAction(name: string, path: string, body: unknown) {
    if (!canMutate) return
    const signature = `${path}:${JSON.stringify(body)}`
    setSaving(name)
    try {
      await apiPost(path, body, { idempotencyKey: mutationKey(keyRef, signature) })
      keyRef.current = null
      toast.success(name === 'open' ? 'Siklus dibuka.' : 'Siklus ditutup.')
      setCloseModal(false)
      await load()
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Perubahan gagal disimpan.') }
    finally { setSaving('') }
  }

  async function savePrices(event: FormEvent) {
    event.preventDefault()
    if (!detail || !canMutate) return
    const body = { expectedVersion: detail.cycle.version, items: prices.map((price) => ({ productId: price.productId, consumerPrice: Number(priceInputs[price.productId]?.consumer).toFixed(2), traderPrice: Number(priceInputs[price.productId]?.trader).toFixed(2) })) }
    const signature = `prices:${JSON.stringify(body)}`
    setSaving('prices')
    try {
      await apiPut(`/api/cycles/${cycleId}/prices`, body, { idempotencyKey: mutationKey(keyRef, signature) })
      keyRef.current = null
      toast.success('Harga minggu ini disimpan.')
      await load()
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Harga gagal disimpan.') }
    finally { setSaving('') }
  }

  async function saveTargets(event: FormEvent) {
    event.preventDefault()
    if (!detail || !canMutate) return
    const body = { expectedVersion: detail.cycle.version, reason: targetReason.trim(), targets: [{ groupCode: 'AYAM', quantity: Number(ayamTarget).toFixed(2) }, { groupCode: 'TAHU', quantity: Number(tahuTarget).toFixed(2) }] }
    const signature = `targets:${JSON.stringify(body)}`
    setSaving('targets')
    try {
      await apiPatch(`/api/cycles/${cycleId}/targets`, body, { idempotencyKey: mutationKey(keyRef, signature) })
      keyRef.current = null
      toast.success('Target / barang datang ini diperbarui.')
      setTargetModal(false)
      await load()
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Target gagal disimpan.') }
    finally { setSaving('') }
  }

  if (loading && !detail) return <div className="space-y-4" aria-busy="true"><div className="h-28 animate-pulse rounded-xl bg-slate-200/70" /><div className="h-72 animate-pulse rounded-xl bg-slate-200/60" /></div>
  if (error || !detail) return <div className="mx-auto mt-12 max-w-lg text-center"><AlertTriangle className="mx-auto h-8 w-8 text-rose-700" /><h1 className="mt-3 text-xl font-black">Siklus tidak dapat dimuat</h1><p className="mt-2 text-sm text-slate-600">{error}</p><Button className="mt-5" onClick={() => void load()} icon={<RefreshCw className="h-4 w-4" />}>Coba lagi</Button></div>

  const cycle = detail.cycle
  const timing = cycleTiming(cycle, now)
  const editable = canMutate && cycle.periodState !== 'closed'

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <header className="border-b border-slate-200 pb-5">
        <Link href={`/?cycleId=${cycle.id}`} className="inline-flex items-center gap-1 text-sm font-bold text-emerald-800"><ArrowLeft className="h-4 w-4" /> Minggu ini</Link>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{cycle.label}</h1><Badge variant={timing.calendarStatus === 'current' ? 'emerald' : 'slate'} dot>{cycleStatusLabel(timing.effectiveStatus)}</Badge></div><p className="mt-2 text-sm text-slate-600">{formatDate(cycle.periodStart)} sampai {formatDate(cycle.periodEnd ?? cycle.deliveryDate)} · versi {cycle.version}</p></div>
          <div className="flex flex-wrap gap-2">{cycle.periodState === 'draft' ? <Button disabled={Boolean(saving) || !canMutate} onClick={() => void runAction('open', `/api/cycles/${cycle.id}/open`, { expectedVersion: cycle.version })}>{timing.calendarStatus === 'ended' ? 'Kunci harga & hitung tagihan' : 'Kunci harga & buka minggu'}</Button> : null}{cycle.periodState === 'open' && timing.calendarStatus === 'current' ? <Button variant="secondary" disabled={Boolean(saving) || !canMutate} onClick={() => setCloseModal(true)}>Tutup siklus</Button> : null}</div>
        </div>
        {timing.calendarStatus !== 'current' ? <p className="mt-3 text-sm text-slate-700">{timing.calendarStatus === 'ended' ? 'Periode sudah berakhir. Data pesanan yang tertinggal tetap dapat dicatat atau dikoreksi selama siklus belum ditutup manual.' : 'Pesanan dapat dicatat mulai Senin pukul 00.00 WIB.'}</p> : null}
      </header>

      <section aria-labelledby="target-title">
        <div className="flex items-end justify-between gap-4"><div><h2 id="target-title" className="text-lg font-extrabold text-slate-950">Target minggu</h2><p className="mt-1 text-sm text-slate-600">Jumlah barang datang per kelompok. Tidak perlu input penerimaan lagi.</p></div>{editable ? <Button size="sm" variant="secondary" onClick={() => setTargetModal(true)} icon={<Pencil className="h-4 w-4" />}>Ubah target</Button> : null}</div>
        <div className="mt-4 grid overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-2">{detail.targets.map((target) => <div key={target.groupCode} className="border-t border-slate-200 p-5 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{target.groupCode === 'AYAM' ? 'Ayam' : 'Tahu'}</p><p className="mt-2 text-2xl font-black tabular-nums text-slate-950">{target.target === null ? 'Belum diketahui' : `${Number(target.target).toLocaleString('id-ID')} ${target.unit}`}</p><p className="mt-1 text-sm text-slate-600">Permintaan {target.demand === null ? 'belum diketahui' : `${Number(target.demand).toLocaleString('id-ID')} ${target.unit}`}</p></div>)}</div>
      </section>

      {cycle.periodState === 'draft' ? (
        <section aria-labelledby="price-title"><Link href={`/orders?cycleId=${cycleId}&new=1`} className="mb-4 inline-flex min-h-11 items-center text-sm font-bold text-emerald-800 underline underline-offset-4">Catat pesanan, harga menyusul</Link><div><h2 id="price-title" className="text-lg font-extrabold text-slate-950">Harga minggu ini</h2><p className="mt-1 text-sm text-slate-600">Pesanan dapat dicatat sebelum harga diisi. Simpan harga, lalu kunci harga & buka minggu untuk menghitung semua tagihan. Semua produk aktif memerlukan harga lebih dari nol.</p></div><form onSubmit={savePrices} className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="hidden grid-cols-[1fr_160px_160px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 @3xl:grid"><span>Produk</span><span>Konsumen</span><span>Pedagang</span></div>{prices.map((price) => <div key={price.productId} className="grid gap-3 border-t border-slate-100 p-4 first:border-t-0 @3xl:grid-cols-[minmax(0,1fr)_160px_160px] sm:items-center"><div><p className="text-sm font-bold text-slate-900">{price.product.name}</p><p className="text-xs text-slate-500">per {price.product.unit}</p></div><label className="text-xs font-semibold text-slate-600 @3xl:text-transparent">Harga konsumen<input disabled={!canMutate} aria-label={`Harga konsumen ${price.product.name}`} inputMode="numeric" required value={priceInputs[price.productId]?.consumer ?? ''} onChange={(event) => setPriceInputs((current) => ({ ...current, [price.productId]: { ...current[price.productId], consumer: event.target.value } }))} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm tabular-nums text-slate-900" /></label><label className="text-xs font-semibold text-slate-600 @3xl:text-transparent">Harga pedagang<input disabled={!canMutate} aria-label={`Harga pedagang ${price.product.name}`} inputMode="numeric" required value={priceInputs[price.productId]?.trader ?? ''} onChange={(event) => setPriceInputs((current) => ({ ...current, [price.productId]: { ...current[price.productId], trader: event.target.value } }))} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm tabular-nums text-slate-900" /></label></div>)}<div className="flex justify-end border-t border-slate-200 p-4"><Button type="submit" disabled={!canMutate || Boolean(saving)} icon={<Save className="h-4 w-4" />}>{saving === 'prices' ? 'Menyimpan…' : 'Simpan harga'}</Button></div></form></section>
      ) : null}

      <section className="border-t border-slate-200 pt-6"><div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]"><div><p className="text-xs font-semibold text-slate-500">Pesanan aktif</p><p className="mt-1 text-xl font-black tabular-nums">{detail.finances.orderCount}</p></div><div><p className="text-xs font-semibold text-slate-500">Nilai pesanan</p><p className="mt-1 text-xl font-black tabular-nums">{formatCurrency(detail.finances.orderValue)}</p></div><div><p className="text-xs font-semibold text-slate-500">Sisa tagihan diketahui</p><p className="mt-1 text-xl font-black tabular-nums">{formatCurrency(detail.finances.knownOutstanding)}</p></div></div><Link href={`/payments?cycleId=${encodeURIComponent(cycleId)}`} className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-emerald-800 hover:text-emerald-950 sm:min-h-8">Buka piutang siklus ini</Link></section>

      <Modal isOpen={targetModal} onClose={() => !saving && setTargetModal(false)} title="Ubah target minggu" description={cycle.rulesVersion !== 2 ? "Catat target siklus lama. Perubahan ini tidak mengubah tagihan atau pembayaran." : "Target ini juga menjadi jumlah barang datang untuk menghitung sisa kelompok."} icon={<Pencil className="h-4 w-4" />}><form onSubmit={saveTargets} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold text-slate-800">Ayam (kg)<input disabled={!canMutate} inputMode="decimal" required value={ayamTarget} onChange={(event) => setAyamTarget(event.target.value.replace(',', '.'))} className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" /></label><label className="text-sm font-bold text-slate-800">Tahu (bungkus)<input disabled={!canMutate} inputMode="numeric" required value={tahuTarget} onChange={(event) => setTahuTarget(event.target.value)} className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" /></label></div><label className="block text-sm font-bold text-slate-800">Alasan perubahan<textarea required value={targetReason} onChange={(event) => setTargetReason(event.target.value)} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-300 p-3 text-sm" /></label><div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><Button type="button" variant="ghost" onClick={() => setTargetModal(false)}>Batal</Button><Button type="submit" disabled={saving === 'targets'}>{saving === 'targets' ? 'Menyimpan…' : 'Simpan target'}</Button></div></form></Modal>
      <Modal isOpen={closeModal} onClose={() => !saving && setCloseModal(false)} title="Tutup siklus?" description="Setelah ditutup, pesanan baru dan perubahan target tidak dapat dilakukan. Pesanan yang sudah tercatat tetap dapat diedit atau dihapus. Pembayaran tetap dapat ditandai lunas." icon={<LockKeyhole className="h-4 w-4" />} maxWidth="sm"><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setCloseModal(false)}>Batal</Button><Button variant="danger" disabled={!canMutate || Boolean(saving)} onClick={() => void runAction('close', `/api/cycles/${cycle.id}/close`, { expectedVersion: cycle.version })}>{saving === 'close' ? 'Menutup…' : 'Tutup siklus'}</Button></div></Modal>
    </div>
  )
}
