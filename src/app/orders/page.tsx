'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Plus, RefreshCw, Search, ShoppingBasket } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPost, newIdempotencyKey } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useOperationalMode } from '@/components/AppShell'
import { sumMoney } from '@/lib/domain/money'

type CycleItem = { id: string; label: string; periodState: 'draft' | 'open' | 'closed' | null }
type Member = { id: string; name: string; phone: string; group?: { name: string }; groupName?: string }
type Product = { id: string; name: string; unit: string; isActive: boolean }
type Price = { productId: string; consumerPrice: number; traderPrice: number; product: Product }
type Availability = { items: Array<{ productId: string; availableToOrder: string | null; shortage: string | null; source: 'planned' | 'received' | 'unknown' }> }
type Order = {
  id: string; cycleId: string; memberId: string; totalAmount: string; orderStatus: string; version: number
  cancelledAt: string | null; createdAt: string
  member: Member & { group?: { name: string } }
  items: Array<{ id: string; productId: string; quantity: string; unitPrice: string; subtotal: string; priceType?: 'consumer' | 'trader'; product: Product }>
  paymentSummary: { status: 'unverified' | 'unpaid' | 'partial' | 'paid'; paidAmount: string | null; outstandingAmount: string | null }
}

type Draft = {
  memberId: string
  memberSearch: string
  priceType: 'consumer' | 'trader'
  quantities: Record<string, string>
  notes: string
  attempt?: { signature: string; key: string }
}

function draftKey(cycleId: string) { return `hato-order-draft:${cycleId}` }

function parseHundredths(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}

function previewSubtotal(price: number, quantity: string) {
  const quantityHundredths = parseHundredths(quantity)
  if (quantityHundredths === null) return 0
  const cents = BigInt(Math.round(price * 100))
  return Number((cents * quantityHundredths + 50n) / 100n) / 100
}

function paymentLabel(status: Order['paymentSummary']['status']) {
  if (status === 'paid') return 'Lunas'
  if (status === 'partial') return 'Cicilan'
  if (status === 'unverified') return 'Belum diverifikasi'
  return 'Belum bayar'
}

function OrderPaymentBadge({ order }: { order: Order }) {
  return <Badge variant={order.paymentSummary.status === 'paid' ? 'emerald' : order.paymentSummary.status === 'unverified' ? 'slate' : 'amber'}>{paymentLabel(order.paymentSummary.status)}</Badge>
}

function deliveryLabel(order: Order) {
  if (order.cancelledAt) return 'Dibatalkan'
  return ({ pending: 'Menunggu', confirmed: 'Dikonfirmasi', shipped: 'Dikirim', delivered: 'Diterima' } as Record<string, string>)[order.orderStatus] ?? 'Belum diketahui'
}

function OrderItems({ order }: { order: Order }) {
  return <ul className="space-y-2">{order.items.map((item) => <li key={item.id}>
    <p className="font-semibold text-slate-900">{item.product.name}</p>
    <p className="mt-0.5 text-xs text-slate-600">{Number(item.quantity).toLocaleString('id-ID')} {item.product.unit} × {formatCurrency(item.unitPrice)}{item.priceType ? ` · ${item.priceType === 'trader' ? 'Pedagang' : 'Konsumen'}` : ''}</p>
  </li>)}</ul>
}

