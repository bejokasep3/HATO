'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiGet } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'

type Cycle = { id: string; label: string }
type Target = { groupCode: string; unit: string; target: string | null; demand: string | null }
type Detail = { targets: Target[] }

function InventoryContent() {
  const params = useSearchParams()
  const router = useRouter()
  const requested = params.get('cycleId') ?? ''
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [cycleId, setCycleId] = useState(requested)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const sequence = useRef(0)
  const load = useCallback(async (id: string) => {
    const request = ++sequence.current
    setLoading(true); setError(''); setDetail(null)
    try {
      const response = await apiGet<{ operational: Detail }>('/api/cycles/' + id)
      if (request === sequence.current) setDetail(response.operational)
    } catch (cause) { if (request === sequence.current) setError(cause instanceof Error ? cause.message : 'Data barang gagal dimuat.') }
    finally { if (request === sequence.current) setLoading(false) }
  }, [])
  useEffect(() => {
    let active = true
    apiGet<Cycle[]>('/api/cycles').then((rows) => {
      if (!active) return
      setCycles(rows)
      const id = requested || rows[0]?.id || ''
      setCycleId(id)
      if (id) void load(id); else setLoading(false)
    }).catch((cause: unknown) => { if (active) { setError(cause instanceof Error ? cause.message : 'Daftar siklus gagal dimuat.'); setLoading(false) } })
    return () => { active = false; sequence.current += 1 }
  }, [requested, load])
  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5"><div><h1 className="text-2xl font-black text-slate-950">Barang dan sisa target</h1><p className="mt-2 text-sm text-slate-600">Target minggu adalah jumlah barang datang. Sisa dihitung per kelompok, tanpa input penerimaan tambahan.</p></div><label className="text-sm font-bold">Siklus<select value={cycleId} onChange={(event) => router.replace('/inventory?cycleId=' + event.target.value)} className="ml-3 min-h-11 rounded-lg border border-slate-300 px-3">{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.label}</option>)}</select></label></header>
    {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">{error}<Button className="ml-3" variant="secondary" onClick={() => void load(cycleId)}>Coba lagi</Button></div> : null}
    {loading ? <p role="status">Memuat barang…</p> : detail ? <section className="grid gap-4 sm:grid-cols-2">{detail.targets.map((target) => {
      const remaining = target.target !== null && target.demand !== null ? Number(target.target) - Number(target.demand) : null
      return <article key={target.groupCode} className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-extrabold">{target.groupCode === 'AYAM' ? 'Ayam' : 'Tahu'}</h2><dl className="mt-4 space-y-3"><div className="flex justify-between gap-3"><dt>Barang datang / target</dt><dd className="font-bold">{target.target === null ? 'Belum diisi' : Number(target.target).toLocaleString('id-ID') + ' ' + target.unit}</dd></div><div className="flex justify-between gap-3"><dt>Jumlah pesanan</dt><dd className="font-bold">{target.demand === null ? 'Belum diketahui' : Number(target.demand).toLocaleString('id-ID') + ' ' + target.unit}</dd></div><div className="flex justify-between gap-3 border-t border-slate-200 pt-3"><dt>{remaining !== null && remaining < 0 ? 'Pesanan melebihi barang' : 'Sisa untuk dipesan'}</dt><dd className={'font-black ' + (remaining !== null && remaining < 0 ? 'text-rose-800' : 'text-emerald-800')}>{remaining === null ? 'Belum diketahui' : Math.abs(remaining).toLocaleString('id-ID') + ' ' + target.unit}</dd></div></dl></article>
    })}</section> : !error ? <p>Belum ada siklus.</p> : null}
    {cycleId ? <div className="flex flex-wrap gap-5"><Link href={'/cycles/' + cycleId} className="inline-flex min-h-11 items-center font-bold text-emerald-800">Ubah target / barang datang</Link><Link href={'/orders?cycleId=' + cycleId} className="inline-flex min-h-11 items-center font-bold text-emerald-800">Kelola pesanan</Link></div> : null}
  </div>
}
export default function InventoryPage() { return <Suspense fallback={<p>Memuat barang…</p>}><InventoryContent /></Suspense> }
