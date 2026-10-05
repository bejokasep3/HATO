'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, CircleDollarSign,
  ClipboardList, Clock3, PackageCheck, Plus, RefreshCw, ShoppingBasket, Users,
} from 'lucide-react'
import { apiGet } from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useOperationalMode } from '@/components/AppShell'

type CycleSummary = {
  id: string
  label: string
  periodStart: string
  periodEnd: string | null
  supplierDeadline: string | null
  deliveryDate: string
  periodState: 'draft' | 'open' | 'closed' | null
  status: string
  version?: number
  rulesVersion: number
  recapConfirmedAt?: string | null
  receiptStatus?: string
}

type TargetSummary = {
  groupCode: 'AYAM' | 'TAHU'
  unit: string
  target: string | null
  demand: string | null
  status: 'known' | 'unknown'
  progress: null | {
    percentage: number | null
    shortfall: string
    excess: string
    plannedPurchase: string
  }
}

type DashboardData = {
  variants?: Array<{ productId: string; productName: string; unit: string; groupCode: string; demand: string }>
  variantsUnavailable?: boolean
  hasCycle: boolean
  allCycles: CycleSummary[]
  currentCycle: CycleSummary | null
  targets: TargetSummary[]
  rotation: null | {
    scheduledCount: number
    orderedCount: number
    pendingMembers: Array<{ id: string; name: string; groupName: string; role: string; isOrdered: boolean }>
    members: Array<{ id: string; name: string; groupName: string; role: string; isOrdered: boolean }>
  }
  finances: null | {
    orderCount: number
    orderValue: string
    receivedPayments: string
    knownOutstanding: string
    unknownBalanceCount: number
    totalIncomplete: boolean
    purchaseValue: string | null
  }
  recentOrders: Array<{
    id: string
    memberName: string
    groupName: string
    totalAmount: string
    paymentSummary: { status: string; paidAmount: string | null; outstandingAmount: string | null }
    orderStatus: string
    createdAt: string
    itemCount: number
  }>
  totalMembers: number
}

function withCycle(path: string, cycleId: string) {
  return `${path}${path.includes('?') ? '&' : '?'}cycleId=${encodeURIComponent(cycleId)}`
}

function phaseLabel(state: CycleSummary['periodState']) {
  if (state === 'draft') return 'Draf'
  if (state === 'open') return 'Dibuka'
  if (state === 'closed') return 'Ditutup'
  return 'Perlu verifikasi'
}

function nextAction(cycle: CycleSummary) {
  if (cycle.periodState === 'closed') {
    return { title: 'Ringkasan minggu yang ditutup', detail: 'Lihat pesanan historis dan rincian tagihan pada minggu ini.', href: '/payments', label: 'Periksa piutang', icon: CircleDollarSign }
  }
  if (cycle.periodState === 'draft') {
    return { title: 'Siapkan minggu ini', detail: 'Periksa target dan harga, lalu buka siklus untuk menerima pesanan.', href: `/cycles/${cycle.id}`, label: 'Buka pengaturan', icon: ClipboardList }
  }
  if (!cycle.recapConfirmedAt) {
    return { title: 'Pesanan dan rekap supplier', detail: 'Input pesanan yang masuk. Pada Selasa, periksa pembagian tiap varian lalu konfirmasi rekap.', href: `/cycles/${cycle.id}`, label: 'Periksa rekap', icon: ShoppingBasket }
  }
  if (cycle.receiptStatus !== 'confirmed') {
    return { title: 'Catat barang datang', detail: 'Rekap sudah terkunci. Pada Kamis, catat jumlah diterima, rusak, dan harga beli.', href: '/inventory', label: 'Buka penerimaan', icon: PackageCheck }
  }
  return { title: 'Distribusi dan pembayaran', detail: 'Barang sudah diterima. Pantau pengiriman dan cicilan yang masih berjalan.', href: '/orders', label: 'Lihat pesanan', icon: CircleDollarSign }
}

