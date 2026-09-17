'use client'

import React, { useEffect, useState } from 'react'
import {
  Target,
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  Users,
  AlertCircle,
  Download,
  Copy,
  Calendar,
  MessageSquare,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  RefreshCw,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts'
import { formatCurrency, formatDate, getWhatsAppUrl } from '@/lib/utils'
import { toast } from 'sonner'

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'targets' | 'financial' | 'commodity' | 'member' | 'receivable'>('targets')
  const [loading, setLoading] = useState(true)

  // Report states
  const [targetData, setTargetData] = useState<any>(null)
  const [financialData, setFinancialData] = useState<any>(null)
  const [commodityData, setCommodityData] = useState<any>(null)
  const [memberData, setMemberData] = useState<any>(null)
  const [receivableData, setReceivableData] = useState<any>(null)

  const fetchReport = async (type: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/reports?type=${type}`)
      if (!res.ok) throw new Error('Gagal memuat laporan')
      const json = await res.json()

      if (type === 'targets') setTargetData(json)
      if (type === 'financial') setFinancialData(json)
      if (type === 'commodity') setCommodityData(json)
      if (type === 'member') setMemberData(json)
      if (type === 'receivable') setReceivableData(json)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Gagal mengambil data laporan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport(activeTab)
  }, [activeTab])

  // Custom Tooltip for Charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-md text-xs">
          <p className="font-bold text-slate-800 mb-1.5">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={`item-${index}`} className="flex items-center gap-2 py-0.5 font-medium" style={{ color: entry.color }}>
              <span>• {entry.name}:</span>
              <span className="font-bold">{formatCurrency(entry.value)}</span>
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  // Export CSV based on active tab
  const handleExportCSV = () => {
    let headers: string[] = []
    let rows: any[][] = []
    let filename = `Laporan_${activeTab}.csv`

    if (activeTab === 'targets' && targetData) {
      headers = [
        'Siklus',
        'Status',
        'Target Ayam (kg)',
        'Stok Awal Ayam (kg)',
        'Masuk Ayam (kg)',
        'Terjual Ayam (kg)',
        'Karkas (kg)',
        'Recah (kg)',
        'Gebrus (kg)',
        'Status Ayam',
        'Sisa Ayam (kg)',
        'Target Tahu (bks)',
        'Stok Awal Tahu (bks)',
        'Masuk Tahu (bks)',
        'Terjual Tahu (bks)',
        'Status Tahu',
        'Sisa Tahu (bks)',
      ]
      rows = targetData.cycleReports.map((r: any) => [
        `"${r.cycleLabel}"`,
        r.status,
        r.chicken.target,
        r.chicken.beginningStock,
        r.chicken.goodsIn,
        r.chicken.sold,
        r.chicken.breakdown.karkas,
        r.chicken.breakdown.recah,
        r.chicken.breakdown.gebrus,
        r.chicken.isMet ? 'TERCAPAI' : `KURANG ${r.chicken.shortfall} kg`,
        r.chicken.endingStock,
        r.tofu.target,
        r.tofu.beginningStock,
        r.tofu.goodsIn,
        r.tofu.sold,
        r.tofu.isMet ? 'TERCAPAI' : `KURANG ${r.tofu.shortfall} bks`,
        r.tofu.endingStock,
      ])
    } else if (activeTab === 'financial' && financialData) {
      headers = ['Siklus', 'Status', 'Jumlah Pesanan', 'Omzet Penjualan', 'Modal (HPP)', 'Margin Kotor', '% Margin', 'Sudah Bayar', 'Piutang', '% Kepatuhan']
      rows = financialData.cycles.map((c: any) => [
        `"${c.cycleLabel}"`,
        c.status,
        c.orderCount,
        c.totalRevenue,
        c.totalCost,
        c.grossMargin,
        `${c.marginPct}%`,
        c.paidRevenue,
        c.unpaidRevenue,
        `${c.collectionRate}%`,
      ])
    } else if (activeTab === 'commodity' && commodityData) {
      headers = ['Komoditas', 'Satuan', 'Kategori', 'Dipesan', 'Diterima', 'Rusak', 'Omzet', 'Modal', 'Laba Bersih', '% Margin', 'Rata-rata Jual', 'Rata-rata Beli']
      rows = commodityData.commodities.map((c: any) => [
        `"${c.name}"`,
        c.unit,
        `"${c.category || '-'}"`,
        c.totalOrderedQty,
        c.totalReceivedQty,
        c.totalDamagedQty,
        c.totalRevenue,
        c.totalCost,
        c.grossProfit,
        `${c.profitMarginPct}%`,
        c.avgSellingPrice,
        c.avgPurchasePrice,
      ])
    } else if (activeTab === 'member' && memberData) {
      headers = ['Nama Anggota', 'No HP', 'Sub-Grup', 'Peran', 'Jumlah Pesanan', 'Total Belanja', 'Pesanan Lunas', 'Pesanan Belum Bayar', 'Piutang', '% Kepatuhan']
      rows = memberData.members.map((m: any) => [
        `"${m.name}"`,
        `"${m.phone}"`,
        `"${m.groupName}"`,
        m.role,
        m.orderCount,
        m.totalSpend,
        m.paidCount,
        m.unpaidCount,
        m.unpaidAmount,
        `${m.paymentRate}%`,
      ])
    } else if (activeTab === 'receivable' && receivableData) {
      headers = ['Anggota', 'No HP', 'Sub-Grup', 'Siklus', 'Tagihan', 'Keterlambatan (Hari)', 'Rincian Produk']
      rows = receivableData.orders.map((o: any) => [
        `"${o.memberName}"`,
        `"${o.memberPhone}"`,
        `"${o.groupName}"`,
        `"${o.cycleLabel}"`,
        o.totalAmount,
        `${o.daysOverdue} hari`,
        `"${o.itemSummary}"`,
      ])
    }

    if (rows.length === 0) {
      toast.error('Tidak ada data untuk diekspor')
      return
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('File CSV berhasil diunduh!')
  }

  // Copy WhatsApp summary
  const handleCopySummary = () => {
    let text = ''
    if (activeTab === 'targets' && targetData) {
      text = `🎯 *LAPORAN TARGET & SISA STOK HATO*\n`
      text += `Total Siklus: ${targetData.summary.totalCycles}\n`
      text += `Ketercapaian Target Ayam (20kg): ${targetData.summary.chickenSuccessRate}%\n`
      text += `Ketercapaian Target Tahu (20bks): ${targetData.summary.tofuSuccessRate}%\n`
      text += `Sisa Stok Ayam Mengendap Saat Ini: ${targetData.summary.currentChickenLeftover} kg\n`
      text += `Sisa Stok Tahu Mengendap Saat Ini: ${targetData.summary.currentTofuLeftover} bks\n`
      text += `------------------------------------\n`
      targetData.cycleReports.forEach((r: any) => {
        text += `*${r.cycleLabel}*\n`
        text += `• Ayam Campur: Terjual ${r.chicken.sold}/${r.chicken.target} kg (${r.chicken.percentage}%) - ${r.chicken.isMet ? '✅ Tercapai' : `❌ Kurang ${r.chicken.shortfall}kg`}\n`
        text += `  (Rincian: Karkas ${r.chicken.breakdown.karkas}kg, Recah ${r.chicken.breakdown.recah}kg, Gebrus ${r.chicken.breakdown.gebrus}kg)\n`
        text += `  Stok Awal: ${r.chicken.beginningStock}kg | Sisa Belum Terjual: ${r.chicken.endingStock}kg\n`
        text += `• Tahu Campur: Terjual ${r.tofu.sold}/${r.tofu.target} bks (${r.tofu.percentage}%) - ${r.tofu.isMet ? '✅ Tercapai' : `❌ Kurang ${r.tofu.shortfall}bks`}\n`
        if (r.tofu.breakdown) {
          text += `  (Rincian: Kuning ${r.tofu.breakdown.kuning}bks, Putih ${r.tofu.breakdown.putih}bks)\n`
        }
        text += `  Stok Awal: ${r.tofu.beginningStock}bks | Sisa Belum Terjual: ${r.tofu.endingStock}bks\n\n`
      })
      text += `Catatan: Sisa barang belum terjual otomatis menjadi stok awal di siklus berikutnya.`
    } else if (activeTab === 'financial' && financialData) {
      text = `📊 *LAPORAN KEUANGAN HATO MANAJER*\n`
      text += `Total Siklus: ${financialData.summary.totalCycles}\n`
      text += `Total Omzet: ${formatCurrency(financialData.summary.totalRevenue)}\n`
      text += `Total Modal (HPP): ${formatCurrency(financialData.summary.totalCost)}\n`
      text += `Total Margin Kotor: ${formatCurrency(financialData.summary.totalGrossMargin)} (${financialData.summary.overallMarginPct}%)\n`
      text += `Total Piutang Tertunggak: ${formatCurrency(financialData.summary.totalUnpaid)}\n`
      text += `Tingkat Kepatuhan Bayar: ${financialData.summary.overallCollectionRate}%\n`
    } else if (activeTab === 'receivable' && receivableData) {
      text = `📋 *REKAP PIUTANG & TAGIHAN BELUM BAYAR*\n`
      text += `Total Piutang: ${formatCurrency(receivableData.summary.totalUnpaidAmount)}\n`
      text += `Pesanan Belum Bayar: ${receivableData.summary.totalUnpaidOrders} pesanan\n`
      text += `Jumlah Anggota: ${receivableData.summary.totalMembersWithDebt} orang\n`
      text += `------------------------------------\n`
      receivableData.members.forEach((m: any, i: number) => {
        text += `${i + 1}. *${m.memberName}* (${m.groupName}): ${formatCurrency(m.totalUnpaid)} (${m.ordersCount} pesanan)\n`
      })
    } else {
      text = `Laporan HATO Manajer - ${activeTab.toUpperCase()}`
    }

    navigator.clipboard.writeText(text)
    toast.success('Ringkasan berhasil disalin ke clipboard!')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-700 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Laporan & Analitik Distribusi
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluasi target ayam & tahu mingguan, stok belum terjual, margin keuntungan, dan status piutang multi-siklus.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchReport(activeTab)}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            title="Muat Ulang"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            Salin WA
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Ekspor CSV
          </button>
        </div>
      </div>

      {/* Tabs Bar — Modern Segmented Control */}
      <div className="flex p-1.5 bg-slate-200/60 rounded-xl border border-slate-200 gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('targets')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'targets'
              ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Target className={`w-4 h-4 ${activeTab === 'targets' ? 'text-emerald-600' : 'text-slate-400'}`} />
          Target & Sisa Stok
        </button>

        <button
          onClick={() => setActiveTab('financial')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'financial'
              ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <DollarSign className={`w-4 h-4 ${activeTab === 'financial' ? 'text-emerald-600' : 'text-slate-400'}`} />
          Keuangan & Margin
        </button>

        <button
          onClick={() => setActiveTab('commodity')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'commodity'
              ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Package className={`w-4 h-4 ${activeTab === 'commodity' ? 'text-emerald-600' : 'text-slate-400'}`} />
          Performa Komoditas
        </button>

        <button
          onClick={() => setActiveTab('member')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'member'
              ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Users className={`w-4 h-4 ${activeTab === 'member' ? 'text-emerald-600' : 'text-slate-400'}`} />
          Anggota & Sub-Grup
        </button>

        <button
          onClick={() => setActiveTab('receivable')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'receivable'
              ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <AlertCircle className={`w-4 h-4 ${activeTab === 'receivable' ? 'text-emerald-600' : 'text-slate-400'}`} />
          Piutang & Tagihan
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh] bg-white rounded-2xl border border-slate-200">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* TAB 0: TARGET & SISA STOK (AYAM & TAHU) */}
          {activeTab === 'targets' && targetData && (
            <div className="space-y-5">
              {/* Summary Cards — 4 Clean Balanced Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Target Ayam Campur */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Target Ayam Campur</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      {targetData.summary.chickenSuccessRate}% Sukses
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-slate-900">20</span>
                    <span className="text-xs font-semibold text-slate-500">kg / minggu</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Karkas + Recah + Gebrus ({targetData.summary.chickenMetCount}/{targetData.summary.totalCycles} siklus)
                  </p>
                </div>

                {/* Sisa Ayam Terkini */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Sisa Ayam Terkini</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
                      Stok Mengendap
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-amber-900">{targetData.summary.currentChickenLeftover}</span>
                    <span className="text-xs font-semibold text-amber-700">kg</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Otomatis dibawa menjadi stok awal minggu depan
                  </p>
                </div>

                {/* Target Tahu Campur */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Target Tahu Campur</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                      {targetData.summary.tofuSuccessRate}% Sukses
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-slate-900">20</span>
                    <span className="text-xs font-semibold text-slate-500">bks / minggu</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Tahu Kuning + Tahu Putih ({targetData.summary.tofuMetCount}/{targetData.summary.totalCycles} siklus)
                  </p>
                </div>

                {/* Sisa Tahu Terkini */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Sisa Tahu Terkini</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
                      Stok Mengendap
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-amber-900">{targetData.summary.currentTofuLeftover}</span>
                    <span className="text-xs font-semibold text-amber-700">bks</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Otomatis dibawa menjadi stok awal minggu depan
                  </p>
                </div>
              </div>

              {/* Compact Policy Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>
                    <strong>Aturan Target:</strong> Ayam Campur (Karkas, Recah, Gebrus) target 20 kg/minggu. Tahu Campur (Kuning & Putih) target 20 bks/minggu.
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Barang masuk sesuai kuota targetan • Sisa belum terjual dialirkan ke siklus berikutnya
                </span>
              </div>

              {/* Dual Side-by-Side Dedicated Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Chart Ayam */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">🍗 Tren Ayam Campur (kg)</h4>
                      <p className="text-[11px] text-slate-400">Target 20 kg vs Kuantitas Terjual vs Sisa Stok</p>
                    </div>
                  </div>
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={targetData.chartData} barCategoryGap="25%" margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip
                          formatter={(value: any) => [`${value} kg`, '']}
                          contentStyle={{ borderRadius: '12px', fontSize: '11px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                        <Bar dataKey="Target Ayam" fill="#cbd5e1" barSize={14} radius={[3, 3, 0, 0]} />
                        <Bar dataKey="Ayam Terjual" fill="#059669" barSize={14} radius={[3, 3, 0, 0]} />
                        <Bar dataKey="Sisa Ayam" fill="#f59e0b" barSize={14} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart Tahu */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">🧈 Tren Tahu Campur (bungkus)</h4>
                      <p className="text-[11px] text-slate-400">Target 20 bks vs Kuantitas Terjual vs Sisa Stok</p>
                    </div>
                  </div>
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={targetData.chartData} barCategoryGap="25%" margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip
                          formatter={(value: any) => [`${value} bks`, '']}
                          contentStyle={{ borderRadius: '12px', fontSize: '11px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                        <Bar dataKey="Target Tahu" fill="#cbd5e1" barSize={14} radius={[3, 3, 0, 0]} />
                        <Bar dataKey="Tahu Terjual" fill="#2563eb" barSize={14} radius={[3, 3, 0, 0]} />
                        <Bar dataKey="Sisa Tahu" fill="#f59e0b" barSize={14} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Table: Multi-Cycle Target & Stock Flow */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Laporan Aliran Stok & Ketercapaian per Siklus</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Menampilkan stok awal, barang masuk, realisasi pesanan anggota, status target, dan sisa stok akhir.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4 border-r border-slate-200">Siklus</th>
                        <th colSpan={5} className="py-2.5 px-3 text-center bg-emerald-50/60 border-r border-slate-200 text-emerald-900">
                          🍗 AYAM CAMPUR (Target: 20 kg/minggu)
                        </th>
                        <th colSpan={5} className="py-2.5 px-3 text-center bg-blue-50/60 text-blue-900">
                          🧈 TAHU CAMPUR (Target: 20 bks/minggu)
                        </th>
                      </tr>
                      <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-500 font-semibold text-[10px]">
                        <th className="py-2 px-4 border-r border-slate-200">Label</th>
                        {/* Ayam Columns */}
                        <th className="py-2 px-2.5 text-center">Stok Awal</th>
                        <th className="py-2 px-2.5 text-center">Masuk</th>
                        <th className="py-2 px-3">Terjual (Rincian)</th>
                        <th className="py-2 px-2.5 text-center">Status Target</th>
                        <th className="py-2 px-3 text-center bg-amber-50/50 border-r border-slate-200 font-bold text-amber-900">
                          Sisa Akhir (Stok Depan)
                        </th>
                        {/* Tahu Columns */}
                        <th className="py-2 px-2.5 text-center">Stok Awal</th>
                        <th className="py-2 px-2.5 text-center">Masuk</th>
                        <th className="py-2 px-3">Terjual (Rincian)</th>
                        <th className="py-2 px-2.5 text-center">Status Target</th>
                        <th className="py-2 px-3 text-center bg-amber-50/50 font-bold text-amber-900">
                          Sisa Akhir (Stok Depan)
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {targetData.cycleReports.map((r: any) => (
                        <tr key={r.cycleId} className="hover:bg-slate-50/80 transition-colors">
                          {/* Siklus */}
                          <td className="py-3.5 px-4 font-bold text-slate-900 border-r border-slate-200">
                            {r.cycleLabel}
                            <span className="text-[11px] font-normal text-slate-400 block">
                              Distribusi: {formatDate(r.deliveryDate)}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 uppercase">
                              Status: {r.status}
                            </span>
                          </td>

                          {/* Ayam: Stok Awal */}
                          <td className="py-3.5 px-2.5 text-center font-semibold text-slate-700">
                            {r.chicken.beginningStock} kg
                          </td>

                          {/* Ayam: Masuk */}
                          <td className="py-3.5 px-2.5 text-center font-bold text-slate-800">
                            {r.chicken.goodsIn} kg
                          </td>

                          {/* Ayam: Terjual (Rincian) */}
                          <td className="py-3.5 px-3">
                            <div className="font-extrabold text-slate-900">
                              {r.chicken.sold} / {r.chicken.target} kg
                            </div>
                            <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px] text-slate-500">
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded">Karkas: {r.chicken.breakdown.karkas}kg</span>
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded">Recah: {r.chicken.breakdown.recah}kg</span>
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded">Gebrus: {r.chicken.breakdown.gebrus}kg</span>
                            </div>
                          </td>

                          {/* Ayam: Status Target */}
                          <td className="py-3.5 px-2.5 text-center">
                            {r.chicken.isMet ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3" />
                                Tercapai ({r.chicken.percentage}%)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                                <AlertCircle className="w-3 h-3" />
                                Kurang {r.chicken.shortfall}kg ({r.chicken.percentage}%)
                              </span>
                            )}
                          </td>

                          {/* Ayam: Sisa Akhir */}
                          <td className="py-3.5 px-3 text-center bg-amber-50/40 border-r border-slate-200">
                            <span className="text-xs font-black px-2 py-1 rounded-md bg-amber-100 text-amber-900 inline-block">
                              {r.chicken.endingStock} kg
                            </span>
                          </td>

                          {/* Tahu: Stok Awal */}
                          <td className="py-3.5 px-2.5 text-center font-semibold text-slate-700">
                            {r.tofu.beginningStock} bks
                          </td>

                          {/* Tahu: Masuk */}
                          <td className="py-3.5 px-2.5 text-center font-bold text-slate-800">
                            {r.tofu.goodsIn} bks
                          </td>

                          {/* Tahu: Terjual (Rincian) */}
                          <td className="py-3.5 px-3">
                            <div className="font-extrabold text-slate-900">
                              {r.tofu.sold} / {r.tofu.target} bks
                            </div>
                            {r.tofu.breakdown && (
                              <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px] text-slate-500">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded">Kuning: {r.tofu.breakdown.kuning}bks</span>
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded">Putih: {r.tofu.breakdown.putih}bks</span>
                              </div>
                            )}
                          </td>

                          {/* Tahu: Status Target */}
                          <td className="py-3.5 px-2.5 text-center">
                            {r.tofu.isMet ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3" />
                                Tercapai
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                                <AlertCircle className="w-3 h-3" />
                                Kurang {r.tofu.shortfall}bks
                              </span>
                            )}
                          </td>

                          {/* Tahu: Sisa Akhir */}
                          <td className="py-3.5 px-3 text-center bg-amber-50/40">
                            <span className="text-xs font-black px-2 py-1 rounded-md bg-amber-100 text-amber-900 inline-block">
                              {r.tofu.endingStock} bks
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: FINANCIAL REPORT */}
          {activeTab === 'financial' && financialData && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-xs font-semibold text-slate-500 block">Total Omzet</span>
                  <span className="text-lg sm:text-xl font-black text-slate-900 mt-1.5 block">
                    {formatCurrency(financialData.summary.totalRevenue)}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1 block">Seluruh pesanan masuk</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-xs font-semibold text-slate-500 block">Total Modal (HPP)</span>
                  <span className="text-lg sm:text-xl font-black text-slate-900 mt-1.5 block">
                    {formatCurrency(financialData.summary.totalCost)}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1 block">Pembelian dari supplier</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Margin Kotor</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full">
                      {financialData.summary.overallMarginPct}%
                    </span>
                  </div>
                  <span className="text-lg sm:text-xl font-black text-emerald-700 mt-1.5 block">
                    {formatCurrency(financialData.summary.totalGrossMargin)}
                  </span>
                  <span className="text-[11px] text-emerald-600 mt-1 block">Keuntungan kotor</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Sudah Lunas</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full">
                      {financialData.summary.overallCollectionRate}%
                    </span>
                  </div>
                  <span className="text-lg sm:text-xl font-black text-emerald-700 mt-1.5 block">
                    {formatCurrency(financialData.summary.totalPaid)}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Terkoleksi ke kas
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs col-span-1 sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Piutang Belum Bayar</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200/60 rounded-full">
                      Tertunda
                    </span>
                  </div>
                  <span className="text-lg sm:text-xl font-black text-rose-600 mt-1.5 block">
                    {formatCurrency(financialData.summary.totalUnpaid)}
                  </span>
                  <span className="text-[11px] text-rose-500 mt-1 block">Tagihan tertunggak</span>
                </div>
              </div>

              {/* Chart: Revenue vs Cost vs Margin */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Tren Keuangan Antar Siklus</h3>
                    <p className="text-xs text-slate-500">Perbandingan Omzet, Modal (HPP), dan Margin per Siklus</p>
                  </div>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financialData.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="shortLabel" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(val) => `Rp ${(val / 1000).toLocaleString('id-ID')}k`} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                      <Bar dataKey="Pendapatan" fill="#059669" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Modal" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Margin" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Table: Financial per Cycle */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-4 bg-slate-50/70 border-b border-slate-200">
                  <h3 className="font-bold text-slate-900 text-sm">Rincian Finansial per Siklus</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Siklus</th>
                        <th className="py-3 px-3 text-center">Pesanan</th>
                        <th className="py-3 px-3 text-right">Omzet</th>
                        <th className="py-3 px-3 text-right">Modal (HPP)</th>
                        <th className="py-3 px-3 text-right">Margin Kotor</th>
                        <th className="py-3 px-3 text-center">% Margin</th>
                        <th className="py-3 px-3 text-right">Lunas</th>
                        <th className="py-3 px-3 text-right">Piutang</th>
                        <th className="py-3 px-4 text-center">% Koleksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {financialData.cycles.map((c: any) => (
                        <tr key={c.cycleId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {c.cycleLabel}
                            <span className="text-[11px] font-normal text-slate-400 block">
                              Distribusi: {formatDate(c.deliveryDate)}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-center font-bold text-slate-700">{c.orderCount}</td>
                          <td className="py-3.5 px-3 text-right font-extrabold text-slate-900">{formatCurrency(c.totalRevenue)}</td>
                          <td className="py-3.5 px-3 text-right font-semibold text-slate-600">{formatCurrency(c.totalCost)}</td>
                          <td className="py-3.5 px-3 text-right font-black text-emerald-700">{formatCurrency(c.grossMargin)}</td>
                          <td className="py-3.5 px-3 text-center">
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              {c.marginPct}%
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right font-semibold text-emerald-700">{formatCurrency(c.paidRevenue)}</td>
                          <td className="py-3.5 px-3 text-right font-bold text-rose-600">{formatCurrency(c.unpaidRevenue)}</td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              c.collectionRate === 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {c.collectionRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COMMODITY REPORT */}
          {activeTab === 'commodity' && commodityData && (
            <div className="space-y-6">
              {/* Top Commodities Chart */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <h3 className="font-bold text-slate-900 text-sm mb-1">Volume Pemesanan per Komoditas</h3>
                <p className="text-xs text-slate-500 mb-4">Perbandingan Kuantitas Dipesan vs Diterima</p>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={commodityData.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                      <Bar dataKey="Dipesan" fill="#059669" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Diterima" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Rusak" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Commodity Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-4 bg-slate-50/70 border-b border-slate-200">
                  <h3 className="font-bold text-slate-900 text-sm">Akumulasi Performa Komoditas</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Komoditas</th>
                        <th className="py-3 px-3 text-center">Dipesan</th>
                        <th className="py-3 px-3 text-center">Diterima</th>
                        <th className="py-3 px-3 text-center">Rusak</th>
                        <th className="py-3 px-3 text-right">Total Omzet</th>
                        <th className="py-3 px-3 text-right">Total Modal</th>
                        <th className="py-3 px-3 text-right">Laba Kotor</th>
                        <th className="py-3 px-3 text-center">% Margin</th>
                        <th className="py-3 px-4 text-right">Rata2 Jual / Beli</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {commodityData.commodities.map((item: any) => (
                        <tr key={item.productId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {item.name}
                            <span className="text-[11px] font-normal text-slate-400 block">
                              Satuan: {item.unit} {item.category ? `• ${item.category}` : ''}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-center font-bold text-slate-700">
                            {item.totalOrderedQty} {item.unit}
                          </td>
                          <td className="py-3.5 px-3 text-center font-medium text-slate-600">
                            {item.totalReceivedQty} {item.unit}
                          </td>
                          <td className="py-3.5 px-3 text-center font-bold text-rose-600">
                            {item.totalDamagedQty > 0 ? `${item.totalDamagedQty} ${item.unit}` : '-'}
                          </td>
                          <td className="py-3.5 px-3 text-right font-extrabold text-slate-900">
                            {formatCurrency(item.totalRevenue)}
                          </td>
                          <td className="py-3.5 px-3 text-right font-semibold text-slate-600">
                            {formatCurrency(item.totalCost)}
                          </td>
                          <td className="py-3.5 px-3 text-right font-black text-emerald-700">
                            {formatCurrency(item.grossProfit)}
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              {item.profitMarginPct}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right text-xs">
                            <span className="font-bold text-slate-800 block">{formatCurrency(item.avgSellingPrice)}</span>
                            <span className="text-[11px] text-slate-400 block">HPP: {formatCurrency(item.avgPurchasePrice)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MEMBER & GROUP REPORT */}
          {activeTab === 'member' && memberData && (
            <div className="space-y-6">
              {/* Group Participation Cards */}
              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-3">Tingkat Partisipasi per Sub-Grup</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {memberData.groups.map((g: any) => (
                    <div key={g.groupId} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 text-sm">{g.name}</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-full">
                          L{g.level}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-xl font-black text-emerald-700">{g.participationRate}%</span>
                        <span className="text-xs text-slate-500">
                          ({g.activeMembers}/{g.totalMembers} aktif)
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-600 mt-2 block">
                        Akumulasi: {formatCurrency(g.totalGroupSpend)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Members Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-4 bg-slate-50/70 border-b border-slate-200">
                  <h3 className="font-bold text-slate-900 text-sm">Peringkat & Kepatuhan Belanja Anggota</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Anggota</th>
                        <th className="py-3 px-3">Sub-Grup</th>
                        <th className="py-3 px-3 text-center">Jumlah Order</th>
                        <th className="py-3 px-3 text-right">Akumulasi Belanja</th>
                        <th className="py-3 px-3 text-center">Order Lunas</th>
                        <th className="py-3 px-3 text-right">Piutang</th>
                        <th className="py-3 px-4 text-center">Kepatuhan Bayar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {memberData.members.map((m: any, idx: number) => (
                        <tr key={m.memberId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 block">
                              #{idx + 1} {m.name}
                            </span>
                            <span className="text-[11px] text-slate-400 block">{m.phone}</span>
                          </td>
                          <td className="py-3.5 px-3 font-medium text-slate-700">{m.groupName}</td>
                          <td className="py-3.5 px-3 text-center font-bold text-slate-800">{m.orderCount}×</td>
                          <td className="py-3.5 px-3 text-right font-black text-slate-900">
                            {formatCurrency(m.totalSpend)}
                          </td>
                          <td className="py-3.5 px-3 text-center font-semibold text-emerald-700">
                            {m.paidCount}/{m.orderCount}
                          </td>
                          <td className="py-3.5 px-3 text-right font-bold text-rose-600">
                            {m.unpaidAmount > 0 ? formatCurrency(m.unpaidAmount) : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                m.paymentRate === 100
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : m.paymentRate >= 50
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {m.paymentRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RECEIVABLES / PIUTANG REPORT */}
          {activeTab === 'receivable' && receivableData && (
            <div className="space-y-6">
              {/* Receivable KPI Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="bg-rose-50/70 p-5 rounded-2xl border border-rose-200 shadow-2xs">
                  <span className="text-xs font-semibold text-rose-700 block">Total Piutang Belum Tertagih</span>
                  <span className="text-2xl font-black text-rose-900 mt-1.5 block">
                    {formatCurrency(receivableData.summary.totalUnpaidAmount)}
                  </span>
                  <span className="text-[11px] text-rose-600/80 mt-1 block">Akumulasi seluruh siklus</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-xs font-semibold text-slate-500 block">Jumlah Pesanan Tertunggak</span>
                  <span className="text-2xl font-black text-slate-900 mt-1.5 block">
                    {receivableData.summary.totalUnpaidOrders} <span className="text-sm font-semibold text-slate-500">Pesanan</span>
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1 block">Menunggu pembayaran</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-xs font-semibold text-slate-500 block">Anggota dengan Tagihan</span>
                  <span className="text-2xl font-black text-slate-900 mt-1.5 block">
                    {receivableData.summary.totalMembersWithDebt} <span className="text-sm font-semibold text-slate-500">Orang</span>
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1 block">Perlu diingatkan via WA</span>
                </div>
              </div>

              {/* Unpaid Orders Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-4 bg-slate-50/70 border-b border-slate-200">
                  <h3 className="font-bold text-slate-900 text-sm">Daftar Tagihan Pesanan Belum Lunas</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Gunakan tombol WhatsApp untuk mengirimkan pesan penagihan langsung ke anggota.
                  </p>
                </div>

                {receivableData.orders.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    🎉 Luar biasa! Tidak ada piutang yang tertunggak saat ini.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Anggota</th>
                          <th className="py-3 px-3">Sub-Grup</th>
                          <th className="py-3 px-3">Siklus</th>
                          <th className="py-3 px-3">Rincian Item</th>
                          <th className="py-3 px-3 text-right">Tagihan</th>
                          <th className="py-3 px-3 text-center">Keterlambatan</th>
                          <th className="py-3 px-4 text-right">Aksi Tagih</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {receivableData.orders.map((order: any) => {
                          const waMsg = `Halo ${order.memberName}, kami dari Pengurus HATO mengingatkan bahwa tagihan pesanan sembako Anda untuk siklus *${order.cycleLabel}* sebesar *${formatCurrency(order.totalAmount)}* saat ini masih belum lunas. Mohon konfirmasi atau lakukan pembayaran melalui PJ Sub-Grup ${order.groupName}. Terima kasih! 🙏`
                          const waUrl = getWhatsAppUrl(order.memberPhone, waMsg)

                          return (
                            <tr key={order.orderId} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3.5 px-4">
                                <span className="font-bold text-slate-900 block">{order.memberName}</span>
                                <span className="text-[11px] text-slate-400 block">{order.memberPhone}</span>
                              </td>
                              <td className="py-3.5 px-3 font-medium text-slate-700">{order.groupName}</td>
                              <td className="py-3.5 px-3 font-semibold text-slate-800">{order.cycleLabel}</td>
                              <td className="py-3.5 px-3 text-xs text-slate-600 max-w-xs truncate">
                                {order.itemSummary}
                              </td>
                              <td className="py-3.5 px-3 text-right font-black text-rose-600">
                                {formatCurrency(order.totalAmount)}
                              </td>
                              <td className="py-3.5 px-3 text-center">
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                                  {order.daysOverdue} hari
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-2xs"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  Tagih WA
                                </a>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
