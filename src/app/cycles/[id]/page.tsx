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
} from 'lucide-react'
import { formatCurrency, formatDate, getWhatsAppUrl } from '@/lib/utils'
import { toast } from 'sonner'

export default function CycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'recap' | 'orders' | 'rotation' | 'prices'>('recap')

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

  useEffect(() => {
    fetchDetail()
  }, [id])

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
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all shrink-0 ${
            activeTab === 'prices'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Harga Mingguan ({prices.length})
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
              href={`/orders?cycleId=${cycle.id}`}
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
    </div>
  )
}
