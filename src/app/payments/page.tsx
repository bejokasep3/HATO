'use client'

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, ArrowLeft, CircleDollarSign, History, RefreshCw, RotateCcw, Search, WalletCards } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPost, newIdempotencyKey } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useOperationalMode } from '@/components/AppShell'

type Cycle = { id: string; label: string }
type Group = { id: string; name: string; isActive?: boolean }
type Receivable = {
  orderId: string
  cycleId: string
  cycleLabel: string
  memberId: string
  memberName: string
  totalAmount: string
  paidAmount: string
  outstandingAmount: string
}
type ReceivableResponse = {
  page: number
  pageSize: number
  totalCount: number
  totalKnownOutstanding: string
  unreconciledOrderCount: number
  totalIncomplete: boolean
  items: Receivable[]
}
type PaymentSummary = {
  status: 'unverified' | 'unpaid' | 'partial' | 'paid'
  paidAmount: string | null
  outstandingAmount: string | null
}
type PaymentEntry = {
  id: string
  amount: string
  method: 'cash' | 'transfer' | 'other'
  source: string
  note: string | null
  occurredAt: string | null
  createdAt: string
  reversedAt: string | null
  reversalReason: string | null
}
type OrderPayments = {
  orderId: string
  pricingPending?: boolean
  cancelledAt: string | null
  member: { id: string; name: string; groupName: string | null }
  cycle: { id: string; label: string }
  totalAmount: string
  summary: PaymentSummary
  payments: PaymentEntry[]
}
type PaymentDraft = {
  amount: string
  method: 'cash' | 'transfer' | 'other'
  note: string
  attempt?: { signature: string; key: string }
}

const emptyDraft: PaymentDraft = { amount: '', method: 'cash', note: '' }

function draftStorageKey(orderId: string) {
  return `hato-payment-draft:${orderId}`
}

function readDraft(orderId: string): PaymentDraft {
  try {
    const stored = window.localStorage.getItem(draftStorageKey(orderId))
    if (!stored) return emptyDraft
    const parsed = JSON.parse(stored) as Partial<PaymentDraft>
    return {
      amount: typeof parsed.amount === 'string' ? parsed.amount : '',
      method: parsed.method === 'transfer' || parsed.method === 'other' ? parsed.method : 'cash',
      note: typeof parsed.note === 'string' ? parsed.note : '',
      attempt: parsed.attempt,
    }
  } catch {
    return emptyDraft
  }
}

function paymentMethodLabel(method: PaymentEntry['method']) {
  if (method === 'cash') return 'Tunai'
  if (method === 'transfer') return 'Transfer'
  return 'Lainnya'
}

