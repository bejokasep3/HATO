'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { apiGet, apiPost, newIdempotencyKey } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { useOperationalMode } from '@/components/AppShell'

type Receivable = { orderId: string; memberName: string; cycleLabel: string; outstandingAmount: string }
type Data = { items: Receivable[]; totalCount: number; totalKnownOutstanding: string; unreconciledOrderCount: number }
function PaymentsContent() {
  const params = useSearchParams()
  const cycleId = params.get('cycleId') ?? ''
  const { operationalSchema } = useOperationalMode()
  const [data, setData] = useState<Data | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const sequence = useRef(0)
  const attempts = useRef(new Map<string, { version: number; key: string }>())
  const load = useCallback(async () => {
    const request = ++sequence.current
    setLoading(true); setError('')
    try { const rows = await apiGet<Data>('/api/payments/receivables?page=' + page + '&pageSize=25' + (cycleId ? '&cycleId=' + cycleId : '')); if (request === sequence.current) { setData(rows); if (page > 1 && rows.items.length === 0) setPage((current) => current - 1) } }
    catch (cause) { if (request === sequence.current) setError(cause instanceof Error ? cause.message : 'Piutang gagal dimuat.') }
    finally { if (request === sequence.current) setLoading(false) }
  }, [page, cycleId])
  useEffect(() => { const task = window.setTimeout(() => { void load() }, 0); return () => { window.clearTimeout(task); sequence.current += 1 } }, [load])
  async function settle(orderId: string) {
    if (saving || operationalSchema !== true) return
    setSaving(orderId)
    try {
      const order = await apiGet<{ version: number }>('/api/orders/' + orderId + '/payments')
      const previous = attempts.current.get(orderId)
      const attempt = previous?.version === order.version ? previous : { version: order.version, key: newIdempotencyKey() }
      attempts.current.set(orderId, attempt)
      await apiPost('/api/orders/' + orderId + '/settle', { expectedVersion: attempt.version }, { idempotencyKey: attempt.key })
      attempts.current.delete(orderId)
      toast.success('Pesanan lunas dan dikeluarkan dari piutang.')
      await load()
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Pembayaran gagal dicatat.') }
    finally { setSaving(null) }
  }
  return <div className="mx-auto max-w-6xl space-y-6"><header className="flex flex-wrap justify-between gap-4 border-b border-slate-200 pb-5"><div><h1 className="text-2xl font-black">Piutang</h1><p className="mt-2 text-sm text-slate-600">Hanya pesanan yang belum lunas. Pembayaran dilakukan penuh, tanpa cicilan.</p></div><Button variant="secondary" disabled={loading} onClick={() => void load()}>Muat ulang</Button></header>
    {error ? <p role="alert" className="text-rose-800">{error}</p> : null}
    <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-600">Total belum dibayar</p><p className="mt-1 text-2xl font-black text-rose-800">{data ? formatCurrency(data.totalKnownOutstanding) : '—'}</p></div>
    {data?.unreconciledOrderCount ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{data.unreconciledOrderCount} pesanan lama belum memiliki status pembayaran terverifikasi. Periksa melalui Pesanan.</p> : null}
    {loading ? <p role="status">Memuat piutang…</p> : <div className="divide-y divide-slate-200 border-y border-slate-200">{data?.items.map((item) => <article key={item.orderId} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><h2 className="font-bold">{item.memberName}</h2><p className="mt-1 text-xs text-slate-600">{item.cycleLabel}</p></div><div className="flex items-center gap-4"><p className="font-black text-rose-800">{formatCurrency(item.outstandingAmount)}</p><Button disabled={Boolean(saving) || operationalSchema !== true} onClick={() => void settle(item.orderId)}>{saving === item.orderId ? 'Menyimpan…' : 'Tandai lunas'}</Button></div></article>)}{!data?.items.length && !error ? <p className="py-8 text-center text-slate-600">Tidak ada piutang pada pilihan ini.</p> : null}</div>}
    {(data?.totalCount ?? 0) > 25 ? <div className="flex justify-between"><Button disabled={page === 1 || loading} onClick={() => setPage((current) => current - 1)}>Sebelumnya</Button><span>Halaman {page}</span><Button disabled={page * 25 >= (data?.totalCount ?? 0) || loading} onClick={() => setPage((current) => current + 1)}>Berikutnya</Button></div> : null}
    <Link href={'/orders' + (cycleId ? '?cycleId=' + cycleId : '')} className="inline-flex min-h-11 items-center font-bold text-emerald-800">Kelola pesanan dan status pembayaran</Link>
  </div>
}
export default function PaymentsPage() { return <Suspense fallback={<p>Memuat piutang…</p>}><PaymentsContent /></Suspense> }
