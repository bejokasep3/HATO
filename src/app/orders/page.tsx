'use client'

import React, { useEffect, useState } from 'react'
import {
  ShoppingCart,
  PlusCircle,
  Search,
  Filter,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  Plus,
  MessageSquare,
} from 'lucide-react'
import { formatCurrency, formatDate, getWhatsAppUrl } from '@/lib/utils'
import { toast } from 'sonner'

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Pesanan</h1>
          <p className="text-sm text-slate-500 mt-1">
            Catat pesanan sembako, perbarui status pembayaran, dan pantau pengiriman per anggota.
          </p>
        </div>
        <button
          onClick={() => handleOpenCreateModal()}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm transition-all shadow-xs shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          Input Pesanan Baru
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-700">Filter:</span>
          </div>

          <select
            value={selectedCycleId}
            onChange={(e) => setSelectedCycleId(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-hidden focus:border-emerald-600"
          >
            <option value="">Semua Siklus</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({c.status})
              </option>
            ))}
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-hidden focus:border-emerald-600"
          >
            <option value="">Semua Status Bayar</option>
            <option value="unpaid">Belum Bayar</option>
            <option value="paid">Sudah Lunas</option>
          </select>
        </div>

        <p className="text-xs text-slate-400 italic">
          💡 Klik baris pesanan untuk melihat detail atau mengedit
        </p>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="flex items-center justify-center min-h-[30vh]">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Tidak ada pesanan yang sesuai dengan filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Anggota</th>
                  <th className="py-3 px-4">Siklus</th>
                  <th className="py-3 px-4">Rincian Item</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Status Bayar</th>
                  <th className="py-3 px-4">Status Pengiriman</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => handleOpenEditModal(o)}
                    className="hover:bg-emerald-50/50 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block group-hover:text-emerald-700 transition-colors">
                        {o.member.name}
                      </span>
                      <span className="text-xs text-slate-500 block">{o.member.group?.name}</span>
                      <a
                        href={getWhatsAppUrl(o.member.phone, `Halo ${o.member.name}, pesanan Anda sebesar ${formatCurrency(o.totalAmount)}:`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[11px] text-emerald-600 hover:underline inline-flex items-center gap-1 mt-0.5"
                      >
                        <MessageSquare className="w-2.5 h-2.5" />
                        {o.member.phone}
                      </a>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-700">
                      {o.cycle.label}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-700">
                      <div className="space-y-0.5">
                        {o.items.map((it: any) => (
                          <div key={it.id} className="flex items-center gap-1.5 py-0.5">
                            <span>
                              • {it.product.name} × {it.quantity} {it.product.unit} ({formatCurrency(it.subtotal)})
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
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
                        <p className="text-[11px] text-slate-400 italic mt-1">
                          Catatan: {o.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-900 text-sm">
                      {formatCurrency(o.totalAmount)}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleTogglePayment(o.id, o.paymentStatus)
                        }}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                          o.paymentStatus === 'paid'
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                        }`}
                      >
                        {o.paymentStatus === 'paid' ? '✅ Lunas' : '❌ Belum Bayar'}
                      </button>
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={o.orderStatus}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white font-medium focus:outline-hidden focus:border-emerald-600"
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-xs font-semibold text-emerald-600 group-hover:text-emerald-700 underline-offset-2 group-hover:underline">
                          Edit
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteOrder(o.id)
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          title="Batalkan Pesanan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingOrder ? 'Detail & Edit Pesanan' : 'Input Pesanan Baru'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingOrder
                    ? `Perbarui rincian produk, jumlah, atau status pesanan ${editingOrder.member.name}`
                    : 'Catat transaksi sembako anggota untuk siklus terpilih'}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
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
                      <option value="unpaid">❌ Belum Bayar (Unpaid)</option>
                      <option value="paid">✅ Sudah Lunas (Paid)</option>
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
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
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
                            <span className="text-xs font-extrabold text-slate-900 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
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
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteOrder(editingOrder.id)
                      setModalOpen(false)
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Batalkan Pesanan
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg"
                  >
                    Tutup
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 transition-colors shadow-xs"
                  >
                    {submitting ? 'Menyimpan...' : editingOrder ? 'Simpan Perubahan' : 'Simpan Pesanan'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
