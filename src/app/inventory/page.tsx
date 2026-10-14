'use client'

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, Check, PackageCheck, RefreshCw, Save, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPost, newIdempotencyKey } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useOperationalMode } from '@/components/AppShell'

type CycleListItem = { cycleId: string; cycleLabel: string; periodState: string | null; receiptStatus: string; totalOrders: number }
type AvailabilityItem = { productId: string; productName: string; unit: string; capacity: string | null; allocated: string; shipped: string; availableToOrder: string | null; shortage: string | null; physicalRemaining: string | null; reserved: string | null; source: 'planned' | 'received' | 'unknown' }
type ReceiptItem = { productId: string; orderedQty: string; receivedQty: string; damagedQty: string; purchasePrice: string; notes: string | null }
type InventoryDetail = { cycleId: string; cycleVersion: number; historical?: boolean; items: AvailabilityItem[]; receipt: null | { id: string; status: 'draft' | 'confirmed'; supplierNote: string | null; version: number; confirmedAt: string | null; items: ReceiptItem[] } }
type Order = { id: string; version: number; orderStatus: string; cancelledAt: string | null; member: { name: string; group?: { name: string } }; items: Array<{ id: string }>; totalAmount: string }
type LineDraft = { receivedQty: string; damagedQty: string; purchasePrice: string; notes: string }