function dateTime(value: string | null) {
  if (!value) return 'Waktu tidak dicatat'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function PaymentsContent() {
  const { operationalSchema } = useOperationalMode()
  const canMutate = operationalSchema === true
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedCycleId = searchParams.get('cycleId') ?? ''
  const requestedGroupId = searchParams.get('groupId') ?? ''
  const requestedOrderId = searchParams.get('orderId') ?? ''
  const [cycleId, setCycleId] = useState(requestedCycleId)
  const [groupId, setGroupId] = useState(requestedGroupId)
  const [page, setPage] = useState(1)
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [receivables, setReceivables] = useState<ReceivableResponse | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<OrderPayments | null>(null)
  const [draft, setDraft] = useState<PaymentDraft>(emptyDraft)
  const [reversingId, setReversingId] = useState<string | null>(null)
  const [reversalReason, setReversalReason] = useState('')
  const [reverseAttempt, setReverseAttempt] = useState<{ signature: string; key: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingOrder, setLoadingOrder] = useState(false)
  const [saving, setSaving] = useState<'payment' | 'reverse' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const updateUrl = useCallback((next: { cycleId?: string; groupId?: string; orderId?: string | null }) => {
    const params = new URLSearchParams(searchParams.toString())
    const values = {
      cycleId: next.cycleId ?? cycleId,
      groupId: next.groupId ?? groupId,
      orderId: next.orderId === undefined ? requestedOrderId : next.orderId,
    }
    for (const [key, value] of Object.entries(values)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    const query = params.toString()
    router.replace(query ? `/payments?${query}` : '/payments')
  }, [cycleId, groupId, requestedOrderId, router, searchParams])

  const loadReceivables = useCallback(async (targetPage: number, targetCycle: string, targetGroup: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(targetPage), pageSize: '30' })
      if (targetCycle) params.set('cycleId', targetCycle)
      if (targetGroup) params.set('groupId', targetGroup)
      const result = await apiGet<ReceivableResponse>(`/api/payments/receivables?${params}`)
      setReceivables(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Daftar piutang gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadOrder = useCallback(async (orderId: string) => {
    if (!orderId) return
    setLoadingOrder(true)
    try {
      const result = await apiGet<OrderPayments>(`/api/orders/${encodeURIComponent(orderId)}/payments`)
      setSelectedOrder(result)
      setDraft(readDraft(orderId))
      setReversingId(null)
      setReversalReason('')
      setReverseAttempt(null)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Rincian pembayaran gagal dimuat.')
      updateUrl({ orderId: null })
    } finally {
      setLoadingOrder(false)
    }
  }, [updateUrl])

  useEffect(() => {
    const task = window.setTimeout(() => {
      Promise.all([apiGet<Cycle[]>('/api/cycles'), apiGet<Group[]>('/api/groups')])
        .then(([cycleItems, groupItems]) => {
          setCycles(cycleItems)
          setGroups(groupItems.filter((group) => group.isActive !== false))
        })
        .catch(() => undefined)
      void loadReceivables(1, requestedCycleId, requestedGroupId)
    }, 0)
    return () => window.clearTimeout(task)
  }, [loadReceivables, requestedCycleId, requestedGroupId])

  useEffect(() => {
    if (!requestedOrderId) {
      const task = window.setTimeout(() => setSelectedOrder(null), 0)
      return () => window.clearTimeout(task)
    }
    const task = window.setTimeout(() => void loadOrder(requestedOrderId), 0)
    return () => window.clearTimeout(task)
  }, [loadOrder, requestedOrderId])

  useEffect(() => {
    if (!selectedOrder) return
    window.localStorage.setItem(draftStorageKey(selectedOrder.orderId), JSON.stringify(draft))
  }, [draft, selectedOrder])

  const pageCount = Math.max(1, Math.ceil((receivables?.totalCount ?? 0) / 30))
  const paymentStatus = selectedOrder?.summary.status
  const canPay = Boolean(canMutate && selectedOrder && !selectedOrder.cancelledAt && paymentStatus !== 'paid' && paymentStatus !== 'unverified')
  const selectedOutstanding = selectedOrder?.summary.outstandingAmount ?? null
  const activePayments = useMemo(() => selectedOrder?.payments.filter((payment) => !payment.reversedAt) ?? [], [selectedOrder])

  function applyFilters(nextCycle: string, nextGroup: string) {
    setCycleId(nextCycle)
    setGroupId(nextGroup)
    setPage(1)
    updateUrl({ cycleId: nextCycle, groupId: nextGroup })
    void loadReceivables(1, nextCycle, nextGroup)
  }

  function openOrder(orderId: string) {
    updateUrl({ orderId })
  }

  function closeOrder() {
    setSelectedOrder(null)
    updateUrl({ orderId: null })
  }

  async function submitPayment(event: FormEvent) {
    event.preventDefault()
    if (!selectedOrder || !canPay) return
    const amount = draft.amount.trim().replace(',', '.')
    if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
      toast.error('Isi nominal pembayaran yang valid.')
      return
    }
    const payload = { amount, method: draft.method, note: draft.note.trim() || null }
    const signature = JSON.stringify(payload)
    const attempt = draft.attempt?.signature === signature ? draft.attempt : { signature, key: newIdempotencyKey() }
    const persisted = { ...draft, amount, attempt }
    setDraft(persisted)
    window.localStorage.setItem(draftStorageKey(selectedOrder.orderId), JSON.stringify(persisted))
    setSaving('payment')
    try {
      await apiPost(`/api/orders/${encodeURIComponent(selectedOrder.orderId)}/payments`, payload, { idempotencyKey: attempt.key })
      window.localStorage.removeItem(draftStorageKey(selectedOrder.orderId))
      setDraft(emptyDraft)
      toast.success('Pembayaran tercatat.')
      await Promise.all([loadOrder(selectedOrder.orderId), loadReceivables(1, cycleId, groupId)])
      setPage(1)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Pembayaran gagal dicatat. Draf tetap tersimpan.')
    } finally {
      setSaving(null)
    }
  }

  async function submitReversal(paymentId: string) {
    if (!selectedOrder || !canMutate) return
    const reason = reversalReason.trim()
    if (!reason) {
      toast.error('Alasan pembalikan wajib diisi.')
      return
    }
    const signature = JSON.stringify({ paymentId, reason })
    const attempt = reverseAttempt?.signature === signature ? reverseAttempt : { signature, key: newIdempotencyKey() }
    setReverseAttempt(attempt)
    setSaving('reverse')
    try {
      await apiPost(`/api/payments/${encodeURIComponent(paymentId)}/reverse`, { reason }, { idempotencyKey: attempt.key })
      toast.success('Pembayaran dibalik dan saldo diperbarui.')
      setReversingId(null)
      setReversalReason('')
      setReverseAttempt(null)
      await Promise.all([loadOrder(selectedOrder.orderId), loadReceivables(1, cycleId, groupId)])
      setPage(1)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Pembalikan pembayaran gagal.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-xs font-bold text-emerald-800">Keuangan operasional</p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Piutang dan pembayaran</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Catat cicilan tanpa mengubah pesanan. Semua minggu tampil secara bawaan agar tagihan lama tidak terlewat.</p></div>
          <Button variant="secondary" onClick={() => void loadReceivables(page, cycleId, groupId)} disabled={loading} icon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}>Muat ulang</Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Ringkasan piutang">
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2"><p className="text-xs font-semibold text-slate-500">Total sisa tagihan diketahui</p><p className="mt-1 text-2xl font-black tabular-nums text-rose-800">{receivables ? formatCurrency(receivables.totalKnownOutstanding) : '—'}</p><p className="mt-1 text-xs text-slate-500">{receivables?.totalCount ?? 0} pesanan belum lunas dalam filter ini</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">Saldo belum diverifikasi</p><p className="mt-1 text-2xl font-black tabular-nums text-slate-950">{receivables?.unreconciledOrderCount ?? 0}</p><p className="mt-1 text-xs text-slate-500">Tidak dimasukkan ke total sampai saldo awal diperiksa</p></div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="Filter piutang">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-700">Siklus<select value={cycleId} onChange={(event) => applyFilters(event.target.value, groupId)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold"><option value="">Semua siklus</option>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.label}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-700">Sub-grup<select value={groupId} onChange={(event) => applyFilters(cycleId, event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold"><option value="">Semua sub-grup</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        </div>
      </section>

      {receivables?.totalIncomplete ? <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>Total di atas belum mencakup {receivables.unreconciledOrderCount} pesanan lama yang saldo awalnya belum diverifikasi.</p></div> : null}
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}</div> : null}

      <section aria-labelledby="receivable-heading">
        <div className="flex items-center justify-between gap-3"><div><h2 id="receivable-heading" className="font-extrabold text-slate-950">Pesanan belum lunas</h2><p className="mt-1 text-sm text-slate-600">Pilih pesanan untuk melihat riwayat atau mencatat pembayaran.</p></div><Search className="h-5 w-5 text-slate-400" /></div>
        <div className="mt-4 divide-y divide-slate-100 border-y border-slate-200">
          {receivables?.items.map((item) => <button key={item.orderId} type="button" onClick={() => openOrder(item.orderId)} className="grid min-h-20 w-full gap-2 px-2 py-3 text-left hover:bg-slate-50 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6"><div className="min-w-0"><p className="truncate text-sm font-extrabold text-slate-950">{item.memberName}</p><p className="mt-1 truncate text-xs text-slate-500">{item.cycleLabel}</p></div><div className="sm:text-right"><p className="text-xs font-semibold text-slate-500">Sudah dibayar</p><p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-800">{formatCurrency(item.paidAmount)}</p></div><div className="sm:min-w-36 sm:text-right"><p className="text-xs font-semibold text-slate-500">Sisa</p><p className="mt-0.5 font-black tabular-nums text-rose-800">{formatCurrency(item.outstandingAmount)}</p></div></button>)}
          {!loading && receivables?.items.length === 0 ? <div className="py-12 text-center"><CircleDollarSign className="mx-auto h-7 w-7 text-emerald-800" /><p className="mt-3 font-bold text-slate-900">Tidak ada piutang pada filter ini</p><p className="mt-1 text-sm text-slate-500">Semua pesanan yang saldonya sudah diverifikasi telah lunas.</p></div> : null}
          {loading ? <div className="space-y-3 py-4" aria-busy="true"><div className="h-16 animate-pulse rounded-lg bg-slate-100" /><div className="h-16 animate-pulse rounded-lg bg-slate-100" /></div> : null}
        </div>
        {pageCount > 1 ? <div className="mt-4 flex items-center justify-between"><Button variant="secondary" disabled={page <= 1 || loading} onClick={() => { const next = page - 1; setPage(next); void loadReceivables(next, cycleId, groupId) }} icon={<ArrowLeft className="h-4 w-4" />}>Sebelumnya</Button><p className="text-xs font-semibold text-slate-600">Halaman {page} dari {pageCount}</p><Button variant="secondary" disabled={page >= pageCount || loading} onClick={() => { const next = page + 1; setPage(next); void loadReceivables(next, cycleId, groupId) }}>Berikutnya</Button></div> : null}
      </section>

      <Modal isOpen={Boolean(requestedOrderId)} onClose={closeOrder} title={selectedOrder?.member.name ?? 'Rincian pembayaran'} description={selectedOrder ? `${selectedOrder.member.groupName ?? 'Tanpa sub-grup'} · ${selectedOrder.cycle.label}` : 'Memuat data pesanan'} icon={<WalletCards className="h-4 w-4" />} maxWidth="2xl">
        {loadingOrder || !selectedOrder ? <div className="h-48 animate-pulse rounded-xl bg-slate-100" aria-busy="true" /> : <div className="space-y-6">
          <section className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3" aria-label="Saldo pesanan"><div><p className="text-xs font-semibold text-slate-500">Nilai pesanan</p><p className="mt-1 font-black tabular-nums text-slate-950">{selectedOrder.pricingPending ? 'Menunggu harga' : formatCurrency(selectedOrder.totalAmount)}</p></div><div><p className="text-xs font-semibold text-slate-500">Sudah dibayar</p><p className="mt-1 font-black tabular-nums text-emerald-800">{selectedOrder.summary.paidAmount === null ? 'Belum diketahui' : formatCurrency(selectedOrder.summary.paidAmount)}</p></div><div><p className="text-xs font-semibold text-slate-500">Sisa</p><p className="mt-1 font-black tabular-nums text-rose-800">{selectedOutstanding === null ? 'Belum diketahui' : formatCurrency(selectedOutstanding)}</p></div></section>

          {selectedOrder.summary.status === 'paid' ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><Badge variant="emerald">Lunas</Badge><p className="mt-2 text-sm text-emerald-950">Tidak ada sisa yang perlu dibayar.</p></div> : null}
          {selectedOrder.summary.status === 'unverified' ? <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>{selectedOrder.pricingPending ? 'Isi dan kunci harga minggu ini sebelum mencatat pembayaran.' : 'Saldo awal pesanan lama ini perlu diverifikasi sebelum pembayaran baru dapat dicatat.'}</p></div> : null}
          {selectedOrder.cancelledAt ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">Pesanan ini dibatalkan. Pembayaran baru tidak dapat dicatat.</div> : null}

          {canPay ? <form onSubmit={submitPayment} className="border-t border-slate-200 pt-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-extrabold text-slate-950">Catat pembayaran</h3><p className="mt-1 text-xs text-slate-500">Draf tersimpan di perangkat ini sampai berhasil dikirim.</p></div><Button type="button" size="sm" variant="subtle" onClick={() => setDraft((current) => ({ ...current, amount: selectedOutstanding ?? '' }))}>Lunasi sisa</Button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-700">Nominal<input required inputMode="decimal" value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value.replace(',', '.'), attempt: undefined }))} placeholder="Contoh: 50000" className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm tabular-nums" /></label><label className="text-xs font-bold text-slate-700">Cara bayar<select value={draft.method} onChange={(event) => setDraft((current) => ({ ...current, method: event.target.value as PaymentDraft['method'], attempt: undefined }))} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="cash">Tunai</option><option value="transfer">Transfer</option><option value="other">Lainnya</option></select></label><label className="text-xs font-bold text-slate-700 sm:col-span-2">Catatan <span className="font-normal text-slate-500">(opsional)</span><textarea value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value, attempt: undefined }))} rows={2} maxLength={1000} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label></div><div className="mt-4 flex justify-end"><Button type="submit" disabled={saving !== null} icon={<CircleDollarSign className="h-4 w-4" />}>{saving === 'payment' ? 'Menyimpan…' : 'Simpan pembayaran'}</Button></div></form> : null}

          <section className="border-t border-slate-200 pt-5" aria-labelledby="history-heading"><div className="flex items-center gap-2"><History className="h-4 w-4 text-emerald-800" /><h3 id="history-heading" className="font-extrabold text-slate-950">Riwayat pembayaran</h3></div><div className="mt-3 divide-y divide-slate-100 border-y border-slate-200">{selectedOrder.payments.map((payment) => <div key={payment.id} className={`py-3 ${payment.reversedAt ? 'opacity-60' : ''}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className={`font-black tabular-nums ${payment.reversedAt ? 'line-through text-slate-600' : 'text-slate-950'}`}>{formatCurrency(payment.amount)}</p><Badge variant={payment.reversedAt ? 'slate' : 'emerald'} size="sm">{payment.reversedAt ? 'Dibatalkan' : paymentMethodLabel(payment.method)}</Badge></div><p className="mt-1 text-xs text-slate-500">{dateTime(payment.occurredAt ?? payment.createdAt)}{payment.note ? ` · ${payment.note}` : ''}</p>{payment.reversedAt ? <p className="mt-1 text-xs font-semibold text-rose-800">Alasan: {payment.reversalReason}</p> : null}</div>{!payment.reversedAt ? <Button size="sm" variant="danger" onClick={() => { setReversingId(payment.id); setReversalReason(''); setReverseAttempt(null) }} icon={<RotateCcw className="h-3.5 w-3.5" />}>Balikkan</Button> : null}</div>{reversingId === payment.id ? <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3"><label className="text-xs font-bold text-rose-900">Alasan pembalikan<textarea autoFocus value={reversalReason} onChange={(event) => { setReversalReason(event.target.value); setReverseAttempt(null) }} rows={2} maxLength={500} className="mt-1.5 w-full rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm text-slate-900" /></label><div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => { setReversingId(null); setReversalReason('') }}>Batal</Button><Button size="sm" variant="danger" disabled={saving !== null} onClick={() => void submitReversal(payment.id)}>{saving === 'reverse' ? 'Membalikkan…' : 'Konfirmasi pembalikan'}</Button></div></div> : null}</div>)}{selectedOrder.payments.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Belum ada pembayaran untuk pesanan ini.</p> : null}</div><p className="mt-2 text-xs text-slate-500">{activePayments.length} pembayaran aktif</p></section>
        </div>}
      </Modal>
    </div>
  )
}

export default function PaymentsPage() {
  return <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-slate-200/60" />}><PaymentsContent /></Suspense>
}
