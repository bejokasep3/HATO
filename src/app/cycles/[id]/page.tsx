'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Check, ClipboardCopy, LockKeyhole, Pencil, RefreshCw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPatch, apiPost, apiPut, newIdempotencyKey } from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useOperationalMode } from '@/components/AppShell'

type Operational = {
  cycle: {
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
type RecapItem = { productId: string; productName: string; unit: string; groupCode: 'AYAM' | 'TAHU' | 'NONE'; demand: string }
type RecapResponse = {
  cycleId: string; cycleVersion: number; periodState: string
  groups: Array<{ groupCode: 'AYAM' | 'TAHU'; target: string; demand: string; percentage: number | null; shortfall: string; plannedPurchase: string }>
  items: RecapItem[]
  confirmed: null | { id: string; confirmedAt: string; cycleVersionAtConfirm: number; targetSnapshot: unknown; items: Array<RecapItem & { quantity: string }>; whatsappText: string }
}

function mutationKey(ref: React.MutableRefObject<{ signature: string; key: string } | null>, signature: string) {
  if (ref.current?.signature === signature) return ref.current.key
  const value = { signature, key: newIdempotencyKey() }
  ref.current = value
  return value.key
}

function initialAllocation(recap: RecapResponse) {
  if (recap.confirmed) return Object.fromEntries(recap.confirmed.items.map((item) => [item.productId, item.quantity])) as Record<string, string>
  const values = Object.fromEntries(recap.items.map((item) => [item.productId, item.demand])) as Record<string, string>
  for (const group of recap.groups) {
    const lines = recap.items.filter((item) => item.groupCode === group.groupCode)
    const deficit = Math.max(0, Number(group.target) - lines.reduce((sum, item) => sum + Number(item.demand), 0))
    if (lines[0] && deficit > 0) values[lines[0].productId] = (Number(values[lines[0].productId]) + deficit).toFixed(2)
  }
  return values
}

export default function CycleDetailPage() {
  const { operationalSchema } = useOperationalMode()
  const canMutate = operationalSchema === true
  const params = useParams<{ id: string }>()
  const cycleId = params.id
  const [detail, setDetail] = useState<Operational | null>(null)
  const [prices, setPrices] = useState<PriceRow[]>([])
  const [priceInputs, setPriceInputs] = useState<Record<string, { consumer: string; trader: string }>>({})
  const [recap, setRecap] = useState<RecapResponse | null>(null)
  const [allocations, setAllocations] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')
  const [recapError, setRecapError] = useState('')
  const [targetModal, setTargetModal] = useState(false)
  const [closeModal, setCloseModal] = useState(false)
  const [ayamTarget, setAyamTarget] = useState('10')
  const [tahuTarget, setTahuTarget] = useState('10')
  const [targetReason, setTargetReason] = useState('Penyesuaian target minggu ini')
  const keyRef = useRef<{ signature: string; key: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setRecapError('')
    try {
      const [detailResult, priceResult, recapResult] = await Promise.allSettled([
        apiGet<DetailResponse>(`/api/cycles/${cycleId}`),
        apiGet<PriceRow[]>(`/api/cycles/${cycleId}/prices`),
        apiGet<RecapResponse>(`/api/cycles/${cycleId}/supplier-recap`),
      ])
      if (detailResult.status === 'rejected') throw detailResult.reason
      setDetail(detailResult.value.operational)
      const targetAyam = detailResult.value.operational.targets.find((target) => target.groupCode === 'AYAM')?.target
      const targetTahu = detailResult.value.operational.targets.find((target) => target.groupCode === 'TAHU')?.target
      if (targetAyam !== null && targetAyam !== undefined) setAyamTarget(targetAyam)
      if (targetTahu !== null && targetTahu !== undefined) setTahuTarget(targetTahu)
      if (priceResult.status === 'fulfilled') {
        setPrices(priceResult.value)
        setPriceInputs(Object.fromEntries(priceResult.value.map((price) => [price.productId, { consumer: String(price.consumerPrice || ''), trader: String(price.traderPrice || '') }])))
      }
      if (recapResult.status === 'fulfilled') {
        setRecap(recapResult.value)
        setAllocations(initialAllocation(recapResult.value))
      } else {
        setRecap(null)
        setRecapError(recapResult.reason instanceof Error ? recapResult.reason.message : 'Rekap belum dapat dibaca.')
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
      toast.success('Target minggu ini diperbarui.')
      setTargetModal(false)
      await load()
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Target gagal disimpan.') }
    finally { setSaving('') }
  }

  const allocationCheck = useMemo(() => {
    if (!recap) return { valid: false, messages: [] as string[] }
    const messages: string[] = []
    for (const item of recap.items) if (Number(allocations[item.productId] ?? 0) < Number(item.demand)) messages.push(`${item.productName} di bawah pesanan ${Number(item.demand).toLocaleString('id-ID')} ${item.unit}`)
    for (const group of recap.groups) {
      const actual = recap.items.filter((item) => item.groupCode === group.groupCode).reduce((sum, item) => sum + Number(allocations[item.productId] ?? 0), 0)
      const required = Math.max(Number(group.target), Number(group.demand))
      if (Math.abs(actual - required) > 0.001) messages.push(`Total ${group.groupCode === 'AYAM' ? 'ayam' : 'tahu'} harus ${required.toLocaleString('id-ID')}, saat ini ${actual.toLocaleString('id-ID')}`)
    }
    return { valid: messages.length === 0, messages }
  }, [allocations, recap])

  async function confirmRecap() {
    if (!recap || !allocationCheck.valid || !canMutate) return
    const body = { expectedVersion: recap.cycleVersion, items: recap.items.map((item) => ({ productId: item.productId, quantity: Number(allocations[item.productId] ?? 0).toFixed(2) })) }
    const signature = `recap:${JSON.stringify(body)}`
    setSaving('recap')
    try {
      await apiPost(`/api/cycles/${cycleId}/supplier-recap`, body, { idempotencyKey: mutationKey(keyRef, signature) })
      keyRef.current = null
      toast.success('Rekap supplier dikunci.')
      await load()
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Rekap gagal dikonfirmasi.') }
    finally { setSaving('') }
  }

  if (loading && !detail) return <div className="space-y-4" aria-busy="true"><div className="h-28 animate-pulse rounded-xl bg-slate-200/70" /><div className="h-72 animate-pulse rounded-xl bg-slate-200/60" /></div>
  if (error || !detail) return <div className="mx-auto mt-12 max-w-lg text-center"><AlertTriangle className="mx-auto h-8 w-8 text-rose-700" /><h1 className="mt-3 text-xl font-black">Siklus tidak dapat dimuat</h1><p className="mt-2 text-sm text-slate-600">{error}</p><Button className="mt-5" onClick={() => void load()} icon={<RefreshCw className="h-4 w-4" />}>Coba lagi</Button></div>

  const cycle = detail.cycle
  const editable = canMutate && cycle.periodState !== 'closed'

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <header className="border-b border-slate-200 pb-5">
        <Link href={`/?cycleId=${cycle.id}`} className="inline-flex items-center gap-1 text-sm font-bold text-emerald-800"><ArrowLeft className="h-4 w-4" /> Minggu ini</Link>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{cycle.label}</h1><Badge variant={cycle.periodState === 'open' ? 'emerald' : cycle.periodState === 'draft' ? 'amber' : 'slate'} dot>{cycle.periodState ?? 'histori'}</Badge></div><p className="mt-2 text-sm text-slate-600">{formatDate(cycle.periodStart)} sampai {formatDate(cycle.periodEnd ?? cycle.deliveryDate)} · versi {cycle.version}</p></div><div className="flex gap-2">{cycle.periodState === 'draft' ? <Button disabled={Boolean(saving) || !canMutate} onClick={() => void runAction('open', `/api/cycles/${cycle.id}/open`, { expectedVersion: cycle.version })}>Buka siklus</Button> : null}{cycle.periodState === 'open' ? <Button variant="secondary" disabled={Boolean(saving) || !canMutate} onClick={() => setCloseModal(true)}>Tutup siklus</Button> : null}</div></div>
      </header>

      <section aria-labelledby="target-title">
        <div className="flex items-end justify-between gap-4"><div><h2 id="target-title" className="text-lg font-extrabold text-slate-950">Target minggu</h2><p className="mt-1 text-sm text-slate-600">Gabungan seluruh varian dalam kelompok yang sama.</p></div>{editable ? <Button size="sm" variant="secondary" onClick={() => setTargetModal(true)} icon={<Pencil className="h-4 w-4" />}>Ubah target</Button> : null}</div>
        <div className="mt-4 grid overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-2">{detail.targets.map((target) => <div key={target.groupCode} className="border-t border-slate-200 p-5 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{target.groupCode === 'AYAM' ? 'Ayam' : 'Tahu'}</p><p className="mt-2 text-2xl font-black tabular-nums text-slate-950">{target.target === null ? 'Belum diketahui' : `${Number(target.target).toLocaleString('id-ID')} ${target.unit}`}</p><p className="mt-1 text-sm text-slate-600">Permintaan {target.demand === null ? 'belum diketahui' : `${Number(target.demand).toLocaleString('id-ID')} ${target.unit}`}</p></div>)}</div>
      </section>

      {cycle.periodState === 'draft' ? (
        <section aria-labelledby="price-title"><div><h2 id="price-title" className="text-lg font-extrabold text-slate-950">Harga minggu ini</h2><p className="mt-1 text-sm text-slate-600">Harga dikunci setelah siklus dibuka. Semua produk aktif harus memiliki harga lebih dari nol.</p></div><form onSubmit={savePrices} className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="hidden grid-cols-[1fr_160px_160px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 @3xl:grid"><span>Produk</span><span>Konsumen</span><span>Pedagang</span></div>{prices.map((price) => <div key={price.productId} className="grid gap-3 border-t border-slate-100 p-4 first:border-t-0 @3xl:grid-cols-[minmax(0,1fr)_160px_160px] sm:items-center"><div><p className="text-sm font-bold text-slate-900">{price.product.name}</p><p className="text-xs text-slate-500">per {price.product.unit}</p></div><label className="text-xs font-semibold text-slate-600 @3xl:text-transparent">Harga konsumen<input disabled={!canMutate} aria-label={`Harga konsumen ${price.product.name}`} inputMode="numeric" required value={priceInputs[price.productId]?.consumer ?? ''} onChange={(event) => setPriceInputs((current) => ({ ...current, [price.productId]: { ...current[price.productId], consumer: event.target.value } }))} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm tabular-nums text-slate-900" /></label><label className="text-xs font-semibold text-slate-600 @3xl:text-transparent">Harga pedagang<input disabled={!canMutate} aria-label={`Harga pedagang ${price.product.name}`} inputMode="numeric" required value={priceInputs[price.productId]?.trader ?? ''} onChange={(event) => setPriceInputs((current) => ({ ...current, [price.productId]: { ...current[price.productId], trader: event.target.value } }))} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm tabular-nums text-slate-900" /></label></div>)}<div className="flex justify-end border-t border-slate-200 p-4"><Button type="submit" disabled={!canMutate || Boolean(saving)} icon={<Save className="h-4 w-4" />}>{saving === 'prices' ? 'Menyimpan…' : 'Simpan harga'}</Button></div></form></section>
      ) : null}

      <section aria-labelledby="recap-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 id="recap-title" className="text-lg font-extrabold text-slate-950">Rekap pembelian supplier</h2><p className="mt-1 text-sm text-slate-600">Jumlah kelompok harus sama dengan target atau permintaan, mana yang lebih besar.</p></div>{recap?.confirmed ? <Badge variant="emerald" icon={<LockKeyhole className="h-3 w-3" />}>Dikunci {formatDate(recap.confirmed.confirmedAt)}</Badge> : null}</div>
        {recapError ? <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{recapError}</div> : null}
        {recap ? <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">{recap.groups.map((group) => { const groupItems = recap.items.filter((item) => item.groupCode === group.groupCode); const actual = groupItems.reduce((sum, item) => sum + Number(allocations[item.productId] ?? 0), 0); return <div key={group.groupCode} className="border-t border-slate-200 first:border-t-0"><div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-3"><div><h3 className="font-extrabold text-slate-950">{group.groupCode === 'AYAM' ? 'Ayam' : 'Tahu'}</h3><p className="text-xs text-slate-500">Pesanan {Number(group.demand).toLocaleString('id-ID')} · target {Number(group.target).toLocaleString('id-ID')}</p></div><p className="text-sm font-bold tabular-nums text-slate-800">Alokasi {actual.toLocaleString('id-ID')} / {Math.max(Number(group.target), Number(group.demand)).toLocaleString('id-ID')}</p></div><div className="divide-y divide-slate-100">{groupItems.map((item) => <div key={item.productId} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-sm font-bold text-slate-900">{item.productName}</p><p className="text-xs text-slate-500">Pesanan anggota {Number(item.demand).toLocaleString('id-ID')} {item.unit}</p></div>{recap.confirmed ? <span className="font-extrabold tabular-nums text-slate-900">{Number(recap.confirmed.items.find((line) => line.productId === item.productId)?.quantity ?? 0).toLocaleString('id-ID')} {item.unit}</span> : <label className="text-xs font-semibold text-slate-600">Jumlah beli <span className="sr-only">{item.productName}</span><span className="ml-2 inline-flex items-center gap-2"><input disabled={!canMutate} inputMode={item.unit === 'bungkus' ? 'numeric' : 'decimal'} value={allocations[item.productId] ?? ''} onChange={(event) => setAllocations((current) => ({ ...current, [item.productId]: event.target.value.replace(',', '.') }))} className="min-h-10 w-28 rounded-lg border border-slate-300 px-3 text-right text-sm tabular-nums" /><span>{item.unit}</span></span></label>}</div>)}</div></div>})}{!recap.confirmed ? <div className="border-t border-slate-200 p-4"><div className="space-y-1 text-xs text-rose-700">{allocationCheck.messages.map((message) => <p key={message}>{message}</p>)}</div><div className="mt-3 flex justify-end"><Button disabled={!canMutate || !allocationCheck.valid || recap.periodState !== 'open' || Boolean(saving)} onClick={() => void confirmRecap()} icon={<Check className="h-4 w-4" />}>{saving === 'recap' ? 'Mengunci…' : 'Konfirmasi dan kunci rekap'}</Button></div>{recap.periodState !== 'open' ? <p className="mt-2 text-right text-xs text-slate-500">Buka siklus sebelum mengonfirmasi rekap.</p> : null}</div> : <div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-600">Snapshot target dan nama produk tersimpan bersama rekap.</p><Button variant="secondary" size="sm" onClick={() => { void navigator.clipboard.writeText(recap.confirmed!.whatsappText); toast.success('Teks rekap disalin.') }} icon={<ClipboardCopy className="h-4 w-4" />}>Salin untuk WhatsApp</Button></div>}</div> : null}
      </section>

      <section className="border-t border-slate-200 pt-6"><div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]"><div><p className="text-xs font-semibold text-slate-500">Pesanan aktif</p><p className="mt-1 text-xl font-black tabular-nums">{detail.finances.orderCount}</p></div><div><p className="text-xs font-semibold text-slate-500">Nilai pesanan</p><p className="mt-1 text-xl font-black tabular-nums">{formatCurrency(detail.finances.orderValue)}</p></div><div><p className="text-xs font-semibold text-slate-500">Sisa tagihan diketahui</p><p className="mt-1 text-xl font-black tabular-nums">{formatCurrency(detail.finances.knownOutstanding)}</p></div></div><Link href={`/payments?cycleId=${encodeURIComponent(cycleId)}`} className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-emerald-800 hover:text-emerald-950 sm:min-h-8">Buka piutang siklus ini</Link></section>

      <Modal isOpen={targetModal} onClose={() => !saving && setTargetModal(false)} title="Ubah target minggu" description="Perubahan target setelah rekap dikunci tidak mengubah snapshot pembelian yang sudah dikonfirmasi." icon={<Pencil className="h-4 w-4" />}><form onSubmit={saveTargets} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold text-slate-800">Ayam (kg)<input disabled={!canMutate} inputMode="decimal" required value={ayamTarget} onChange={(event) => setAyamTarget(event.target.value.replace(',', '.'))} className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" /></label><label className="text-sm font-bold text-slate-800">Tahu (bungkus)<input disabled={!canMutate} inputMode="numeric" required value={tahuTarget} onChange={(event) => setTahuTarget(event.target.value)} className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" /></label></div><label className="block text-sm font-bold text-slate-800">Alasan perubahan<textarea required value={targetReason} onChange={(event) => setTargetReason(event.target.value)} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-300 p-3 text-sm" /></label><div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><Button type="button" variant="ghost" onClick={() => setTargetModal(false)}>Batal</Button><Button type="submit" disabled={saving === 'targets'}>{saving === 'targets' ? 'Menyimpan…' : 'Simpan target'}</Button></div></form></Modal>
      <Modal isOpen={closeModal} onClose={() => !saving && setCloseModal(false)} title="Tutup siklus?" description="Setelah ditutup, pesanan baru dan perubahan target tidak dapat dilakukan. Pembayaran cicilan tetap dapat dicatat." icon={<LockKeyhole className="h-4 w-4" />} maxWidth="sm"><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setCloseModal(false)}>Batal</Button><Button variant="danger" disabled={!canMutate || Boolean(saving)} onClick={() => void runAction('close', `/api/cycles/${cycle.id}/close`, { expectedVersion: cycle.version })}>{saving === 'close' ? 'Menutup…' : 'Tutup siklus'}</Button></div></Modal>
    </div>
  )
}