function InventoryContent() {
  const { operationalSchema } = useOperationalMode()
  const canMutate = operationalSchema === true
  const searchParams = useSearchParams()
  const router = useRouter()
  const requestedCycleId = searchParams.get('cycleId') ?? ''
  const [cycles, setCycles] = useState<CycleListItem[]>([])
  const [cycleId, setCycleId] = useState(requestedCycleId)
  const [detail, setDetail] = useState<InventoryDetail | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [lines, setLines] = useState<Record<string, LineDraft>>({})
  const [supplierNote, setSupplierNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<'draft' | 'confirm' | string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const attemptRef = useRef<{ signature: string; key: string } | null>(null)
  const loadRequestRef = useRef(0)

  const loadCycle = useCallback(async (id: string) => {
    if (!id) return
    const request = ++loadRequestRef.current
    setLoading(true)
    setError(null)
    setDetail(null)
    setOrders([])
    try {
      const [nextDetail, nextOrders] = await Promise.all([
        apiGet<InventoryDetail>(`/api/inventory?cycleId=${encodeURIComponent(id)}`),
        apiGet<Order[]>(`/api/orders?cycleId=${encodeURIComponent(id)}`),
      ])
      if (request !== loadRequestRef.current) return
      setDetail(nextDetail)
      setOrders(nextOrders.filter((order) => !order.cancelledAt))
      const saved = new Map(nextDetail.receipt?.items.map((item) => [item.productId, item]) ?? [])
      setLines(Object.fromEntries(nextDetail.items.map((item) => {
        const existing = saved.get(item.productId)
        return [item.productId, {
          receivedQty: existing?.receivedQty ?? item.capacity ?? '0',
          damagedQty: existing?.damagedQty ?? '0',
          purchasePrice: existing?.purchasePrice ?? '0',
          notes: existing?.notes ?? '',
        }]
      })))
      setSupplierNote(nextDetail.receipt?.supplierNote ?? '')
      attemptRef.current = null
    } catch (cause) {
      if (request !== loadRequestRef.current) return
      setError(cause instanceof Error ? cause.message : 'Data barang gagal dimuat.')
    } finally {
      if (request === loadRequestRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const task = window.setTimeout(() => {
      apiGet<CycleListItem[]>('/api/inventory').then((items) => {
        setCycles(items)
        const selected = requestedCycleId || items[0]?.cycleId || ''
        setCycleId(selected)
        if (selected) void loadCycle(selected)
        else setLoading(false)
      }).catch((cause: unknown) => { setError(cause instanceof Error ? cause.message : 'Daftar siklus gagal dimuat.'); setLoading(false) })
    }, 0)
    return () => window.clearTimeout(task)
  }, [loadCycle, requestedCycleId])

  const summary = useMemo(() => {
    if (!detail) return { productCount: 0, receivedProducts: 0, damagedProducts: 0, shortageProducts: 0, cost: 0 }
    return detail.items.reduce((acc, item) => {
      const line = lines[item.productId]
      acc.productCount += 1
      if (Number(line?.receivedQty ?? 0) > 0) acc.receivedProducts += 1
      if (Number(line?.damagedQty ?? 0) > 0) acc.damagedProducts += 1
      if (Number(item.shortage ?? 0) > 0) acc.shortageProducts += 1
      acc.cost += Number(line?.receivedQty ?? 0) * Number(line?.purchasePrice ?? 0)
      return acc
    }, { productCount: 0, receivedProducts: 0, damagedProducts: 0, shortageProducts: 0, cost: 0 })
  }, [detail, lines])

  function selectCycle(id: string) {
    setCycleId(id)
    router.replace(`/inventory?cycleId=${encodeURIComponent(id)}`)
  }

  function updateLine(productId: string, field: keyof LineDraft, value: string) {
    setLines((current) => ({ ...current, [productId]: { ...current[productId], [field]: field === 'notes' ? value : value.replace(',', '.') } }))
    attemptRef.current = null
  }

  function validateLines() {
    if (!detail) return 'Data barang belum tersedia.'
    for (const item of detail.items) {
      const line = lines[item.productId]
      if (!line || !/^\d+(?:\.\d{1,2})?$/.test(line.receivedQty) || !/^\d+(?:\.\d{1,2})?$/.test(line.damagedQty) || !/^\d+(?:\.\d{1,2})?$/.test(line.purchasePrice)) return `Periksa angka untuk ${item.productName}.`
      if (Number(line.damagedQty) > Number(line.receivedQty)) return `Barang rusak ${item.productName} tidak boleh melebihi jumlah diterima.`
      if (item.unit === 'bungkus' && (!Number.isInteger(Number(line.receivedQty)) || !Number.isInteger(Number(line.damagedQty)))) return `${item.productName} harus memakai jumlah bungkus utuh.`
    }
    return null
  }

  async function saveDraft(event?: FormEvent) {
    event?.preventDefault()
    if (!canMutate || !detail || detail.receipt?.status === 'confirmed') return
    const validation = validateLines()
    if (validation) { toast.error(validation); return }
    const payload = {
      cycleId: detail.cycleId,
      expectedVersion: detail.cycleVersion,
      supplierNote: supplierNote.trim() || null,
      items: detail.items.map((item) => ({ productId: item.productId, ...lines[item.productId], notes: lines[item.productId].notes.trim() || null })),
    }
    const signature = JSON.stringify(payload)
    const attempt = attemptRef.current?.signature === signature ? attemptRef.current : { signature, key: newIdempotencyKey() }
    attemptRef.current = attempt
    setSaving('draft')
    try {
      await apiPost('/api/inventory', payload, { idempotencyKey: attempt.key })
      toast.success('Draf penerimaan tersimpan.')
      await loadCycle(detail.cycleId)
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Draf gagal disimpan. Isian tetap tersedia.') }
    finally { setSaving(null) }
  }

  async function confirmReceipt() {
    if (!canMutate || !detail) return
    setSaving('confirm')
    try {
      await apiPost(`/api/inventory/${encodeURIComponent(detail.cycleId)}/confirm`, { expectedVersion: detail.cycleVersion }, { idempotencyKey: newIdempotencyKey() })
      toast.success('Penerimaan dikonfirmasi. Stok fisik kini aktif.')
      setConfirmOpen(false)
      await loadCycle(detail.cycleId)
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Penerimaan gagal dikonfirmasi.') }
    finally { setSaving(null) }
  }

  async function advanceOrder(order: Order) {
    if (!canMutate) return
    const next = ({ pending: 'confirmed', confirmed: 'shipped', shipped: 'delivered' } as const)[order.orderStatus as 'pending' | 'confirmed' | 'shipped']
    if (!next) return
    setSaving(order.id)
    try {
      await apiPost(`/api/orders/${encodeURIComponent(order.id)}/fulfillment`, { expectedVersion: order.version, status: next }, { idempotencyKey: newIdempotencyKey() })
      toast.success(next === 'confirmed' ? 'Pesanan dikonfirmasi.' : next === 'shipped' ? 'Pesanan ditandai keluar.' : 'Pesanan ditandai diterima.')
      await loadCycle(cycleId)
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Status distribusi gagal diperbarui.') }
    finally { setSaving(null) }
  }

  if (!loading && cycles.length === 0) return <div className="mx-auto mt-16 max-w-lg border-y border-slate-200 py-12 text-center"><PackageCheck className="mx-auto h-8 w-8 text-emerald-800" /><h1 className="mt-3 text-xl font-black text-slate-950">Belum ada siklus</h1><p className="mt-2 text-sm text-slate-600">Buat siklus dan konfirmasi rekap supplier sebelum mencatat barang datang.</p></div>

  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="border-b border-slate-200 pb-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold text-emerald-800">Operasional barang</p><h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Barang masuk dan distribusi</h1><p className="mt-2 text-sm text-slate-600">Bandingkan rencana supplier dengan barang yang benar-benar datang sebelum membagikannya.</p></div><div className="flex gap-2"><select value={cycleId} onChange={(event) => selectCycle(event.target.value)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold">{cycles.map((cycle) => <option key={cycle.cycleId} value={cycle.cycleId}>{cycle.cycleLabel}</option>)}</select><Button variant="secondary" size="icon" aria-label="Muat ulang" onClick={() => void loadCycle(cycleId)} icon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />} /></div></div></header>
    {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div> : null}
    {loading ? <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))]" aria-busy="true">{[0,1,2,3].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-200/60" />)}</div> : !detail ? <p className="text-sm text-slate-600">Data barang belum dapat ditampilkan. Gunakan tombol muat ulang untuk mencoba lagi.</p> : detail.historical ? <HistoricalInventory detail={detail} /> : <>
      <section className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))]" aria-label="Ringkasan barang"><Metric label="Produk dalam siklus" value={String(summary.productCount)} /><Metric label="Produk tercatat datang" value={String(summary.receivedProducts)} /><Metric label="Produk bermasalah" value={String(Math.max(summary.damagedProducts, summary.shortageProducts))} danger={summary.damagedProducts > 0 || summary.shortageProducts > 0} /><Metric label="Estimasi modal" value={formatCurrency(summary.cost)} /></section>
      <section><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-extrabold text-slate-950">Penerimaan per produk</h2><p className="mt-1 text-sm text-slate-600">Rencana berasal dari rekap supplier. Stok baru berubah setelah draf dikonfirmasi.</p></div><Badge variant={detail.receipt?.status === 'confirmed' ? 'emerald' : detail.receipt?.status === 'draft' ? 'amber' : 'slate'}>{detail.receipt?.status === 'confirmed' ? 'Sudah dikonfirmasi' : detail.receipt?.status === 'draft' ? 'Masih draf' : 'Belum dicatat'}</Badge></div>
        <form onSubmit={(event) => void saveDraft(event)} className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="hidden grid-cols-[1fr_repeat(4,minmax(100px,0.7fr))] gap-3 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600 lg:grid"><span>Produk</span><span className="text-right">Rencana</span><span className="text-right">Diterima</span><span className="text-right">Rusak</span><span className="text-right">Harga beli/unit</span></div><div className="divide-y divide-slate-100">{detail.items.map((item) => { const line = lines[item.productId]; return <div key={item.productId} className="grid gap-3 p-4 lg:grid-cols-[1fr_repeat(4,minmax(100px,0.7fr))] lg:items-center"><div><p className="text-sm font-extrabold text-slate-950">{item.productName}</p><p className="text-xs text-slate-500">{item.source === 'received' ? `Fisik tersisa ${Number(item.physicalRemaining ?? 0).toLocaleString('id-ID')} ${item.unit}` : 'Menunggu konfirmasi penerimaan'}</p>{Number(item.shortage ?? 0) > 0 ? <p className="mt-1 text-xs font-bold text-rose-800">Kurang {Number(item.shortage).toLocaleString('id-ID')} {item.unit}</p> : null}</div><LabeledValue label="Rencana" value={`${Number(item.capacity ?? 0).toLocaleString('id-ID')} ${item.unit}`} /><LineInput label="Diterima" value={line?.receivedQty ?? ''} unit={item.unit} disabled={!canMutate || detail.receipt?.status === 'confirmed'} onChange={(value) => updateLine(item.productId, 'receivedQty', value)} /><LineInput label="Rusak" value={line?.damagedQty ?? ''} unit={item.unit} disabled={!canMutate || detail.receipt?.status === 'confirmed'} onChange={(value) => updateLine(item.productId, 'damagedQty', value)} /><LineInput label="Harga beli" value={line?.purchasePrice ?? ''} unit="Rp" disabled={!canMutate || detail.receipt?.status === 'confirmed'} onChange={(value) => updateLine(item.productId, 'purchasePrice', value)} /></div>})}</div><div className="border-t border-slate-200 p-4"><label className="text-xs font-bold text-slate-700">Catatan supplier <span className="font-normal text-slate-500">(opsional)</span><textarea disabled={!canMutate || detail.receipt?.status === 'confirmed'} value={supplierNote} onChange={(event) => { setSupplierNote(event.target.value); attemptRef.current = null }} rows={2} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50" /></label>{detail.receipt?.status !== 'confirmed' ? <div className="mt-4 flex flex-col justify-end gap-2 sm:flex-row"><Button type="submit" variant="secondary" disabled={!canMutate || Boolean(saving)} icon={<Save className="h-4 w-4" />}>{saving === 'draft' ? 'Menyimpan…' : 'Simpan draf'}</Button><Button type="button" disabled={!canMutate || detail.receipt?.status !== 'draft' || Boolean(saving)} onClick={() => setConfirmOpen(true)} icon={<Check className="h-4 w-4" />}>Konfirmasi barang datang</Button></div> : null}</div></form>
      </section>
      <section className="border-t border-slate-200 pt-6"><div><h2 className="font-extrabold text-slate-950">Distribusi pesanan lengkap</h2><p className="mt-1 text-sm text-slate-600">Status berlaku untuk seluruh isi pesanan. Barang hanya dapat ditandai keluar setelah penerimaan dikonfirmasi.</p></div><div className="mt-4 divide-y divide-slate-100 border-y border-slate-200">{orders.map((order) => { const nextLabel = order.orderStatus === 'pending' ? 'Konfirmasi pesanan' : order.orderStatus === 'confirmed' ? 'Tandai keluar' : order.orderStatus === 'shipped' ? 'Tandai diterima' : null; return <div key={order.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-extrabold text-slate-950">{order.member.name}</p><p className="text-xs text-slate-500">{order.member.group?.name ?? 'Tanpa sub-grup'} · {order.items.length} produk · {formatCurrency(order.totalAmount)}</p></div><div className="flex items-center gap-2"><Badge variant={order.orderStatus === 'delivered' ? 'emerald' : order.orderStatus === 'shipped' ? 'amber' : 'slate'}>{order.orderStatus === 'pending' ? 'Menunggu' : order.orderStatus === 'confirmed' ? 'Siap dibagikan' : order.orderStatus === 'shipped' ? 'Sudah keluar' : 'Diterima'}</Badge>{nextLabel ? <Button size="sm" variant={order.orderStatus === 'confirmed' ? 'primary' : 'secondary'} disabled={!canMutate || Boolean(saving) || (order.orderStatus === 'confirmed' && detail.receipt?.status !== 'confirmed')} onClick={() => void advanceOrder(order)} icon={order.orderStatus === 'confirmed' ? <Truck className="h-4 w-4" /> : undefined}>{saving === order.id ? 'Memproses…' : nextLabel}</Button> : null}</div></div>})}{orders.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Belum ada pesanan aktif pada siklus ini.</p> : null}</div></section>
      <Modal isOpen={confirmOpen} onClose={() => !saving && setConfirmOpen(false)} title="Konfirmasi barang datang?" description="Setelah dikonfirmasi, angka penerimaan tidak dapat diubah." icon={<PackageCheck className="h-4 w-4" />}><div className="space-y-3 text-sm text-slate-700"><p>Pastikan jumlah diterima, rusak, dan harga beli sudah sesuai catatan supplier.</p>{summary.damagedProducts > 0 || summary.shortageProducts > 0 ? <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-amber-950"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Ada selisih atau barang rusak. Data ini akan tetap terlihat setelah konfirmasi.</span></div> : null}<div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setConfirmOpen(false)}>Periksa lagi</Button><Button disabled={!canMutate || Boolean(saving)} onClick={() => void confirmReceipt()}>{saving === 'confirm' ? 'Mengonfirmasi…' : 'Ya, konfirmasi'}</Button></div></div></Modal>
    </>}
  </div>
}

function HistoricalInventory({ detail }: { detail: InventoryDetail }) {
  const receipts = new Map(detail.receipt?.items.map((item) => [item.productId, item]) ?? [])
  return <section className="space-y-5" aria-labelledby="historical-inventory-title">
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><h2 id="historical-inventory-title" className="font-bold">Catatan barang siklus lama</h2><p className="mt-2">Jumlah pesanan yang tersimpan ditampilkan di bawah. Target pembelian tidak berarti barang sudah diterima. Stok tersedia dan sisa fisik belum dapat dihitung sampai penerimaan lama diverifikasi.</p><p className="mt-2">{detail.receipt ? 'Catatan penerimaan lama tersedia, tetapi belum diverifikasi untuk perhitungan stok.' : 'Belum ada catatan barang datang untuk siklus ini.'}</p></div>
    <div className="divide-y divide-slate-200 border-y border-slate-200">{detail.items.map((item) => {
      const receipt = receipts.get(item.productId)
      return <div key={item.productId} className="py-4"><h3 className="font-bold text-slate-950">{item.productName}</h3><dl className="mt-3 grid gap-3 sm:grid-cols-3"><div><dt className="text-xs text-slate-600">Jumlah pesanan tercatat</dt><dd className="mt-1 font-semibold tabular-nums">{Number(item.allocated).toLocaleString('id-ID')} {item.unit}</dd></div><div><dt className="text-xs text-slate-600">Penerimaan tercatat</dt><dd className="mt-1 font-semibold tabular-nums">{receipt ? `${Number(receipt.receivedQty).toLocaleString('id-ID')} ${item.unit}` : 'Belum dicatat'}</dd></div><div><dt className="text-xs text-slate-600">Barang rusak tercatat</dt><dd className="mt-1 font-semibold tabular-nums">{receipt ? `${Number(receipt.damagedQty).toLocaleString('id-ID')} ${item.unit}` : 'Belum dicatat'}</dd></div></dl></div>
    })}{detail.items.length === 0 ? <p className="py-6 text-sm text-slate-600">Belum ada produk atau pesanan tercatat pada siklus ini.</p> : null}</div>
    <div className="flex flex-wrap gap-x-6 gap-y-2"><Link href={`/cycles/${detail.cycleId}`} className="inline-flex min-h-11 items-center text-sm font-bold text-emerald-800">Lihat target dan rekap siklus</Link><Link href={`/orders?cycleId=${detail.cycleId}`} className="inline-flex min-h-11 items-center text-sm font-bold text-emerald-800">Lihat pesanan tercatat</Link></div>
  </section>
}

function Metric({ label, value, danger }: { label: string; value: string; danger?: boolean }) { return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className={`mt-1 text-xl font-black tabular-nums ${danger ? 'text-rose-800' : 'text-slate-950'}`}>{value}</p></div> }
function LabeledValue({ label, value }: { label: string; value: string }) { return <div className="lg:text-right"><p className="text-[11px] font-semibold text-slate-500 lg:hidden">{label}</p><p className="text-sm font-bold tabular-nums text-slate-800">{value}</p></div> }
function LineInput({ label, value, unit, disabled, onChange }: { label: string; value: string; unit: string; disabled: boolean; onChange: (value: string) => void }) { return <label className="text-[11px] font-semibold text-slate-500 lg:text-right"><span className="lg:sr-only">{label}</span><span className="flex items-center gap-2 lg:justify-end"><input disabled={disabled} inputMode={unit === 'bungkus' ? 'numeric' : 'decimal'} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-right text-sm font-bold tabular-nums disabled:bg-slate-50 lg:w-28" /><span className="w-14 text-left text-xs text-slate-500">{unit}</span></span></label> }

export default function InventoryPage() { return <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-slate-200/60" />}><InventoryContent /></Suspense> }