function OrdersContent() {
  const { operationalSchema } = useOperationalMode()
  const canMutate = operationalSchema === true
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryCycleId = searchParams.get('cycleId')
  const [cycles, setCycles] = useState<CycleItem[]>([])
  const [cycleId, setCycleId] = useState(queryCycleId ?? '')
  const [orders, setOrders] = useState<Order[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [prices, setPrices] = useState<Price[]>([])
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [loading, setLoading] = useState(true)
  const [formLoading, setFormLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'open' | 'paid' | 'unverified'>('all')
  const [orderSearch, setOrderSearch] = useState('')
  const [memberId, setMemberId] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [priceType, setPriceType] = useState<'consumer' | 'trader'>('consumer')
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const pendingAttempt = useRef<{ signature: string; key: string } | null>(null)
  const openedFromUrl = useRef(false)
  const cycleLoadSequence = useRef(0)

  const loadBase = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [cycleRows, memberRows, productRows] = await Promise.all([
        apiGet<CycleItem[]>('/api/cycles'), apiGet<Member[]>('/api/members?active=true'), apiGet<Product[]>('/api/products?active=true'),
      ])
      setCycles(cycleRows)
      setMembers(memberRows)
      setProducts(productRows)
      setCycleId((current) => current || cycleRows.find((cycle) => cycle.periodState === 'open')?.id || cycleRows[0]?.id || '')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Data pesanan gagal dimuat.') }
    finally { setLoading(false) }
  }, [])

  const loadCycle = useCallback(async (selectedCycleId: string) => {
    if (!selectedCycleId) return
    const sequence = ++cycleLoadSequence.current
    setFormLoading(true)
    setError('')
    setOrders([])
    try {
      const [orderRows, priceRows, availabilityResult] = await Promise.all([
        apiGet<Order[]>(`/api/orders?cycleId=${encodeURIComponent(selectedCycleId)}`),
        apiGet<Price[]>(`/api/cycles/${selectedCycleId}/prices`),
        apiGet<Availability>(`/api/cycles/${selectedCycleId}/availability`).catch(() => null),
      ])
      if (sequence !== cycleLoadSequence.current) return
      setOrders(orderRows)
      setPrices(priceRows)
      setAvailability(availabilityResult)
    } catch (cause) { if (sequence === cycleLoadSequence.current) setError(cause instanceof Error ? cause.message : 'Pesanan minggu ini gagal dimuat.') }
    finally { if (sequence === cycleLoadSequence.current) setFormLoading(false) }
  }, [])

  useEffect(() => { const task = window.setTimeout(() => { void loadBase() }, 0); return () => window.clearTimeout(task) }, [loadBase])
  useEffect(() => {
    if (!cycleId) return
    const task = window.setTimeout(() => { void loadCycle(cycleId) }, 0)
    router.replace(`/orders?cycleId=${encodeURIComponent(cycleId)}`, { scroll: false })
    return () => window.clearTimeout(task)
  }, [cycleId, loadCycle, router])

  useEffect(() => {
    if (!cycleId) return
    const task = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(draftKey(cycleId))
        if (!raw) { setMemberId(''); setMemberSearch(''); setQuantities({}); setNotes(''); pendingAttempt.current = null; return }
        const draft = JSON.parse(raw) as Draft
        setMemberId(draft.memberId || '')
        setMemberSearch(draft.memberSearch || '')
        setPriceType(draft.priceType || 'consumer')
        setQuantities(draft.quantities || {})
        setNotes(draft.notes || '')
        pendingAttempt.current = draft.attempt ?? null
      } catch { localStorage.removeItem(draftKey(cycleId)) }
    }, 0)
    return () => window.clearTimeout(task)
  }, [cycleId])

  useEffect(() => {
    if (!cycleId) return
    const draft: Draft = { memberId, memberSearch, priceType, quantities, notes, attempt: pendingAttempt.current ?? undefined }
    localStorage.setItem(draftKey(cycleId), JSON.stringify(draft))
  }, [cycleId, memberId, memberSearch, priceType, quantities, notes])

  useEffect(() => {
    if (!openedFromUrl.current && searchParams.get('new') === '1' && cycleId) {
      openedFromUrl.current = true
      setOpen(true)
    }
  }, [cycleId, searchParams])

  const selectedCycle = cycles.find((cycle) => cycle.id === cycleId)
  const existingMemberIds = useMemo(() => new Set(orders.filter((order) => !order.cancelledAt).map((order) => order.memberId)), [orders])
  const filteredMembers = useMemo(() => {
    const needle = memberSearch.trim().toLocaleLowerCase('id-ID')
    return members.filter((member) => !needle || member.name.toLocaleLowerCase('id-ID').includes(needle) || (member.group?.name ?? member.groupName ?? '').toLocaleLowerCase('id-ID').includes(needle)).slice(0, 20)
  }, [memberSearch, members])
  const priceByProduct = useMemo(() => new Map(prices.map((price) => [price.productId, price])), [prices])
  const availabilityByProduct = useMemo(() => new Map(availability?.items.map((item) => [item.productId, item]) ?? []), [availability])
  const activeProducts = products.filter((product) => priceByProduct.has(product.id))
  const total = activeProducts.reduce((sum, product) => {
    const price = priceByProduct.get(product.id)
    return sum + (price ? previewSubtotal(priceType === 'consumer' ? price.consumerPrice : price.traderPrice, quantities[product.id] ?? '') : 0)
  }, 0)

  const summary = useMemo(() => {
    const active = orders.filter((order) => !order.cancelledAt)
    return {
      count: active.length,
      value: sumMoney(active.map((order) => order.totalAmount)),
      received: sumMoney(active.flatMap((order) => order.paymentSummary.paidAmount === null ? [] : [order.paymentSummary.paidAmount])),
      outstanding: sumMoney(active.flatMap((order) => order.paymentSummary.outstandingAmount === null ? [] : [order.paymentSummary.outstandingAmount])),
      unknownCount: active.filter((order) => order.paymentSummary.paidAmount === null || order.paymentSummary.outstandingAmount === null).length,
    }
  }, [orders])

  const filteredOrders = orders.filter((order) => {
    if (paymentFilter !== 'all' && order.cancelledAt) return false
    const needle = orderSearch.trim().toLocaleLowerCase('id-ID')
    const searchable = [order.member.name, order.member.phone, order.member.group?.name ?? order.member.groupName ?? '', ...order.items.map((item) => item.product.name)].join(' ').toLocaleLowerCase('id-ID')
    if (needle && !searchable.includes(needle)) return false
    if (paymentFilter === 'paid') return order.paymentSummary.status === 'paid'
    if (paymentFilter === 'unverified') return order.paymentSummary.status === 'unverified'
    if (paymentFilter === 'open') return order.paymentSummary.status === 'unpaid' || order.paymentSummary.status === 'partial'
    return true
  })

  function clearDraft(keepOpen: boolean) {
    setMemberId('')
    setMemberSearch('')
    setQuantities({})
    setNotes('')
    pendingAttempt.current = null
    if (cycleId) localStorage.removeItem(draftKey(cycleId))
    if (!keepOpen) setOpen(false)
  }

  async function submit(continueEntry: boolean) {
    if (!canMutate || !cycleId || !memberId || selectedCycle?.periodState !== 'open') return
    let items: Array<{ productId: string; quantity: string; priceType: 'consumer' | 'trader' }>
    try {
      items = activeProducts.flatMap((product) => {
        const value = quantities[product.id]?.trim().replace(',', '.')
        if (!value) return []
        const parsed = parseHundredths(value)
        if (parsed === null || parsed <= 0n || (product.unit === 'bungkus' && parsed % 100n !== 0n)) throw new Error(`Jumlah ${product.name} tidak valid.`)
        const stock = availabilityByProduct.get(product.id)
        if (stock?.availableToOrder !== null && stock?.availableToOrder !== undefined && Number(value) > Number(stock.availableToOrder)) throw new Error(`${product.name} hanya tersedia ${Number(stock.availableToOrder).toLocaleString('id-ID')} ${product.unit}.`)
        return [{ productId: product.id, quantity: value, priceType }]
      })
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Jumlah produk tidak valid.')
      return
    }
    if (!items.length) { toast.error('Isi jumlah minimal satu produk.'); return }
    if (items.some((item) => {
      const price = priceByProduct.get(item.productId)
      return !price || (item.priceType === 'consumer' ? price.consumerPrice : price.traderPrice) <= 0
    })) { toast.error('Ada harga yang belum siap. Muat ulang sebelum menyimpan.'); return }
    const body = { cycleId, memberId, items, notes: notes.trim() || null }
    const signature = JSON.stringify(body)
    if (pendingAttempt.current?.signature !== signature) pendingAttempt.current = { signature, key: newIdempotencyKey() }
    localStorage.setItem(draftKey(cycleId), JSON.stringify({ memberId, memberSearch, priceType, quantities, notes, attempt: pendingAttempt.current } satisfies Draft))
    setSubmitting(true)
    try {
      await apiPost('/api/orders', body, { idempotencyKey: pendingAttempt.current.key })
      toast.success('Pesanan tersimpan.')
      clearDraft(continueEntry)
      await loadCycle(cycleId)
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Pesanan gagal disimpan. Draf tetap tersedia.') }
    finally { setSubmitting(false) }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 @4xl:flex-row @4xl:items-center @4xl:justify-between">
        <div><h1 className="text-2xl font-extrabold tracking-tight text-slate-950">Manajemen pesanan</h1><p className="mt-2 text-sm text-slate-600">Periksa rincian barang, pembayaran, dan pengiriman pada minggu yang dipilih.</p></div>
        <div className="flex shrink-0 flex-col gap-2 @xl:flex-row"><label htmlFor="order-cycle" className="sr-only">Pilih siklus</label><select id="order-cycle" value={cycleId} onChange={(event) => { cycleLoadSequence.current += 1; setFormLoading(true); setOrders([]); setCycleId(event.target.value) }} disabled={loading} className="min-h-11 min-w-0 max-w-full rounded-lg border border-slate-500 bg-slate-50 px-3 text-sm font-semibold">{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.label}</option>)}</select><Button onClick={() => setOpen(true)} disabled={!canMutate || !cycleId || selectedCycle?.periodState !== 'open' || loading || formLoading} icon={<Plus className="h-4 w-4" />}>Input pesanan</Button></div>
      </header>

      {error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-900"><span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</span><Button size="sm" variant="ghost" onClick={() => void (cycles.length ? loadCycle(cycleId) : loadBase())} icon={<RefreshCw className="h-4 w-4" />}>Coba lagi</Button></div> : null}

      <section aria-label="Ringkasan pesanan minggu terpilih" className="rounded-xl border border-slate-200 bg-white p-5">
        <dl className="grid grid-cols-2 gap-4 @3xl:grid-cols-4">
          {[{ label: 'Pesanan aktif', value: `${summary.count} pesanan`, color: 'text-slate-950' }, { label: 'Nilai pesanan', value: formatCurrency(summary.value), color: 'text-slate-950' }, { label: 'Pembayaran diterima', value: formatCurrency(summary.received), color: 'text-emerald-800' }, { label: 'Sisa diketahui', value: formatCurrency(summary.outstanding), color: 'text-rose-800' }].map((metric) => <div key={metric.label} className="min-w-0"><dt className="text-xs font-semibold text-slate-600">{metric.label}</dt><dd className={`mt-2 text-lg font-extrabold tabular-nums [overflow-wrap:anywhere] @3xl:text-xl ${metric.color}`}>{loading || formLoading || error ? 'Belum tersedia' : metric.value}</dd></div>)}
        </dl>
        <p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-600">Seluruh pesanan aktif pada minggu ini, tidak mengikuti pencarian/filter. Pesanan dibatalkan tidak dihitung.</p>
        {summary.unknownCount > 0 ? <p role="status" className="mt-2 text-sm font-semibold text-amber-900">{summary.unknownCount} saldo belum diverifikasi. Total pembayaran dan sisa belum lengkap.</p> : null}
      </section>

      <section aria-label="Cari dan filter pesanan" className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 @4xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative"><label htmlFor="order-search" className="sr-only">Cari pesanan</label><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" /><input id="order-search" type="search" value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Cari nama, kelompok, telepon, atau barang" className="min-h-11 w-full rounded-lg border border-slate-500 pl-9 pr-3 text-sm placeholder:text-slate-500" /></div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter pembayaran">{([['all', 'Semua'], ['open', 'Belum lunas'], ['paid', 'Lunas'], ['unverified', 'Belum diverifikasi']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setPaymentFilter(value)} aria-pressed={paymentFilter === value} className={`min-h-11 rounded-lg px-3 text-xs font-bold ${paymentFilter === value ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{label}</button>)}</div>
        <p role="status" className="text-xs text-slate-600 @4xl:col-span-2">{loading || formLoading ? 'Memuat pesanan…' : `${filteredOrders.length} dari ${orders.length} pesanan ditampilkan`}</p>
      </section>

      {loading || formLoading ? <div className="grid gap-3 md:grid-cols-2" aria-busy="true" aria-label="Memuat pesanan minggu terpilih">{[0, 1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-xl bg-slate-200/60" />)}</div> : (
        <div>
          <div className="grid gap-4 @xl:grid-cols-2 @3xl:hidden">
            {filteredOrders.map((order) => <article key={order.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-extrabold text-slate-950">{order.member.name}</h2><p className="mt-1 break-words text-xs text-slate-600">{order.member.group?.name ?? order.member.groupName ?? 'Tanpa kelompok'}</p></div><OrderPaymentBadge order={order} /></div>
              <div className="mt-4 border-y border-slate-200 py-3 text-sm"><OrderItems order={order} /></div>
              <dl className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,120px),1fr))] gap-3"><div><dt className="text-xs text-slate-600">Nilai pesanan</dt><dd className="mt-1 font-extrabold tabular-nums [overflow-wrap:anywhere]">{formatCurrency(order.totalAmount)}</dd></div><div><dt className="text-xs text-slate-600">Sisa</dt><dd className="mt-1 font-bold tabular-nums [overflow-wrap:anywhere]">{order.paymentSummary.outstandingAmount === null ? 'Belum diketahui' : formatCurrency(order.paymentSummary.outstandingAmount)}</dd></div><div><dt className="text-xs text-slate-600">Pengiriman</dt><dd className="mt-1 text-sm font-semibold">{deliveryLabel(order)}</dd></div></dl>
              <Link href={`/payments?cycleId=${encodeURIComponent(cycleId)}&orderId=${encodeURIComponent(order.id)}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-emerald-800 hover:text-emerald-950">Lihat pembayaran<span className="sr-only"> {order.member.name}</span></Link>
            </article>)}
          </div>
          {filteredOrders.length > 0 ? <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white @3xl:block">
            <table className="w-full min-w-[860px] text-left text-sm">
              <caption className="sr-only">Pesanan pada {selectedCycle?.label}, sesuai pencarian dan filter pembayaran</caption>
              <thead className="bg-slate-50 text-xs text-slate-600"><tr>{['Anggota', 'Rincian barang', 'Nilai pesanan', 'Pembayaran', 'Sisa', 'Pengiriman', 'Aksi'].map((label) => <th key={label} scope="col" className="px-4 py-4 font-semibold">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-200">{filteredOrders.map((order) => <tr key={order.id} className="align-top hover:bg-slate-50">
                <th scope="row" className="max-w-48 px-4 py-4"><span className="break-words font-bold text-slate-950">{order.member.name}</span><p className="mt-1 break-words text-xs font-normal text-slate-600">{order.member.group?.name ?? order.member.groupName ?? 'Tanpa kelompok'}</p></th>
                <td className="min-w-44 px-4 py-4"><OrderItems order={order} /></td>
                <td className="px-4 py-4 font-bold tabular-nums whitespace-nowrap">{formatCurrency(order.totalAmount)}</td>
                <td className="px-4 py-4"><OrderPaymentBadge order={order} /></td>
                <td className="px-4 py-4 font-semibold tabular-nums whitespace-nowrap">{order.paymentSummary.outstandingAmount === null ? 'Belum diketahui' : formatCurrency(order.paymentSummary.outstandingAmount)}</td>
                <td className="px-4 py-4 text-slate-700">{deliveryLabel(order)}</td>
                <td className="px-4 py-2"><Link href={`/payments?cycleId=${encodeURIComponent(cycleId)}&orderId=${encodeURIComponent(order.id)}`} className="inline-flex min-h-11 items-center text-sm font-bold text-emerald-800 hover:text-emerald-950">Lihat pembayaran<span className="sr-only"> {order.member.name}</span></Link></td>
              </tr>)}</tbody>
            </table>
          </div> : null}
          {filteredOrders.length === 0 && !error ? <div className="border-y border-slate-200 py-10 text-center"><ShoppingBasket className="mx-auto h-7 w-7 text-slate-500" /><p className="mt-3 font-bold text-slate-800">{orders.length ? 'Tidak ada pesanan yang cocok' : 'Belum ada pesanan pada minggu ini'}</p><p className="mt-1 text-sm text-slate-600">{orders.length ? 'Ubah pencarian atau pilih status pembayaran lain.' : 'Pilih minggu lain untuk melihat pesanan yang sudah tercatat.'}</p>{orderSearch || paymentFilter !== 'all' ? <Button className="mt-4" variant="secondary" onClick={() => { setOrderSearch(''); setPaymentFilter('all') }}>Reset pencarian dan filter</Button> : null}</div> : null}
        </div>
      )}

      <Modal isOpen={open} onClose={() => !submitting && setOpen(false)} title="Input pesanan" description={`${selectedCycle?.label ?? 'Pilih siklus'} · draf tersimpan pada perangkat ini`} icon={<ShoppingBasket className="h-4 w-4" />} maxWidth="2xl">
        <div className="space-y-5">
          <section><label htmlFor="member-search" className="text-sm font-bold text-slate-800">Cari anggota</label><div className="relative mt-1.5"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input id="member-search" autoComplete="off" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Nama atau kelompok" className="min-h-11 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm" /></div><div className="mt-2 max-h-36 divide-y divide-slate-100 overflow-y-auto border-y border-slate-200">{filteredMembers.map((member) => { const existing = existingMemberIds.has(member.id); return <button key={member.id} type="button" disabled={existing} onClick={() => { setMemberId(member.id); setMemberSearch(member.name) }} className={`flex min-h-11 w-full items-center justify-between gap-3 px-2 text-left text-sm ${memberId === member.id ? 'bg-emerald-50 text-emerald-950' : 'hover:bg-slate-50'} disabled:cursor-not-allowed disabled:opacity-50`}><span><strong>{member.name}</strong><span className="ml-2 text-xs text-slate-500">{member.group?.name ?? member.groupName}</span></span>{existing ? <span className="text-xs font-semibold">Sudah pesan</span> : memberId === member.id ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : null}</button>})}</div></section>

          <section><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-800">Produk dan jumlah</h3><p className="mt-1 text-xs text-slate-500">Kosongkan produk yang tidak dipesan.</p></div><div className="inline-flex rounded-lg bg-slate-100 p-1"><button type="button" onClick={() => setPriceType('consumer')} aria-pressed={priceType === 'consumer'} className={`min-h-11 rounded-md px-3 text-xs font-bold sm:min-h-8 ${priceType === 'consumer' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'}`}>Konsumen</button><button type="button" onClick={() => setPriceType('trader')} aria-pressed={priceType === 'trader'} className={`min-h-11 rounded-md px-3 text-xs font-bold sm:min-h-8 ${priceType === 'trader' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'}`}>Pedagang</button></div></div><div className="mt-3 divide-y divide-slate-100 border-y border-slate-200">{activeProducts.map((product) => { const price = priceByProduct.get(product.id)!; const stock = availabilityByProduct.get(product.id); const activePrice = priceType === 'consumer' ? price.consumerPrice : price.traderPrice; return <div key={product.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-sm font-bold text-slate-900">{product.name}</p><p className="text-xs text-slate-500">{formatCurrency(activePrice)} / {product.unit}{stock?.availableToOrder !== null && stock?.availableToOrder !== undefined ? ` · tersedia ${Number(stock.availableToOrder).toLocaleString('id-ID')}` : ' · jatah belum dikunci'}</p></div><label className="flex items-center justify-end gap-2 text-xs font-semibold text-slate-600"><span className="sr-only">Jumlah {product.name}</span><input inputMode={product.unit === 'bungkus' ? 'numeric' : 'decimal'} value={quantities[product.id] ?? ''} onChange={(event) => setQuantities((current) => ({ ...current, [product.id]: event.target.value.replace(',', '.') }))} placeholder="0" className="min-h-11 w-24 rounded-lg border border-slate-300 px-3 text-right text-sm font-bold tabular-nums" /><span className="w-16">{product.unit}</span></label></div>})}{activeProducts.length === 0 ? <p className="py-5 text-sm text-amber-800">Harga siklus belum tersedia. Pesanan belum dapat disimpan.</p> : null}</div></section>

          <label className="block text-sm font-bold text-slate-800">Catatan <span className="font-normal text-slate-500">(opsional)</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="mt-1.5 w-full rounded-lg border border-slate-300 p-3 text-sm" /></label>
          <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold text-slate-500">Total perkiraan</p><p className="text-xl font-black tabular-nums text-slate-950">{formatCurrency(total)}</p><p className="text-xs text-slate-500">Server menghitung ulang dari snapshot harga.</p></div><div className="flex flex-col-reverse gap-2 sm:flex-row"><Button variant="secondary" disabled={!canMutate || submitting || !memberId || !activeProducts.length} onClick={() => void submit(true)}>{submitting ? 'Menyimpan…' : 'Simpan & berikutnya'}</Button><Button disabled={!canMutate || submitting || !memberId || !activeProducts.length} onClick={() => void submit(false)}>{submitting ? 'Menyimpan…' : 'Simpan'}</Button></div></div>
        </div>
      </Modal>
    </div>
  )
}

export default function OrdersPage() {
  return <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-slate-200/60" />}><OrdersContent /></Suspense>
}
