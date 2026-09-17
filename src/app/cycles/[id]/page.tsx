'use client'

import React, { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  DollarSign,
  Users,
  ShoppingCart,
  Repeat,
  Save,
  Trash2,
  MessageSquare,
  Plus,
  X,
  ClipboardCheck,
  ArrowRight,
  TrendingUp,
  Download,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { formatCurrency, formatDate, getWhatsAppUrl } from '@/lib/utils'
import { toast } from 'sonner'

export default function CycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'recap' | 'orders' | 'rotation' | 'prices' | 'inventory'>('recap')

  // Goods Receipt / Inventory State
  const [receipt, setReceipt] = useState<any>(null)
  const [inventoryItems, setInventoryItems] = useState<any[]>([])
  const [supplierNote, setSupplierNote] = useState<string>('')
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [savingInventory, setSavingInventory] = useState(false)
  const [copiedInventoryWA, setCopiedInventoryWA] = useState(false)

  // Prices editing state
  const [prices, setPrices] = useState<
    Array<{
      productId: string
      name: string
      unit: string
      price: number
      consumerPrice: number
      traderPrice: number
    }>
  >([])
  const [savingPrices, setSavingPrices] = useState(false)

  // Copied WA status
  const [copied, setCopied] = useState(false)

  // Manual Rotation State
  const [allMembers, setAllMembers] = useState<any[]>([])
  const [addRotationModalOpen, setAddRotationModalOpen] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [addingRotation, setAddingRotation] = useState(false)

  const fetchDetail = async () => {
    try {
      setLoading(true)
      const [cycleRes, membersRes] = await Promise.all([
        fetch(`/api/cycles/${id}`),
        fetch('/api/members'),
      ])

      if (!cycleRes.ok) throw new Error('Gagal memuat detail siklus')
      const json = await cycleRes.json()
      setData(json)

      if (membersRes.ok) {
        const membersJson = await membersRes.json()
        setAllMembers(membersJson)
      }

      // Initialize prices editor state
      if (json.cycle?.weeklyPrices) {
        setPrices(
          json.cycle.weeklyPrices.map((wp: any) => {
            const cons = wp.consumerPrice !== null ? Number(wp.consumerPrice) : Number(wp.price)
            const trad = wp.traderPrice !== null ? Number(wp.traderPrice) : cons
            return {
              productId: wp.productId,
              name: wp.product.name,
              unit: wp.product.unit,
              price: cons,
              consumerPrice: cons,
              traderPrice: trad,
            }
          })
        )
      }
    } catch (err) {
      console.error(err)
      toast.error('Gagal memuat detail siklus')
    } finally {
      setLoading(false)
    }
  }

  const fetchInventory = async () => {
    try {
      setLoadingInventory(true)
      const res = await fetch(`/api/inventory?cycleId=${id}`)
      if (!res.ok) throw new Error('Gagal memuat data penerimaan barang')
      const json = await res.json()
      setReceipt(json.receipt)
      setSupplierNote(json.receipt?.supplierNote || '')
      setInventoryItems(json.items || [])
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Gagal memuat data penerimaan barang')
    } finally {
      setLoadingInventory(false)
    }
  }

  useEffect(() => {
    fetchDetail()
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const tabParam = urlParams.get('tab')
      if (tabParam && ['recap', 'orders', 'rotation', 'prices', 'inventory'].includes(tabParam)) {
        setActiveTab(tabParam as any)
        if (tabParam === 'inventory') {
          fetchInventory()
        }
      }
    }
  }, [id])

  useEffect(() => {
    if (activeTab === 'inventory' && inventoryItems.length === 0 && !loadingInventory) {
      fetchInventory()
    }
  }, [activeTab])

  const handleInventoryItemChange = (idx: number, field: string, value: any) => {
    const updated = [...inventoryItems]
    const current = { ...updated[idx], [field]: value }

    if (field === 'receivedQty' || field === 'purchasePrice') {
      current.totalCost = Number(current.receivedQty) * Number(current.purchasePrice)
      current.margin = Number(current.revenue) - current.totalCost
    }
    if (field === 'receivedQty') {
      current.difference = Number(current.receivedQty) - Number(current.orderedQty)
    }

    updated[idx] = current
    setInventoryItems(updated)
  }

  const totalInvOrderedQty = inventoryItems.reduce((sum, it) => sum + Number(it.orderedQty), 0)
  const totalInvReceivedQty = inventoryItems.reduce((sum, it) => sum + Number(it.receivedQty), 0)
  const totalInvDamagedQty = inventoryItems.reduce((sum, it) => sum + Number(it.damagedQty), 0)
  const totalInvPurchaseCost = inventoryItems.reduce(
    (sum, it) => sum + Number(it.purchasePrice) * Number(it.receivedQty),
    0
  )
  const totalInvRevenue = inventoryItems.reduce((sum, it) => sum + Number(it.revenue), 0)
  const invGrossMargin = totalInvRevenue - totalInvPurchaseCost
  const invMarginPercentage = totalInvRevenue > 0 ? Math.round((invGrossMargin / totalInvRevenue) * 100) : 0
  const invHasDiscrepancy = inventoryItems.some((it) => it.difference !== 0 || it.damagedQty > 0)

  const handleSaveInventory = async (status: 'draft' | 'confirmed') => {
    try {
      setSavingInventory(true)
      const payload = {
        cycleId: id,
        supplierNote,
        status,
        items: inventoryItems.map((it) => ({
          productId: it.productId,
          orderedQty: Number(it.orderedQty),
          receivedQty: Number(it.receivedQty),
          damagedQty: Number(it.damagedQty) || 0,
          purchasePrice: Number(it.purchasePrice) || 0,
          notes: it.notes || null,
        })),
      }

      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'Gagal menyimpan penerimaan barang')
      }

      toast.success(
        status === 'confirmed'
          ? 'Penerimaan barang berhasil dikonfirmasi!'
          : 'Draf penerimaan barang berhasil disimpan!'
      )
      fetchInventory()
      fetchDetail()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Terjadi kesalahan')
    } finally {
      setSavingInventory(false)
    }
  }

  const handleCopyInventoryWA = () => {
    if (!data?.cycle) return
    let text = `📦 *LAPORAN PENERIMAAN BARANG (SIKLUS)*\n`
    text += `*Siklus:* ${data.cycle.label}\n`
    text += `*Tanggal Tiba:* ${formatDate(data.cycle.deliveryDate)}\n`
    text += `*Status Penerimaan:* ${receipt?.status === 'confirmed' ? '✅ Terkonfirmasi' : '📝 Draf'}\n`
    text += `------------------------------------\n`

    inventoryItems.forEach((it) => {
      const statusIcon = it.difference === 0 && it.damagedQty === 0 ? '✅' : '⚠️'
      text += `${statusIcon} *${it.productName}*\n`
      text += `   • Dipesan: ${it.orderedQty} ${it.unit}\n`
      text += `   • Diterima: ${it.receivedQty} ${it.unit}\n`
      if (it.damagedQty > 0) text += `   • Rusak/Susut: ${it.damagedQty} ${it.unit}\n`
      if (it.difference !== 0) text += `   • Selisih: ${it.difference > 0 ? '+' : ''}${it.difference} ${it.unit}\n`
      if (it.purchasePrice > 0) text += `   • HPP: ${formatCurrency(it.purchasePrice)} / ${it.unit}\n`
      text += `\n`
    })

    text += `------------------------------------\n`
    text += `*Total Modal (HPP):* ${formatCurrency(totalInvPurchaseCost)}\n`
    text += `*Total Omzet Penjualan:* ${formatCurrency(totalInvRevenue)}\n`
    text += `*Estimasi Margin Kotor:* ${formatCurrency(invGrossMargin)} (${invMarginPercentage}%)\n`
    if (supplierNote) text += `*Catatan Supplier:* ${supplierNote}\n`

    navigator.clipboard.writeText(text)
    setCopiedInventoryWA(true)
    setTimeout(() => setCopiedInventoryWA(false), 2000)
    toast.success('Ringkasan berhasil disalin ke clipboard!')
  }

  const handleExportInventoryCSV = () => {
    if (inventoryItems.length === 0) return
    const headers = [
      'Produk',
      'Satuan',
      'Kategori',
      'Dipesan',
      'Diterima',
      'Rusak/Susut',
      'Selisih',
      'Harga Beli (HPP)',
      'Total Modal',
      'Omzet Penjualan',
      'Margin Kotor',
      'Catatan',
    ]

    const rows = inventoryItems.map((it) => [
      `"${it.productName}"`,
      `"${it.unit}"`,
      `"${it.category || '-'}"`,
      it.orderedQty,
      it.receivedQty,
      it.damagedQty,
      it.difference,
      it.purchasePrice,
      it.purchasePrice * it.receivedQty,
      it.revenue,
      it.revenue - it.purchasePrice * it.receivedQty,
      `"${it.notes || ''}"`,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Penerimaan_Barang_${data?.cycle?.label || 'Siklus'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('File CSV berhasil diunduh!')
  }

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/cycles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Gagal memperbarui status')
      toast.success(`Status siklus diubah menjadi: ${newStatus}`)
      fetchDetail()
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah status')
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
      fetchDetail()
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah status')
    }
  }

  const handleSavePrices = async () => {
    try {
      setSavingPrices(true)
      const res = await fetch(`/api/cycles/${id}/prices`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: prices.map((p) => ({
            productId: p.productId,
            consumerPrice: p.consumerPrice,
            traderPrice: p.traderPrice,
            price: p.consumerPrice,
          })),
        }),
      })
      if (!res.ok) throw new Error('Gagal menyimpan harga')
      toast.success('Harga mingguan berhasil diperbarui')
      fetchDetail()
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan')
    } finally {
      setSavingPrices(false)
    }
  }

  const handleGenerateRotation = async () => {
    try {
      const res = await fetch(`/api/cycles/${id}/rotation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countPerGroup: 2 }),
      })
      if (!res.ok) throw new Error('Gagal generate rotasi')
      const result = await res.json()
      toast.success(result.message || 'Rotasi berhasil dijadwalkan')
      fetchDetail()
    } catch (err: any) {
      toast.error(err.message || 'Gagal generate rotasi')
    }
  }

  const handleOpenAddRotationModal = () => {
    const scheduledMemberIds = new Set(data?.cycle?.rotationSchedules?.map((r: any) => r.memberId) || [])
    const available = allMembers.filter((m) => !scheduledMemberIds.has(m.id))
    setSelectedMemberId(available[0]?.id || '')
    setAddRotationModalOpen(true)
  }

  const handleAddMemberRotation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMemberId) {
      toast.error('Pilih anggota yang ingin ditambahkan ke rotasi')
      return
    }

    try {
      setAddingRotation(true)
      const res = await fetch(`/api/cycles/${id}/rotation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: selectedMemberId }),
      })
      if (!res.ok) throw new Error('Gagal menambahkan anggota ke rotasi')
      toast.success('Anggota berhasil ditambahkan ke jadwal rotasi!')
      setAddRotationModalOpen(false)
      fetchDetail()
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan')
    } finally {
      setAddingRotation(false)
    }
  }

  const handleDeleteRotation = async (scheduleId: string, memberName: string) => {
    if (!confirm(`Hapus "${memberName}" dari jadwal rotasi siklus ini?`)) return

    try {
      const res = await fetch(`/api/cycles/${id}/rotation?id=${scheduleId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Gagal menghapus jadwal rotasi')
      toast.success(`${memberName} dihapus dari jadwal rotasi`)
      fetchDetail()
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus')
    }
  }

  // Format WhatsApp Text for Level 4 Supplier and Community Announcement
  const generateWhatsAppText = () => {
    if (!data?.cycle || !data?.recap) return ''
    const c = data.cycle
    const recap = data.recap

    let text = `📦 *REKAP PESANAN DISTRIBUSI SEMBAKO*\n`
    text += `*Siklus:* ${c.label}\n`
    text += `*Deadline Rekap:* ${formatDate(c.orderDeadline)}\n`
    text += `*Estimasi Kirim:* ${formatDate(c.deliveryDate)}\n`
    text += `------------------------------------\n\n`
    text += `*DAFTAR TOTAL PRODUK:*\n`

    let totalKeseluruhan = 0
    recap.forEach((r: any, idx: number) => {
      totalKeseluruhan += r.totalValue
      const targetNote = r.product.isTarget
        ? ` (Target: ${r.product.targetQuantity} ${r.product.unit} ${r.isMet ? '✅' : '❌ Kurang'})`
        : ''
      text += `${idx + 1}. *${r.product.name}*: ${r.totalQuantity} ${r.product.unit}${targetNote}\n`
      if (r.consumerQuantity > 0 || r.traderQuantity > 0) {
        text += `   - Konsumen: ${r.consumerQuantity} ${r.product.unit}\n`
        text += `   - Pedagang: ${r.traderQuantity} ${r.product.unit}\n`
      }
      text += `   Subtotal: ${formatCurrency(r.totalValue)}\n`
    })

    text += `\n------------------------------------\n`
    text += `*TOTAL NILAI:* ${formatCurrency(totalKeseluruhan)}\n`
    text += `*JUMLAH PESANAN:* ${c.orders?.length || 0} anggota\n\n`
    text += `Mohon segera diproses oleh supplier. Terima kasih!`

    return text
  }

  const handleCopyWhatsApp = () => {
    const text = generateWhatsAppText()
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Format teks WhatsApp berhasil disalin!')
    setTimeout(() => setCopied(false), 2500)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data?.cycle) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-md mx-auto my-12">
        <p className="text-sm text-slate-500">Siklus tidak ditemukan.</p>
        <Link href="/cycles" className="mt-4 inline-block text-xs font-semibold text-emerald-600">
          Kembali ke Daftar Siklus
        </Link>
      </div>
    )
  }

  const cycle = data.cycle
  const recap = data.recap || []
  const orders = cycle.orders || []
  const rotation = cycle.rotationSchedules || []

  return (
    <div className="space-y-6">
      {/* Back Button & Title Header */}
      <div>
        <Link
          href="/cycles"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Semua Siklus
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{cycle.label}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Mulai: {formatDate(cycle.periodStart)} • Deadline: {formatDate(cycle.orderDeadline)} • Pengiriman: {formatDate(cycle.deliveryDate)}
            </p>
          </div>

          {/* Status Changer */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Status:</span>
            <select
              value={cycle.status}
              onChange={(e) => handleUpdateStatus(e.target.value)}
              className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-hidden focus:border-emerald-600"
            >
              <option value="draft">Draft</option>
              <option value="open">Open (Buka)</option>
              <option value="closed">Closed (Ditutup)</option>
              <option value="delivered">Delivered (Terkirim)</option>
              <option value="completed">Completed (Selesai)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('recap')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all shrink-0 ${
            activeTab === 'recap'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Copy className="w-4 h-4" />
          Rekap & Ekspor WA
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all shrink-0 ${
            activeTab === 'orders'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          Daftar Pesanan ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('rotation')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all shrink-0 ${
            activeTab === 'rotation'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Repeat className="w-4 h-4" />
          Jadwal Rotasi ({rotation.length})
        </button>
        <button
          onClick={() => setActiveTab('prices')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'prices'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Harga Mingguan ({prices.length})
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'inventory'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          Penerimaan Barang
        </button>
      </div>

      {/* TAB 1: REKAP & EKSPOR WA */}
      {activeTab === 'recap' && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div>
              <h3 className="font-bold text-emerald-900 text-sm">Salin Format Rekap untuk WhatsApp</h3>
              <p className="text-xs text-emerald-700 mt-0.5">
                Format teks telah disesuaikan untuk langsung dikirimkan ke Supplier Level 4 pada hari Selasa.
              </p>
            </div>
            <button
              onClick={handleCopyWhatsApp}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg text-xs shadow-xs transition-all shrink-0"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Tersalin ke Clipboard!' : 'Salin Teks WhatsApp'}
            </button>
          </div>

          {/* Aggregated Products Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Rekapitulasi Kebutuhan Produk</h3>
              <p className="text-xs text-slate-500">Perbandingan kuantitas target vs total pesanan masuk</p>
            </div>

            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Nama Produk</th>
                  <th className="py-3 px-4">Target</th>
                  <th className="py-3 px-4">Total Pesanan</th>
                  <th className="py-3 px-4">Status Target</th>
                  <th className="py-3 px-4 text-right">Total Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recap.map((item: any) => (
                  <tr key={item.product.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block">{item.product.name}</span>
                      <span className="text-slate-400 text-xs">Satuan: {item.product.unit}</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-700">
                      {item.product.isTarget
                        ? `${item.product.targetQuantity} ${item.product.unit}`
                        : '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-900 text-base">
                        {item.totalQuantity} <span className="text-xs font-normal text-slate-500">{item.product.unit}</span>
                      </div>
                      {(item.consumerQuantity > 0 || item.traderQuantity > 0) && (
                        <div className="flex items-center gap-1.5 text-[11px] mt-1">
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                            Konsumen: {item.consumerQuantity}
                          </span>
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-medium">
                            Pedagang: {item.traderQuantity}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {item.product.isTarget ? (
                        item.isMet ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Tercapai ({item.percentage}%)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            <AlertCircle className="w-3 h-3" />
                            Kurang {Number(item.product.targetQuantity) - item.totalQuantity} {item.product.unit}
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-slate-400">Non-target</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(item.totalValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                <tr>
                  <td colSpan={4} className="py-3 px-4 text-right text-xs uppercase tracking-wider text-slate-600">
                    Total Nilai Rekap:
                  </td>
                  <td className="py-3 px-4 text-right text-base text-emerald-700">
                    {formatCurrency(
                      recap.reduce((sum: number, r: any) => sum + r.totalValue, 0)
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DAFTAR PESANAN */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Pesanan Anggota</h3>
              <p className="text-xs text-slate-500">
                💡 Klik baris pesanan untuk melihat rincian & mengedit pesanan
              </p>
            </div>
            <Link
              href={`/orders?cycleId=${cycle.id}&createOrder=true`}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3.5 py-2 rounded-lg text-xs"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              + Input Pesanan Baru
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            {orders.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">Belum ada pesanan di siklus ini.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Nama Anggota</th>
                    <th className="py-3 px-4">Sub-Grup</th>
                    <th className="py-3 px-4">Item Pesanan</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Status Bayar</th>
                    <th className="py-3 px-4">Status Kirim</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o: any) => (
                    <tr
                      key={o.id}
                      onClick={() => router.push(`/orders?cycleId=${cycle.id}&editOrderId=${o.id}`)}
                      className="hover:bg-emerald-50/50 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block group-hover:text-emerald-700 transition-colors">
                          {o.member.name}
                        </span>
                        <a
                          href={getWhatsAppUrl(o.member.phone, `Halo ${o.member.name}, mengenai pesanan sembako Anda di siklus ${cycle.label}:`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] text-emerald-600 hover:underline inline-flex items-center gap-1"
                        >
                          <MessageSquare className="w-2.5 h-2.5" />
                          {o.member.phone}
                        </a>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">{o.member.group?.name}</td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        {o.items.map((it: any) => (
                          <div key={it.id} className="flex items-center gap-1.5 py-0.5">
                            <span>{it.product.name} ({it.quantity} {it.product.unit})</span>
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
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {formatCurrency(o.totalAmount)}
                      </td>
                      <td className="py-3 px-4">
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
                      <td className="py-3 px-4">
                        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">
                          {o.orderStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-xs font-semibold text-emerald-600 group-hover:text-emerald-700 underline-offset-2 group-hover:underline">
                          Edit &rarr;
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: JADWAL ROTASI */}
      {activeTab === 'rotation' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Alokasi Anggota Rotasi ({rotation.length} Terjadwal)
              </h3>
              <p className="text-xs text-slate-500">
                Pilih sendiri anggota (Pengurus, PJ, atau Anggota Biasa) atau gunakan penjadwalan otomatis.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenAddRotationModal}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3.5 py-2 rounded-lg text-xs transition-all shadow-xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                + Tambah Anggota Manual
              </button>
              <button
                onClick={handleGenerateRotation}
                className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3.5 py-2 rounded-lg text-xs transition-all shrink-0"
              >
                <Repeat className="w-3.5 h-3.5" />
                Generate Otomatis
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            {rotation.length === 0 ? (
              <div className="text-center py-10 text-sm text-slate-500">
                Belum ada anggota yang dijadwalkan untuk siklus ini.
                <div className="mt-3 flex items-center justify-center gap-3">
                  <button
                    onClick={handleOpenAddRotationModal}
                    className="inline-flex items-center gap-1 text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Manual
                  </button>
                  <button
                    onClick={handleGenerateRotation}
                    className="inline-flex items-center gap-1 text-xs text-slate-700 font-semibold bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200"
                  >
                    <Repeat className="w-3.5 h-3.5" />
                    Generate Otomatis
                  </button>
                </div>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Nama Anggota</th>
                    <th className="py-3 px-4">Role / Level</th>
                    <th className="py-3 px-4">Sub-Grup</th>
                    <th className="py-3 px-4">Nomor HP</th>
                    <th className="py-3 px-4">Status Pemesanan</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rotation.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold text-slate-900">{r.member.name}</td>
                      <td className="py-3 px-4 text-xs">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            r.member.role === 'pengurus'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : r.member.role === 'pj'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {r.member.role === 'pengurus'
                            ? '🛡️ Pengurus (L3)'
                            : r.member.role === 'pj'
                            ? '⭐ PJ (L2)'
                            : '👤 Anggota (L1)'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">{r.member.group?.name}</td>
                      <td className="py-3 px-4 text-xs text-slate-500">{r.member.phone}</td>
                      <td className="py-3 px-4">
                        {r.status === 'ordered' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3 h-3" /> Sudah Order
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                            <Clock className="w-3 h-3" /> Terjadwal (Belum Order)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {r.status !== 'ordered' && (
                            <a
                              href={getWhatsAppUrl(
                                r.member.phone,
                                `Halo ${r.member.name}, Anda dijadwalkan order pada siklus sembako ${cycle.label}. Mohon kirimkan pesanan Anda sebelum hari Selasa.`
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md transition-colors"
                            >
                              <MessageSquare className="w-3 h-3" />
                              Ingatkan via WA
                            </a>
                          )}
                          <button
                            onClick={() => handleDeleteRotation(r.id, r.member.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            title="Hapus dari jadwal rotasi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* MANUAL ROTATION MODAL */}
      {addRotationModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Tambah Anggota ke Rotasi</h2>
              <button
                onClick={() => setAddRotationModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMemberRotation} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Anggota / PJ / Pengurus
                </label>
                <select
                  required
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:border-emerald-600"
                >
                  <option value="">-- Pilih Anggota --</option>
                  {allMembers.map((m) => {
                    const isAlreadyScheduled = rotation.some((r: any) => r.memberId === m.id)
                    const roleLabel =
                      m.role === 'pengurus'
                        ? '🛡️ Pengurus'
                        : m.role === 'pj'
                        ? '⭐ PJ'
                        : '👤 Anggota'
                    return (
                      <option
                        key={m.id}
                        value={m.id}
                        disabled={isAlreadyScheduled}
                      >
                        {m.name} ({m.phone}) [{m.group?.name || 'Tanpa Grup'}] — {roleLabel}{' '}
                        {isAlreadyScheduled ? '(Sudah Terjadwal)' : ''}
                      </option>
                    )
                  })}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Semua orang dalam database anggota (baik Pengurus, PJ, maupun Anggota) dapat ditambahkan ke jadwal rotasi.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddRotationModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={addingRotation || !selectedMemberId}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 shadow-xs"
                >
                  {addingRotation ? 'Menambahkan...' : 'Tambahkan ke Rotasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: HARGA MINGGUAN */}
      {activeTab === 'prices' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Katalog Harga Khusus Siklus Ini</h3>
              <p className="text-xs text-slate-500">Harga ini menjadi dasar penghitungan total pesanan anggota</p>
            </div>
            <button
              onClick={handleSavePrices}
              disabled={savingPrices}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg text-xs shadow-xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {savingPrices ? 'Menyimpan...' : 'Simpan Perubahan Harga'}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Nama Produk</th>
                  <th className="py-3 px-4">Satuan</th>
                  <th className="py-3 px-4 w-48">Harga Konsumen (Rp)</th>
                  <th className="py-3 px-4 w-48">Harga Pedagang (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prices.map((p, idx) => (
                  <tr key={p.productId} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-bold text-slate-900">{p.name}</td>
                    <td className="py-3 px-4 text-xs text-slate-500">{p.unit}</td>
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={p.consumerPrice}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          setPrices((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, consumerPrice: val, price: val } : item))
                          )
                        }}
                        className="w-full text-sm font-semibold border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-hidden focus:border-emerald-600"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={p.traderPrice}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          setPrices((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, traderPrice: val } : item))
                          )
                        }}
                        className="w-full text-sm font-semibold border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-hidden focus:border-emerald-600"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: PENERIMAAN BARANG (INVENTORY) */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          {/* Header & Quick Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-700 flex items-center justify-center">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Penerimaan Barang Siklus {cycle.label}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pencatatan barang masuk dari Supplier Level 4, verifikasi kuantitas fisik, dan kalkulasi HPP.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={fetchInventory}
                disabled={loadingInventory}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                title="Muat Ulang Data"
              >
                <RefreshCw className={`w-4 h-4 ${loadingInventory ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={handleCopyInventoryWA}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
                title="Salin Ringkasan ke WhatsApp"
              >
                {copiedInventoryWA ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedInventoryWA ? 'Tersalin!' : 'Salin WA'}
              </button>

              <button
                onClick={handleExportInventoryCSV}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
                title="Ekspor CSV"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>

              <button
                onClick={() => handleSaveInventory('draft')}
                disabled={savingInventory}
                className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                Simpan Draf
              </button>

              <button
                onClick={() => handleSaveInventory('confirmed')}
                disabled={savingInventory}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3.5 py-2 rounded-xl text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Konfirmasi
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Modal / HPP */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 block">Total Modal (HPP)</span>
              <span className="text-lg sm:text-xl font-black text-slate-900 mt-1 block">
                {formatCurrency(totalInvPurchaseCost)}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Pembelian dari Supplier L4
              </span>
            </div>

            {/* Total Omzet Penjualan */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 block">Total Omzet Penjualan</span>
              <span className="text-lg sm:text-xl font-black text-emerald-700 mt-1 block">
                {formatCurrency(totalInvRevenue)}
              </span>
              <span className="text-[11px] text-emerald-600 mt-1 block">
                Harga tagihan pesanan anggota
              </span>
            </div>

            {/* Estimasi Margin Kotor */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Margin Kotor</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    invGrossMargin >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {invMarginPercentage}%
                </span>
              </div>
              <span
                className={`text-lg sm:text-xl font-black mt-1 block ${
                  invGrossMargin >= 0 ? 'text-slate-900' : 'text-rose-600'
                }`}
              >
                {formatCurrency(invGrossMargin)}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">Omzet dikurangi HPP</span>
            </div>

            {/* Status Fisik & Selisih */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Status Fisik</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    receipt?.status === 'confirmed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {receipt?.status === 'confirmed' ? '✅ Terkonfirmasi' : '📝 Draf'}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800">
                  {totalInvReceivedQty} unit diterima
                </span>
              </div>
              <span
                className={`text-[11px] mt-1 block font-medium ${
                  invHasDiscrepancy ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {invHasDiscrepancy
                  ? `⚠️ Ada selisih / ${totalInvDamagedQty} rusak`
                  : '✅ Jumlah sesuai pesanan'}
              </span>
            </div>
          </div>

          {/* Main Table: Goods Receipt Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  Daftar Barang Diterima ({inventoryItems.length} Komoditas)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Masukkan kuantitas fisik yang tiba hari Kamis, barang rusak/susut, dan harga modal per unit (HPP).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSaveInventory('draft')}
                  disabled={savingInventory}
                  className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  Simpan Draf
                </button>

                <button
                  onClick={() => handleSaveInventory('confirmed')}
                  disabled={savingInventory}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3.5 py-1.5 rounded-lg text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Konfirmasi
                </button>
              </div>
            </div>

            {loadingInventory ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : inventoryItems.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                Belum ada data produk atau pesanan pada siklus ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Komoditas</th>
                      <th className="py-3 px-3 text-center">Dipesan</th>
                      <th className="py-3 px-3 text-center min-w-[110px]">Diterima Fisik</th>
                      <th className="py-3 px-3 text-center min-w-[90px]">Rusak/Susut</th>
                      <th className="py-3 px-3 text-center">Selisih</th>
                      <th className="py-3 px-3 min-w-[130px]">Harga Beli (HPP)</th>
                      <th className="py-3 px-3 text-right">Total Modal</th>
                      <th className="py-3 px-3 text-right">Omzet</th>
                      <th className="py-3 px-3 text-right">Margin</th>
                      <th className="py-3 px-4 min-w-[150px]">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inventoryItems.map((item, idx) => {
                      const itemCost = Number(item.purchasePrice) * Number(item.receivedQty)
                      const itemMargin = Number(item.revenue) - itemCost
                      const diff = Number(item.receivedQty) - Number(item.orderedQty)

                      return (
                        <tr key={item.productId} className="hover:bg-slate-50/80 transition-colors">
                          {/* Komoditas */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">{item.productName}</span>
                              {item.isTarget && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1 rounded">
                                  TARGET
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block">
                              Satuan: {item.unit} {item.category ? `• ${item.category}` : ''}
                            </span>
                          </td>

                          {/* Dipesan */}
                          <td className="py-3 px-3 text-center font-bold text-slate-700">
                            {item.orderedQty} {item.unit}
                          </td>

                          {/* Diterima Fisik */}
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={item.receivedQty}
                                onChange={(e) =>
                                  handleInventoryItemChange(idx, 'receivedQty', parseFloat(e.target.value) || 0)
                                }
                                className="w-20 text-center font-bold text-xs border border-slate-200 rounded-lg py-1 px-1.5 focus:outline-hidden focus:border-emerald-600 bg-white"
                              />
                              <span className="text-[11px] text-slate-400">{item.unit}</span>
                            </div>
                          </td>

                          {/* Rusak / Susut */}
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={item.damagedQty}
                                onChange={(e) =>
                                  handleInventoryItemChange(idx, 'damagedQty', parseFloat(e.target.value) || 0)
                                }
                                className={`w-16 text-center font-bold text-xs border rounded-lg py-1 px-1.5 focus:outline-hidden focus:border-emerald-600 bg-white ${
                                  item.damagedQty > 0
                                    ? 'border-rose-300 text-rose-700 bg-rose-50/50'
                                    : 'border-slate-200 text-slate-700'
                                }`}
                              />
                              <span className="text-[11px] text-slate-400">{item.unit}</span>
                            </div>
                          </td>

                          {/* Selisih */}
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block ${
                                diff === 0
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : diff > 0
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {diff === 0 ? '✅ Pas' : `${diff > 0 ? '+' : ''}${diff} ${item.unit}`}
                            </span>
                          </td>

                          {/* Harga Beli / HPP */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-slate-400 font-medium">Rp</span>
                              <input
                                type="number"
                                step="100"
                                min="0"
                                value={item.purchasePrice}
                                onChange={(e) =>
                                  handleInventoryItemChange(idx, 'purchasePrice', parseFloat(e.target.value) || 0)
                                }
                                placeholder="0"
                                className="w-24 text-right font-bold text-xs border border-slate-200 rounded-lg py-1 px-2 focus:outline-hidden focus:border-emerald-600 bg-white"
                              />
                            </div>
                          </td>

                          {/* Total Modal */}
                          <td className="py-3 px-3 text-right font-bold text-slate-800">
                            {formatCurrency(itemCost)}
                          </td>

                          {/* Omzet */}
                          <td className="py-3 px-3 text-right font-semibold text-slate-700">
                            {formatCurrency(item.revenue)}
                          </td>

                          {/* Margin */}
                          <td
                            className={`py-3 px-3 text-right font-bold ${
                              itemMargin >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {formatCurrency(itemMargin)}
                          </td>

                          {/* Catatan */}
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              value={item.notes || ''}
                              onChange={(e) => handleInventoryItemChange(idx, 'notes', e.target.value)}
                              placeholder="Kondisi barang..."
                              className="w-full text-xs border border-slate-200 rounded-lg py-1 px-2 focus:outline-hidden focus:border-emerald-600 bg-white"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>

                  {/* Total Footer Row */}
                  <tfoot className="bg-slate-50 font-bold text-xs text-slate-900 border-t-2 border-slate-200">
                    <tr>
                      <td className="py-3 px-4">TOTAL</td>
                      <td className="py-3 px-3 text-center">{totalInvOrderedQty} unit</td>
                      <td className="py-3 px-3 text-center">{totalInvReceivedQty} unit</td>
                      <td className="py-3 px-3 text-center text-rose-700">
                        {totalInvDamagedQty > 0 ? `${totalInvDamagedQty} rusak` : '-'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {totalInvReceivedQty - totalInvOrderedQty === 0
                          ? '✅ Klop'
                          : `${totalInvReceivedQty - totalInvOrderedQty > 0 ? '+' : ''}${
                              totalInvReceivedQty - totalInvOrderedQty
                            } unit`}
                      </td>
                      <td className="py-3 px-3"></td>
                      <td className="py-3 px-3 text-right text-slate-900 font-extrabold">
                        {formatCurrency(totalInvPurchaseCost)}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-800 font-extrabold">
                        {formatCurrency(totalInvRevenue)}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-black ${
                          invGrossMargin >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {formatCurrency(invGrossMargin)}
                      </td>
                      <td className="py-3 px-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Supplier Notes Section */}
            <div className="p-4 bg-slate-50/50 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1 w-full sm:max-w-xl">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Khusus dari Supplier / Kondisi Pengiriman:
                </label>
                <textarea
                  rows={2}
                  value={supplierNote}
                  onChange={(e) => setSupplierNote(e.target.value)}
                  placeholder="Contoh: Pengiriman tiba pukul 09.30 WIB, telur ada retak 3 butir langsung diganti, dll."
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={() => handleSaveInventory('draft')}
                  disabled={savingInventory}
                  className="px-4 py-2 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  Simpan Draf
                </button>
                <button
                  onClick={() => handleSaveInventory('confirmed')}
                  disabled={savingInventory}
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  Konfirmasi Penerimaan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