function TargetPanel({ target, variants }: { target: TargetSummary; variants: NonNullable<DashboardData['variants']> }) {
  const title = target.groupCode === 'AYAM' ? 'Ayam' : 'Tahu'
  if (target.status === 'unknown' || !target.progress || target.target === null || target.demand === null) {
    return (
      <div className="border-t border-slate-200 p-5 first:border-t-0 @2xl:border-l @2xl:border-t-0 @2xl:first:border-l-0">
        <div className="flex items-center justify-between gap-3">
          <div><p className="font-bold text-slate-900">{title}</p><p className="mt-1 text-xs text-slate-500">Target histori belum diverifikasi</p></div>
          <Badge variant="slate">Belum diketahui</Badge>
        </div>
      </div>
    )
  }

  const percentage = target.progress.percentage
  const reached = Number(target.progress.shortfall) === 0
  const untargeted = percentage === null
  return (
    <div className="border-t border-slate-200 p-5 first:border-t-0 @2xl:border-l @2xl:border-t-0 @2xl:first:border-l-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-slate-950">{title}</p>
          <p className="mt-1 text-sm text-slate-600"><span className="text-2xl font-black tabular-nums text-slate-950">{Number(target.demand).toLocaleString('id-ID')}</span><span className="ml-1">dari {Number(target.target).toLocaleString('id-ID')} {target.unit}</span></p>
        </div>
        <Badge variant={untargeted ? 'slate' : reached ? 'emerald' : 'amber'}>
          {untargeted ? 'Tidak ditargetkan' : reached ? (Number(target.progress.excess) > 0 ? `Lebih ${Number(target.progress.excess).toLocaleString('id-ID')} ${target.unit}` : 'Target tercapai') : `Kurang ${Number(target.progress.shortfall).toLocaleString('id-ID')} ${target.unit}`}
        </Badge>
      </div>
      {!untargeted ? (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200" aria-label={`Kemajuan ${title} ${percentage}%`}>
            <div className={`h-full rounded-full ${reached ? 'bg-emerald-700' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, percentage)}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>Rencana beli minimal {Number(target.progress.plannedPurchase).toLocaleString('id-ID')} {target.unit}</span>
            <span className="font-bold tabular-nums text-slate-700">{percentage}%</span>
          </div>
        </div>
      ) : null}
      {variants.length > 0 ? <dl className="mt-4 divide-y divide-slate-100 border-t border-slate-200">{variants.map((variant) => <div key={variant.productId} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><dt className="text-slate-600">{variant.productName}</dt><dd className="font-semibold tabular-nums text-slate-900">{Number(variant.demand).toLocaleString('id-ID')} {variant.unit}</dd></div>)}</dl> : null}
    </div>
  )
}

function DashboardContent() {
  const { operationalSchema } = useOperationalMode()
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedCycleId = searchParams.get('cycleId')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (cycleId?: string | null) => {
    setError('')
    setLoading(true)
    try {
      const query = cycleId ? `?cycleId=${encodeURIComponent(cycleId)}` : ''
      const result = await apiGet<DashboardData>(`/api/dashboard${query}`)
      if (result.currentCycle) {
        try {
          const recap = await apiGet<{ items: NonNullable<DashboardData['variants']> }>(`/api/cycles/${result.currentCycle.id}/supplier-recap`)
          result.variants = recap.items
        } catch { result.variantsUnavailable = true }
      }
      setData(result)
      if (!cycleId && result.currentCycle) router.replace(`/?cycleId=${encodeURIComponent(result.currentCycle.id)}`, { scroll: false })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Dashboard gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const task = window.setTimeout(() => { void load(requestedCycleId) }, 0)
    return () => window.clearTimeout(task)
  }, [load, requestedCycleId])
  const cycle = data?.currentCycle ?? null
  const action = useMemo(() => cycle ? nextAction(cycle) : null, [cycle])

  if (loading && !data) {
    return <div className="space-y-4" aria-busy="true" aria-label="Memuat ringkasan minggu"><div className="h-24 animate-pulse rounded-xl bg-slate-200/70" /><div className="h-44 animate-pulse rounded-xl bg-slate-200/60" /><div className="grid gap-4 lg:grid-cols-3"><div className="h-64 animate-pulse rounded-xl bg-slate-200/50 lg:col-span-2" /><div className="h-64 animate-pulse rounded-xl bg-slate-200/50" /></div></div>
  }

  if (error && !data) {
    return (
      <div className="mx-auto mt-16 max-w-lg rounded-xl border border-rose-200 bg-white p-6 text-center">
        <AlertTriangle className="mx-auto h-7 w-7 text-rose-700" />
        <h1 className="mt-3 text-lg font-bold text-slate-950">Ringkasan belum dapat dimuat</h1>
        <p className="mt-2 text-sm text-slate-600">{error}</p>
        <Button className="mt-5" onClick={() => void load(requestedCycleId)} icon={<RefreshCw className="h-4 w-4" />}>Coba lagi</Button>
      </div>
    )
  }

  if (!data?.hasCycle || !cycle || !action) {
    return (
      <section className="mx-auto mt-12 max-w-2xl border-y border-slate-200 py-12 text-center">
        <CalendarDays className="mx-auto h-8 w-8 text-emerald-800" />
        <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-950">Mulai minggu pertama</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Buat siklus Senin–Minggu, tentukan target ayam dan tahu, lalu isi harga yang berlaku minggu tersebut.</p>
        <Link href="/cycles" className="mt-6 inline-flex"><Button size="lg" icon={<Plus className="h-4 w-4" />}>Buat siklus</Button></Link>
      </section>
    )
  }

  const ActionIcon = action.icon
  const rotation = data.rotation
  const finances = data.finances
  const cycleHref = (path: string) => withCycle(path, cycle.id)

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-950">{cycle.label}</h1>
              <Badge variant={cycle.periodState === 'open' ? 'emerald' : cycle.periodState === 'draft' ? 'amber' : 'slate'} dot>{phaseLabel(cycle.periodState)}</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-600">{formatDate(cycle.periodStart)} sampai {formatDate(cycle.periodEnd ?? cycle.deliveryDate)}</p>
          </div>
          <div className="flex w-full flex-col gap-2 @3xl:w-auto @3xl:flex-row @3xl:items-center shrink-0">
            <label htmlFor="cycle-context" className="sr-only">Pilih minggu kerja</label>
            <select id="cycle-context" value={cycle.id} onChange={(event) => router.replace(`/?cycleId=${encodeURIComponent(event.target.value)}`)} disabled={loading} className="min-h-11 min-w-0 max-w-full rounded-lg border border-slate-500 bg-slate-50 px-3 text-sm font-semibold text-slate-800 focus:border-emerald-700">
              {data.allCycles.map((item) => <option key={item.id} value={item.id}>{item.label} · {phaseLabel(item.periodState)}</option>)}
            </select>
            <Button disabled={operationalSchema !== true || cycle.periodState !== 'open'} onClick={() => router.push(cycleHref('/orders?new=1'))} className="w-full @3xl:w-auto whitespace-nowrap" icon={<Plus className="h-4 w-4" />}>Input pesanan</Button>
          </div>
        </div>
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-4 rounded-b-xl border-t border-slate-200 bg-slate-50 px-5 py-4">{[{ label: 'Awal minggu', date: cycle.periodStart }, { label: 'Rekap supplier', date: cycle.supplierDeadline }, { label: 'Barang tiba', date: cycle.deliveryDate }].map((stage) => <div key={stage.label}><dt className="text-xs font-semibold text-slate-500">{stage.label}</dt><dd className="mt-1 text-sm font-bold text-slate-900">{stage.date ? formatDate(stage.date, { weekday: 'long', day: 'numeric', month: 'short' }) : 'Belum ditetapkan'}</dd></div>)}</dl>
        {error ? <p className="px-5 py-3 text-sm font-medium text-rose-700" role="alert">Data lama masih ditampilkan. {error}</p> : null}
      </header>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-labelledby="target-heading">
        <div className="border-b border-slate-200 p-5 sm:col-span-2 sm:flex sm:items-center sm:justify-between">
          <div><h2 id="target-heading" className="text-lg font-extrabold text-slate-950">Target dan permintaan</h2><p className="mt-1 text-sm text-slate-600">Target adalah pembelian minimum. Pesanan tetap boleh melewati target.</p></div>
          <Link href={cycleHref(`/cycles/${cycle.id}`)} className="mt-3 inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-bold text-emerald-800 hover:text-emerald-950 sm:mt-0">Atur target dan rekap <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="grid @2xl:grid-cols-2">{data.targets.map((target) => <TargetPanel key={target.groupCode} target={target} variants={(data.variants ?? []).filter((variant) => variant.groupCode === target.groupCode)} />)}</div>
        {data.variantsUnavailable ? <p className="border-t border-slate-200 px-5 py-3 text-xs text-amber-900">Rincian varian belum dapat dimuat. Target gabungan tetap ditampilkan.</p> : null}
      </section>

      <div className="grid items-start gap-6 @4xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="rotation-heading">
          <div>
            <div className="flex items-center justify-between gap-3"><div><h2 id="rotation-heading" className="font-extrabold text-slate-950">Giliran anggota</h2>{rotation && rotation.scheduledCount > 0 ? <p className="mt-1 text-sm text-slate-600">{rotation.orderedCount} dari {rotation.scheduledCount} anggota sudah memesan</p> : null}</div><Users className="h-5 w-5 shrink-0 text-slate-500" /></div>
            <div className="mt-4 divide-y divide-slate-100 border-y border-slate-200">
              {rotation?.pendingMembers.slice(0, 5).map((member) => <div key={member.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{member.name}</p><p className="truncate text-xs text-slate-500">{member.groupName}</p></div><Badge variant="amber" size="sm"><Clock3 className="h-3 w-3" /> Belum pesan</Badge></div>)}
              {rotation && rotation.scheduledCount > 0 && rotation.pendingMembers.length === 0 ? <div className="flex items-center gap-2 py-4 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Semua anggota giliran sudah memesan.</div> : null}
              {!rotation || rotation.scheduledCount === 0 ? <p className="py-4 text-sm text-slate-500">Belum ada anggota yang dijadwalkan.</p> : null}
            </div>
          </div>
        </section>

      <section className="@container/orders rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="recent-heading">
        <div className="flex items-center justify-between gap-3"><div><h2 id="recent-heading" className="font-extrabold text-slate-950">Pesanan terbaru</h2><p className="mt-1 text-sm text-slate-600">Lima input terakhir. Pilih pesanan untuk melihat pembayaran.</p></div><Link href={cycleHref('/orders')} className="inline-flex min-h-11 items-center text-sm font-bold text-emerald-800">Semua</Link></div>
        <div className="mt-4 divide-y divide-slate-100 border-y border-slate-200">
          {data.recentOrders.map((order) => (
            <Link key={order.id} href={cycleHref(`/payments?orderId=${encodeURIComponent(order.id)}`)} className="grid min-h-11 gap-2 py-3 text-sm hover:bg-slate-50 @lg/orders:grid-cols-[minmax(0,1fr)_auto_auto] @lg/orders:items-center @lg/orders:px-2">
              <div className="min-w-0"><p className="truncate font-bold text-slate-900">{order.memberName}</p><p className="truncate text-xs text-slate-500">{order.groupName} · {order.itemCount} produk</p></div>
              <span className="font-extrabold tabular-nums text-slate-950">{formatCurrency(order.totalAmount)}</span>
              <Badge variant={order.paymentSummary.status === 'paid' ? 'emerald' : order.paymentSummary.status === 'unverified' ? 'slate' : 'amber'} size="sm">{order.paymentSummary.status === 'partial' ? 'Cicilan' : order.paymentSummary.status === 'paid' ? 'Lunas' : order.paymentSummary.status === 'unverified' ? 'Belum diverifikasi' : 'Belum bayar'}</Badge>
            </Link>
          ))}
          {data.recentOrders.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Belum ada pesanan pada minggu ini.</p> : null}
        </div>
      </section>
        </div>

        <div className="min-w-0 space-y-6">
        <aside className="rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="finance-heading">
          <div className="flex items-center justify-between gap-3"><h2 id="finance-heading" className="font-extrabold text-slate-950">Uang masuk dan piutang</h2><CircleDollarSign className="h-5 w-5 shrink-0 text-emerald-800" /></div>
          {finances ? (
            <dl className="mt-4">
              <div className="border-y border-slate-200 bg-slate-50 px-3 py-3"><dt className="text-xs font-semibold text-slate-600">Nilai pesanan</dt><dd className="mt-1 text-xl font-black tabular-nums text-slate-950 [overflow-wrap:anywhere]">{formatCurrency(finances.orderValue)}</dd><p className="mt-1 text-xs text-slate-600">{finances.orderCount} pesanan aktif</p></div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,140px),1fr))] gap-3 py-4">
                <div className="rounded-lg bg-emerald-50 p-3"><dt className="text-xs font-semibold text-emerald-900">Pembayaran diterima</dt><dd className="mt-1 font-extrabold tabular-nums text-emerald-950 [overflow-wrap:anywhere]">{formatCurrency(finances.receivedPayments)}</dd></div>
                <div className="rounded-lg bg-rose-50 p-3"><dt className="text-xs font-semibold text-rose-900">Sisa diketahui</dt><dd className="mt-1 font-extrabold tabular-nums text-rose-950 [overflow-wrap:anywhere]">{formatCurrency(finances.knownOutstanding)}</dd></div>
              </div>
              <div className="border-y border-slate-200 py-3"><dt className="text-xs font-semibold text-slate-600">Nilai pembelian terkonfirmasi</dt><dd className="mt-1 text-sm font-bold tabular-nums text-slate-900 [overflow-wrap:anywhere]">{finances.purchaseValue === null ? 'Belum diketahui' : formatCurrency(finances.purchaseValue)}</dd></div>
            </dl>
          ) : <p className="mt-4 text-sm text-slate-600">Ringkasan keuangan belum tersedia.</p>}
          {finances?.totalIncomplete ? <div className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{finances.unknownBalanceCount} saldo pesanan lama belum diverifikasi. Total piutang belum lengkap.</span></div> : null}
          <Link href={cycleHref('/payments')} className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-emerald-800 hover:text-emerald-950">Buka rincian pembayaran</Link>
        </aside>

        <section className="rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="workflow-heading">
          <h2 id="workflow-heading" className="font-extrabold text-slate-950">Alur kerja minggu ini</h2>
          <div className="mt-4 flex items-start gap-2"><ActionIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-800" /><h3 className="text-sm font-bold text-slate-950">{action.title}</h3></div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{action.detail}</p>
          <Link href={cycleHref(action.href)} className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900 hover:bg-emerald-100">{action.label}<ArrowRight className="h-4 w-4 shrink-0" /></Link>
          <nav aria-label="Tahapan kerja minggu ini" className="mt-3 divide-y divide-slate-200 border-t border-slate-200">
            {[{ href: '/orders', label: 'Pesanan anggota' }, { href: `/cycles/${cycle.id}`, label: 'Rekap supplier' }, { href: '/inventory', label: 'Penerimaan barang' }].filter((step) => step.href !== action.href).map((step) => <Link key={step.href} href={cycleHref(step.href)} className="flex min-h-11 items-center justify-between gap-3 py-3 text-sm font-semibold text-slate-700 hover:text-emerald-900">{step.label}<ArrowRight className="h-4 w-4 shrink-0" /></Link>)}
          </nav>
        </section>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-slate-200/60" />}><DashboardContent /></Suspense>
}
