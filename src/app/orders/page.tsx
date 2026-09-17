'use client'

import React, { useEffect, useState } from 'react'
import {
  ShoppingCart,
  Search,
  Filter,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  Plus,
  MessageSquare,
  CreditCard,
} from 'lucide-react'
import { formatCurrency, formatDate, getWhatsAppUrl } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [cycles, setCycles] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [selectedCycleId, setSelectedCycleId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      return params.get('cycleId') || ''
    }
    return ''
  })
  const [paymentFilter, setPaymentFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  // Create / Edit Order Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<any | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formCycleId, setFormCycleId] = useState('')
  const [formMemberId, setFormMemberId] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formPaymentStatus, setFormPaymentStatus] = useState<string>('unpaid')
  const [formOrderStatus, setFormOrderStatus] = useState<string>('pending')
  const [cycleOrderedMemberIds, setCycleOrderedMemberIds] = useState<Set<string>>(new Set())
  const [formItems, setFormItems] = useState<
    Array<{ productId: string; quantity: number; priceType: 'consumer' | 'trader' }>
  >([])

  // Prices for the cycle selected in form
  const [cyclePrices, setCyclePrices] = useState<Map<string, { consumer: number; trader: number }>>(
    new Map()
  )

  const fetchData = async () => {
    try {
      setLoading(true)
      const [ordersRes, cyclesRes, membersRes, productsRes] = await Promise.all([
        fetch(`/api/orders${selectedCycleId ? `?cycleId=${selectedCycleId}` : ''}${paymentFilter ? `&paymentStatus=${paymentFilter}` : ''}`),
        fetch('/api/cycles'),
        fetch('/api/members'),
        fetch('/api/products'),
      ])

      const [ordersJson, cyclesJson, membersJson, productsJson] = await Promise.all([
        ordersRes.json(),
        cyclesRes.json(),
        membersRes.json(),
        productsRes.json(),
      ])

      setOrders(ordersJson)
      setCycles(cyclesJson)
      setMembers(membersJson)
      setProducts(productsJson)

      // Default selected cycle for filter if not set
      if (!selectedCycleId && cyclesJson.length > 0) {
        setSelectedCycleId(cyclesJson[0].id)
      }
    } catch (err) {
      console.error(err)
      toast.error('Gagal memuat data pesanan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const cId = params.get('cycleId')
      if (cId) setSelectedCycleId(cId)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [selectedCycleId, paymentFilter])

  // Check URL params for editOrderId or createOrder
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const editId = params.get('editOrderId')
    if (editId && orders.length > 0) {
      const target = orders.find((o) => o.id === editId)
      if (target) {
        handleOpenEditModal(target)
      }
    } else if ((params.get('createOrder') === 'true' || params.get('newOrder') === 'true') && cycles.length > 0 && !modalOpen && !editingOrder) {
      const cId = params.get('cycleId') || selectedCycleId
      handleOpenCreateModal(cId)
    }
  }, [orders, cycles])

  // When cycle changes in create/edit modal, load prices and existing orders for that cycle
  const handleFormCycleChange = async (cId: string, currentEditing: boolean = false) => {
    setFormCycleId(cId)
    if (!cId) return
    try {
      const [pricesRes, ordersRes] = await Promise.all([
        fetch(`/api/cycles/${cId}/prices`),
        fetch(`/api/orders?cycleId=${cId}`),
      ])
      const [pricesData, ordersData] = await Promise.all([
        pricesRes.json(),
        ordersRes.json(),
      ])

      const pMap = new Map<string, { consumer: number; trader: number }>()
      if (Array.isArray(pricesData)) {
        pricesData.forEach((wp: any) => {
          const consumer = wp.consumerPrice !== null ? Number(wp.consumerPrice) : Number(wp.price)
          const trader = wp.traderPrice !== null ? Number(wp.traderPrice) : consumer
          pMap.set(wp.productId, { consumer, trader })
        })
      }
      setCyclePrices(pMap)

      const orderedIds = new Set<string>()
      if (Array.isArray(ordersData)) {
        ordersData.forEach((o: any) => orderedIds.add(o.memberId))
      }
      setCycleOrderedMemberIds(orderedIds)

      // When creating a new order, pick an available member who has not ordered in this cycle
      if (!currentEditing && !editingOrder) {
        setFormMemberId((currentMemberId) => {
          if (currentMemberId && !orderedIds.has(currentMemberId)) {
            return currentMemberId
          }
          const available = members.find((m) => !orderedIds.has(m.id))
          return available ? available.id : (members[0]?.id || '')
        })
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleOpenCreateModal = (targetCycleId?: string) => {
    setEditingOrder(null)
    const activeCycleId = targetCycleId || (selectedCycleId && selectedCycleId !== '' ? selectedCycleId : '')
    const defaultCycle =
      (activeCycleId && cycles.find((c) => c.id === activeCycleId)) ||
      cycles.find((c) => c.status === 'open') ||
      cycles[0]

    const chosenCycleId = defaultCycle?.id || ''
    setFormCycleId(chosenCycleId)
    if (chosenCycleId) {
      handleFormCycleChange(chosenCycleId, false)
    }
    setFormNotes('')
    setFormPaymentStatus('unpaid')
    setFormOrderStatus('pending')
    // Preload with 1st product
    if (products.length > 0) {
      setFormItems([{ productId: products[0].id, quantity: 1, priceType: 'consumer' }])
    } else {
      setFormItems([])
    }
    setModalOpen(true)
  }

  const handleOpenEditModal = (order: any) => {
    setEditingOrder(order)
    setFormCycleId(order.cycleId)
    handleFormCycleChange(order.cycleId, true)
    setFormMemberId(order.memberId)
    setFormNotes(order.notes || '')
    setFormPaymentStatus(order.paymentStatus || 'unpaid')
    setFormOrderStatus(order.orderStatus || 'pending')
    if (order.items && order.items.length > 0) {
      setFormItems(
        order.items.map((it: any) => ({
          productId: it.productId,
          quantity: Number(it.quantity),
          priceType: (it.priceType as 'consumer' | 'trader') || 'consumer',
        }))
      )
    } else if (products.length > 0) {
      setFormItems([{ productId: products[0].id, quantity: 1, priceType: 'consumer' }])
    } else {
      setFormItems([])
    }
    setModalOpen(true)
  }

  const handleAddItem = () => {
    if (products.length > 0) {
      setFormItems([...formItems, { productId: products[0].id, quantity: 1, priceType: 'consumer' }])
    }
  }

  const handleRemoveItem = (idx: number) => {
    setFormItems(formItems.filter((_, i) => i !== idx))
  }

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formItems.length === 0) {
      toast.error('Tambahkan minimal satu produk dalam pesanan')
      return
    }

    try {
      setSubmitting(true)
      if (editingOrder) {
        const res = await fetch('/api/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingOrder.id,
            paymentStatus: formPaymentStatus,
            orderStatus: formOrderStatus,
            notes: formNotes,
            items: formItems.map((it) => ({
              productId: it.productId,
              quantity: Number(it.quantity),
              priceType: it.priceType || 'consumer',
            })),
          }),
        })

        if (!res.ok) {
          const errJson = await res.json()
          throw new Error(errJson.error || 'Gagal memperbarui pesanan')
        }

        toast.success('Pesanan berhasil diperbarui!')
      } else {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cycleId: formCycleId,
            memberId: formMemberId,
            notes: formNotes,
            items: formItems.map((it) => ({
              productId: it.productId,
              quantity: Number(it.quantity),
              priceType: it.priceType || 'consumer',
            })),
          }),
        })

        if (!res.ok) {
          const errJson = await res.json()
          throw new Error(errJson.error || 'Gagal membuat pesanan')
        }

        toast.success('Pesanan berhasil dicatat!')
      }

      setModalOpen(false)
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan')
    } finally {
      setSubmitting(false)
    }
  }

  const handleTogglePayment = async (orderId: string, currentStatus: string) => {
    try {
      const nextStatus = currentStatus === 'paid' ? 'unpaid' : 'paid'
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, paymentStatus: nextStatus }),
      })
      if (!res.ok) throw new Error('Gagal update status bayar')
      toast.success(nextStatus === 'paid' ? 'Pesanan ditandai lunas' : 'Pesanan ditandai belum bayar')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah status')
    }
  }

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, orderStatus: status }),
      })
      if (!res.ok) throw new Error('Gagal update status order')
      toast.success('Status pengiriman diperbarui')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Gagal update status')
    }
  }

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Apakah Anda yakin ingin membatalkan pesanan ini?')) return
    try {
      const res = await fetch(`/api/orders?id=${orderId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal menghapus pesanan')
      toast.success('Pesanan berhasil dibatalkan')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Gagal membatalkan pesanan')
    }
  }

  // Calculate live total for create order dialog
  const calculatedFormTotal = formItems.reduce((sum, item) => {
    const pObj = cyclePrices.get(item.productId) || { consumer: 0, trader: 0 }
    const price = item.priceType === 'trader' ? pObj.trader : pObj.consumer
    return sum + price * (Number(item.quantity) || 0)
  }, 0)

  // Calculate KPI summaries
  const totalOrdersCount = orders.length
  const totalBillingAmount = orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)
  const paidOrders = orders.filter((o) => o.paymentStatus === 'paid')
  const unpaidOrders = orders.filter((o) => o.paymentStatus !== 'paid')
  const paidAmount = paidOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)
  const unpaidAmount = unpaidOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)

  // Filtered displayed orders with search
  const displayedOrders = orders.filter((o) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    const memberName = o.member?.name?.toLowerCase() || ''
    const memberPhone = o.member?.phone || ''
    const groupName = o.member?.group?.name?.toLowerCase() || ''
    const itemNames = o.items?.map((it: any) => it.product?.name?.toLowerCase()).join(' ') || ''
    return (
      memberName.includes(term) ||
      memberPhone.includes(term) ||
      groupName.includes(term) ||
      itemNames.includes(term)
    )
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Command Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap mb-1">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Manajemen Pesanan</h1>
            <Badge variant="emerald" size="sm" className="tabular-nums font-bold">
              {totalOrdersCount} Pesanan Terdata
            </Badge>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Catat pesanan sembako per anggota, pantau verifikasi pembayaran lunas, dan perbarui status pengiriman kurir.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => handleOpenCreateModal()}
          icon={<Plus className="w-4 h-4" />}
        >
          Input Pesanan Baru
        </Button>
      </div>

      {/* 2. KPI Summary Cards (4 Balanced Operational Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Pesanan</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <ShoppingCart className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 tracking-tight tabular-nums">
            {totalOrdersCount} <span className="text-xs font-normal text-slate-500">pesanan</span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            Pada filter siklus aktif
          </span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Nilai Tagihan</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/50">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 tracking-tight tabular-nums">
            {formatCurrency(totalBillingAmount)}
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            Akumulasi pesanan masuk
          </span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Sudah Lunas</span>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 tabular-nums">
              {paidOrders.length} Pesanan
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-800 tracking-tight tabular-nums">
            {formatCurrency(paidAmount)}
          </div>
          <span className="text-[11px] text-emerald-700 block mt-1 font-medium">
            Kas masuk terkonfirmasi
          </span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Belum Bayar / Piutang</span>
            <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200/60 tabular-nums">
              {unpaidOrders.length} Tertunggak
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-rose-800 tracking-tight tabular-nums">
            {formatCurrency(unpaidAmount)}
          </div>
          <span className="text-[11px] text-rose-700 block mt-1 font-medium">
            Perlu diingatkan via WhatsApp
          </span>
        </div>
      </div>

      {/* 3. Tactile Filter & Search Toolbar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama anggota, nomor telepon, atau komoditas pesanan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-xl pl-9 pr-3 py-2 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:border-emerald-600 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedCycleId}
            onChange={(e) => setSelectedCycleId(e.target.value)}
            className="text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 focus:outline-hidden focus:border-emerald-600 cursor-pointer shadow-2xs"
          >
            <option value="">Semua Siklus</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({c.status})
              </option>
            ))}
          </select>

          <div className="inline-flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setPaymentFilter('')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                paymentFilter === ''
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setPaymentFilter('unpaid')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                paymentFilter === 'unpaid'
                  ? 'bg-white text-rose-800 shadow-xs'
                  : 'text-slate-600 hover:text-rose-700'
              }`}
            >
              Belum Bayar
            </button>
            <button
              onClick={() => setPaymentFilter('paid')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                paymentFilter === 'paid'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              Lunas
            </button>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
        {loading ? (
          <div className="flex items-center justify-center min-h-[30vh]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Memuat pesanan...</p>
            </div>
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Tidak ada pesanan yang sesuai</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Ubah kriteria pencarian atau pilih siklus lain.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-bold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Anggota Komunitas</th>
                  <th className="py-3 px-4">Siklus</th>
                  <th className="py-3 px-4">Rincian Komoditas</th>
                  <th className="py-3 px-4">Total Tagihan</th>
                  <th className="py-3 px-4">Status Bayar</th>
                  <th className="py-3 px-4">Status Kirim</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedOrders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => handleOpenEditModal(o)}
                    className="hover:bg-emerald-50/50 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0 group-hover:border-emerald-300">
                          {o.member.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="font-extrabold text-slate-900 block text-xs group-hover:text-emerald-700 transition-colors truncate">
                            {o.member.name}
                          </span>
                          <span className="text-[11px] text-slate-500 block truncate">
                            {o.member.group?.name || 'Sub-grup'}
                          </span>
                          <a
                            href={getWhatsAppUrl(
                              o.member.phone,
                              `Halo ${o.member.name}, mengenai pesanan sembako siklus ${o.cycle?.label || ''} sebesar ${formatCurrency(o.totalAmount)}:`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] text-emerald-700 hover:underline inline-flex items-center gap-1 mt-0.5 tabular-nums font-medium"
                          >
                            <MessageSquare className="w-2.5 h-2.5" />
                            {o.member.phone}
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-700">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px] border border-slate-200/60">
                        {o.cycle.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-700">
                      <div className="space-y-0.5">
                        {o.items.map((it: any) => (
                          <div key={it.id} className="flex items-center gap-1.5 py-0.5">
                            <span className="tabular-nums">
                              • {it.product.name} × {it.quantity} {it.product.unit} ({formatCurrency(it.subtotal)})
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                it.priceType === 'trader'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {it.priceType === 'trader' ? 'Pedagang' : 'Konsumen'}
                            </span>
                          </div>
                        ))}
                      </div>
                      {o.notes && (
                        <p className="text-[11px] text-slate-500 italic mt-1">
                          Catatan: {o.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-900 text-sm tabular-nums">
                      {formatCurrency(o.totalAmount)}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleTogglePayment(o.id, o.paymentStatus)
                        }}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 transition-all ${
                          o.paymentStatus === 'paid'
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                        }`}
                      >
                        {o.paymentStatus === 'paid' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            Lunas
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3 h-3 text-rose-700" />
                            Belum Bayar
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4">
                      <div onClick={(e) => e.stopPropagation()}>
                        <select
                          value={o.orderStatus}
                          onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)}
                          className={`text-xs font-semibold border rounded-lg px-2.5 py-1 focus:outline-hidden focus:border-emerald-600 cursor-pointer shadow-2xs ${
                            o.orderStatus === 'delivered'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : o.orderStatus === 'shipped'
                              ? 'bg-sky-50 text-sky-800 border-sky-200'
                              : o.orderStatus === 'confirmed'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                        </select>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="subtle"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenEditModal(o)
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteOrder(o.id)
                          }}
                          title="Batalkan Pesanan"
                          className="p-1.5"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT ORDER MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200/90 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center border border-emerald-200/60">
                  <ShoppingCart className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                    {editingOrder ? 'Detail & Edit Pesanan' : 'Input Pesanan Baru'}
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {editingOrder
                      ? `Perbarui rincian produk, jumlah, atau status pesanan ${editingOrder.member?.name || ''}`
                      : 'Catat transaksi sembako anggota untuk siklus terpilih'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrder} className="space-y-4 pt-4">
              {editingOrder ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Siklus
                    </label>
                    <div className="text-xs font-bold text-slate-800">
                      {editingOrder.cycle?.label}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Anggota
                    </label>
                    <div className="text-xs font-bold text-slate-800">
                      {editingOrder.member?.name} ({editingOrder.member?.group?.name || '-'})
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Pilih Siklus
                    </label>
                    <select
                      required
                      value={formCycleId}
                      onChange={(e) => handleFormCycleChange(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:border-emerald-600 font-medium"
                    >
                      {cycles.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label} ({c.status.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Pilih Anggota
                      </label>
                      {cycleOrderedMemberIds.size > 0 && (
                        <span className="text-[10px] text-slate-500 font-medium">
                          {Math.max(0, members.length - cycleOrderedMemberIds.size)}/{members.length} anggota belum pesan
                        </span>
                      )}
                    </div>
                    <select
                      required
                      value={formMemberId}
                      onChange={(e) => setFormMemberId(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:border-emerald-600 font-medium"
                    >
                      {members.map((m) => {
                        const alreadyOrdered = cycleOrderedMemberIds.has(m.id)
                        return (
                          <option key={m.id} value={m.id} disabled={alreadyOrdered}>
                            {m.name} ({m.group?.name || '-'}) {alreadyOrdered ? '— [Sudah Ada Pesanan]' : ''}
                          </option>
                        )
                      })}
                    </select>
                    {members.length > 0 && cycleOrderedMemberIds.size >= members.length && (
                      <p className="text-[11px] text-amber-600 mt-1">
                        ⚠️ Semua anggota sudah memiliki pesanan di siklus ini.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Status Section for Editing */}
              {editingOrder && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Status Pembayaran
                    </label>
                    <select
                      value={formPaymentStatus}
                      onChange={(e) => setFormPaymentStatus(e.target.value)}
                      className="w-full text-xs font-medium border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:border-emerald-600"
                    >
                      <option value="unpaid">Belum Bayar (Unpaid)</option>
                      <option value="paid">Sudah Lunas (Paid)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Status Pengiriman
                    </label>
                    <select
                      value={formOrderStatus}
                      onChange={(e) => setFormOrderStatus(e.target.value)}
                      className="w-full text-xs font-medium border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:border-emerald-600"
                    >
                      <option value="pending">Pending (Menunggu)</option>
                      <option value="confirmed">Confirmed (Terkonfirmasi)</option>
                      <option value="shipped">Shipped (Dalam Pengiriman)</option>
                      <option value="delivered">Delivered (Terkirim)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Items Section */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-800">Daftar Produk yang Dipesan</span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Produk
                  </button>
                </div>

                <div className="space-y-2.5">
                  {formItems.map((item, idx) => {
                    const pObj = cyclePrices.get(item.productId) || { consumer: 0, trader: 0 }
                    const price = item.priceType === 'trader' ? pObj.trader : pObj.consumer
                    const subtotal = price * (Number(item.quantity) || 0)
                    const selectedProduct = products.find((p) => p.id === item.productId)

                    return (
                      <div
                        key={idx}
                        className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2"
                      >
                        {/* Baris 1: Pilihan Produk & Tombol Hapus */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <select
                              value={item.productId}
                              onChange={(e) => {
                                const newPId = e.target.value
                                setFormItems(
                                  formItems.map((it, i) => (i === idx ? { ...it, productId: newPId } : it))
                                )
                              }}
                              className="w-full text-xs font-semibold border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-hidden focus:border-emerald-600 bg-white"
                            >
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.unit})
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                            title="Hapus Produk"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Baris 2: Jenis Harga, Jumlah (Qty), dan Subtotal */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            <select
                              value={item.priceType || 'consumer'}
                              onChange={(e) => {
                                const newType = e.target.value as 'consumer' | 'trader'
                                setFormItems(
                                  formItems.map((it, i) => (i === idx ? { ...it, priceType: newType } : it))
                                )
                              }}
                              className="text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-hidden focus:border-emerald-600"
                            >
                              <option value="consumer">Konsumen ({formatCurrency(pObj.consumer)})</option>
                              <option value="trader">Pedagang ({formatCurrency(pObj.trader)})</option>
                            </select>

                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0.1"
                                step="any"
                                required
                                placeholder="Qty"
                                value={item.quantity}
                                onChange={(e) => {
                                  const qty = Number(e.target.value)
                                  setFormItems(
                                    formItems.map((it, i) => (i === idx ? { ...it, quantity: qty } : it))
                                  )
                                }}
                                className="w-20 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-center font-bold focus:outline-hidden focus:border-emerald-600"
                              />
                              <span className="text-xs font-medium text-slate-500">
                                {selectedProduct?.unit || 'unit'}
                              </span>
                            </div>
                          </div>

                          <div className="text-right ml-auto sm:ml-0 shrink-0">
                            <span className="text-xs font-extrabold text-slate-900 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 tabular-nums">
                              {formatCurrency(subtotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Subtotal Calculation */}
                <div className="flex justify-between items-center pt-3 mt-3 border-t border-slate-200 text-xs">
                  <span className="font-semibold text-slate-600">Total Pembayaran:</span>
                  <span className="text-base font-black text-emerald-700">
                    {formatCurrency(calculatedFormTotal)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Pesanan (Opsional)
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Contoh: Titip ke rumah Bu Siti, ayam potong 10"
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                {editingOrder ? (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={() => {
                      handleDeleteOrder(editingOrder.id)
                      setModalOpen(false)
                    }}
                  >
                    Batalkan Pesanan
                  </Button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setModalOpen(false)}
                  >
                    Tutup
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={submitting}
                  >
                    {submitting ? 'Menyimpan...' : editingOrder ? 'Simpan Perubahan' : 'Simpan Pesanan'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
