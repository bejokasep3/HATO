'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  CreditCard,
  Users,
  ShoppingCart,
  ArrowRight,
  MessageSquare,
  Plus,
  Package,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import { formatCurrency, formatDate, getWhatsAppUrl } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface DashboardData {
  hasCycle: boolean
  allCycles?: Array<{
    id: string
    label: string
    status: string
    periodStart: string
    orderDeadline: string
    deliveryDate: string
  }>
  message?: string
  currentCycle?: {
    id: string
    label: string
    periodStart: string
    orderDeadline: string
    deliveryDate: string
    status: string
    notes?: string
  }
  targets?: Array<{
    id: string
    name: string
    unit: string
    targetQuantity: number
    actualQuantity: number
    percentage: number
    isMet: boolean
    beginningStock?: number
    goodsIn?: number
    unsoldStock?: number
    breakdown?: Array<{
      name: string
      quantity: number
    }>
  }>
  rotation?: {
    scheduledCount: number
    orderedCount: number
    percentage: number
    pendingMembers: Array<{
      id: string
      name: string
      phone: string
      groupName: string
    }>
    members?: Array<{
      id: string
      scheduleId: string
      name: string
      phone: string
      groupName: string
      role: string
      status: string
      isOrdered: boolean
    }>
  }
  payments?: {
    totalOrders: number
    totalBilling: number
    paidAmount: number
    unpaidAmount: number
    paidCount: number
    unpaidCount: number
  }
  recentOrders?: Array<{
    id: string
    memberName: string
    groupName: string
    totalAmount: number
    paymentStatus: string
    orderStatus: string
    createdAt: string
    itemCount: number
  }>
  totalMembers?: number
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [switchingCycle, setSwitchingCycle] = useState(false)
  const [rotationFilter, setRotationFilter] = useState<'all' | 'pending' | 'ordered'>('all')

  const fetchDashboard = async (cycleId?: string) => {
    try {
      if (cycleId) {
        setSwitchingCycle(true)
      } else {
        setLoading(true)
      }
      const url = cycleId ? `/api/dashboard?cycleId=${cycleId}` : '/api/dashboard'
      const res = await fetch(url)
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
      setSwitchingCycle(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Memuat dashboard operasional...</p>
        </div>
      </div>
    )
  }

  if (!data?.hasCycle || !data.currentCycle) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 p-8 text-center max-w-xl mx-auto my-12 shadow-xs">
        <div className="w-12 h-12 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center mx-auto mb-4 border border-amber-200/60">
          <Calendar className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 mb-2 tracking-tight">Belum Ada Siklus Aktif</h2>
        <p className="text-slate-600 mb-6 text-sm">
          Mulai dengan membuat siklus pemesanan baru untuk menjadwalkan rotasi anggota dan menentukan harga mingguan.
        </p>
        <Link href="/cycles">
          <Button variant="primary" icon={<Plus className="w-4 h-4" />}>
            Buat Siklus Baru
          </Button>
        </Link>
      </div>
    )
  }

  const cycle = data.currentCycle
  const allCycles = data.allCycles || []
  const currentCycleIndex = allCycles.findIndex((c) => c.id === cycle.id)
  const prevCycle =
    currentCycleIndex !== -1 && currentCycleIndex < allCycles.length - 1
      ? allCycles[currentCycleIndex + 1]
      : null
  const nextCycle = currentCycleIndex > 0 ? allCycles[currentCycleIndex - 1] : null

  const targets = data.targets || []
  const rotation = data.rotation
  const payments = data.payments

  const scheduledMembers = rotation?.members || []
  const pendingCount = scheduledMembers.filter((m) => !m.isOrdered).length
  const orderedCount = scheduledMembers.filter((m) => m.isOrdered).length

  const filteredRotationMembers = scheduledMembers.filter((m) => {
    if (rotationFilter === 'pending') return !m.isOrdered
    if (rotationFilter === 'ordered') return m.isOrdered
    return true
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. MASTER COMMAND STRIP (Tactile Stepper & Operational Timeline) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Cycle Picker & Identity */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex items-center bg-slate-100/90 rounded-xl p-1 border border-slate-200/80">
              <button
                onClick={() => prevCycle && fetchDashboard(prevCycle.id)}
                disabled={!prevCycle || switchingCycle}
                title={prevCycle ? `Lihat ${prevCycle.label}` : 'Tidak ada siklus sebelumnya'}
                className="p-1.5 rounded-lg hover:bg-white hover:text-slate-900 disabled:opacity-30 text-slate-600 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="relative px-3">
                <select
                  value={cycle.id}
                  onChange={(e) => fetchDashboard(e.target.value)}
                  disabled={switchingCycle}
                  className="bg-transparent appearance-none font-bold text-slate-900 text-sm pr-6 py-0.5 focus:outline-none cursor-pointer tracking-tight"
                >
                  {allCycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} {c.status === 'open' ? '• Buka' : c.status === 'draft' ? '• Draf' : '• Selesai'}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <button
                onClick={() => nextCycle && fetchDashboard(nextCycle.id)}
                disabled={!nextCycle || switchingCycle}
                title={nextCycle ? `Lihat ${nextCycle.label}` : 'Tidak ada siklus berikutnya'}
                className="p-1.5 rounded-lg hover:bg-white hover:text-slate-900 disabled:opacity-30 text-slate-600 transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* State Pill */}
            <span
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold border ${
                cycle.status === 'open'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : cycle.status === 'draft'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {cycle.status === 'open' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Siklus Aktif
                </>
              ) : cycle.status === 'draft' ? (
                'Draf Persiapan'
              ) : (
                'Arsip Selesai'
              )}
            </span>

            {switchingCycle && (
              <span className="text-xs text-slate-500 italic animate-pulse">Memuat data siklus...</span>
            )}
          </div>

          {/* Fast Actions Deck */}
          <div className="flex items-center gap-2.5 self-start lg:self-auto">
            <Link
              href={`/cycles/${cycle.id}`}
            >
              <Button variant="secondary" size="sm" icon={<MessageSquare className="w-3.5 h-3.5 text-emerald-700" />}>
                Rekap WhatsApp
              </Button>
            </Link>
            <Link
              href="/orders"
            >
              <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
                Input Pesanan
              </Button>
            </Link>
          </div>
        </div>

        {/* Milestone Timeline Rail */}
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 sm:px-5 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-emerald-100/80 text-emerald-800 flex items-center justify-center font-bold text-[10px] shrink-0">
              01
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">Order Dibuka (Sabtu)</span>
              <span className="font-semibold text-slate-800 tabular-nums">{formatDate(cycle.periodStart)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-amber-100/80 text-amber-800 flex items-center justify-center font-bold text-[10px] shrink-0">
              02
            </div>
            <div>
              <span className="text-amber-800 font-semibold text-[11px] block">Deadline Rekap Supplier (Selasa)</span>
              <span className="font-bold text-slate-900 tabular-nums">{formatDate(cycle.orderDeadline)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-sky-100/80 text-sky-800 flex items-center justify-center font-bold text-[10px] shrink-0">
              03
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">Distribusi Tiba (Kamis)</span>
              <span className="font-semibold text-slate-800 tabular-nums">{formatDate(cycle.deliveryDate)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TARGET QUOTA COMMAND COCKPIT (Ayam & Tahu Twin Gauges) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Status Kuota Supplier Level 4</span>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/50">
                Target Mingguan
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ambang batas minimum pemesanan grosir: 20 kg Ayam Potong & 20 bungkus Tahu Putih.
            </p>
          </div>
          <Link
            href={`/cycles/${cycle.id}`}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 self-start sm:self-auto"
          >
            Rincian & Rekapitulasi
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Twin Gauges Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {targets.map((target) => {
            const remaining = Math.max(0, target.targetQuantity - target.actualQuantity)
            const isMet = target.isMet
            return (
              <div
                key={target.id}
                className="p-4 sm:p-5 rounded-xl bg-slate-50/60 border border-slate-200/80 flex flex-col justify-between"
              >
                <div>
                  {/* Top line: Name & Status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="font-extrabold text-slate-900 text-base tracking-tight">
                      {target.name}
                    </h3>
                    {isMet ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        Kuota Terpenuhi
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full border border-amber-200">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                        Kurang <span className="tabular-nums">{remaining}</span> {target.unit}
                      </span>
                    )}
                  </div>

                  {/* Big Number Readout */}
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="text-3xl font-black text-slate-900 tracking-tight tabular-nums">
                      {target.actualQuantity}
                      <span className="text-sm font-semibold text-slate-500 ml-1.5">
                        / {target.targetQuantity} {target.unit}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`text-base font-extrabold tabular-nums ${isMet ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {target.percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Tactile Gauge Bar */}
                  <div className="w-full h-3 bg-slate-200/80 rounded-full overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isMet ? 'bg-emerald-600' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, target.percentage)}%` }}
                    />
                  </div>

                  {/* Variant breakdown tags */}
                  {target.breakdown && target.breakdown.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {target.breakdown.map((b: any) => (
                        <span
                          key={b.name}
                          className="text-[11px] font-medium bg-white text-slate-700 border border-slate-200/80 px-2 py-0.5 rounded-md tabular-nums"
                        >
                          {b.name}: <strong className="font-bold text-slate-900">{b.quantity} {target.unit}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer notes */}
                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Stok awal: <strong className="text-slate-700 tabular-nums">{target.beginningStock || 0} {target.unit}</strong>
                  </span>
                  <span className={(target.unsoldStock ?? 0) > 0 ? 'text-amber-700 font-semibold' : 'text-slate-600'}>
                    Sisa belum terjual: <strong className="tabular-nums">{target.unsoldStock ?? 0} {target.unit}</strong>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 3. OPERATIONAL MATRIX (Asymmetric: Roster Ledger on Left, Financial on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN (Span 2): Member Rotation & Order Roster */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-700" />
                  <h3 className="font-extrabold text-slate-900 text-base tracking-tight">
                    Jadwal Rotasi Giliran Anggota
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Partisipasi rotasi memastikan target kuota mingguan tercapai merata di setiap sub-grup.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold tabular-nums self-start sm:self-auto">
                <span className="text-slate-600">Partisipasi:</span>
                <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/50">
                  {rotation?.orderedCount} / {rotation?.scheduledCount} ({rotation?.percentage}%)
                </span>
              </div>
            </div>

            {/* Tactile Segment Filter */}
            <div className="inline-flex bg-slate-100 p-1 rounded-xl mb-3 text-xs font-medium w-full sm:w-auto">
              <button
                onClick={() => setRotationFilter('all')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                  rotationFilter === 'all'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua ({scheduledMembers.length})
              </button>
              <button
                onClick={() => setRotationFilter('pending')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                  rotationFilter === 'pending'
                    ? 'bg-white text-amber-800 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-amber-700'
                }`}
              >
                Belum Order ({pendingCount})
              </button>
              <button
                onClick={() => setRotationFilter('ordered')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                  rotationFilter === 'ordered'
                    ? 'bg-white text-emerald-800 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                Sudah Order ({orderedCount})
              </button>
            </div>

            {/* Congratulatory Alert if all have ordered */}
            {pendingCount === 0 && scheduledMembers.length > 0 && (
              <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Luar biasa! Seluruh anggota giliran rotasi minggu ini telah menginput pesanan.</span>
              </div>
            )}

            {/* Member Ledger List */}
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
              {filteredRotationMembers.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-8 text-center">
                  {scheduledMembers.length === 0
                    ? 'Belum ada anggota yang dijadwalkan pada siklus ini.'
                    : rotationFilter === 'pending'
                    ? 'Seluruh anggota yang dijadwalkan sudah memesan.'
                    : 'Belum ada anggota yang memesan.'}
                </p>
              ) : (
                filteredRotationMembers.map((m) => (
                  <div
                    key={m.id}
                    className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-lg transition-colors"
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center font-bold text-[11px] text-slate-700 shrink-0">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs truncate">{m.name}</span>
                          {m.role === 'pengurus' && (
                            <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-semibold">
                              Pengurus
                            </span>
                          )}
                          {m.role === 'pj' && (
                            <span className="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-semibold">
                              PJ
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 block truncate">{m.groupName}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {m.isOrdered ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/70 px-2.5 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          Sudah Order
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/70 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Belum
                          </span>
                          <a
                            href={getWhatsAppUrl(
                              m.phone,
                              `Halo ${m.name}, pesanan sembako siklus ${cycle.label} sudah dibuka ya. Mohon konfirmasi pesanannya sebelum deadline hari Selasa.`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Kirim pesan WA"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1 rounded-lg transition-colors shadow-2xs"
                          >
                            <MessageSquare className="w-3 h-3" />
                            Ingatkan
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Kelola giliran rotasi anggota untuk siklus mendatang</span>
            <Link
              href={`/cycles/${cycle.id}`}
              className="font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              Buka Manajemen Rotasi
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* RIGHT COLUMN (Span 1): Financial Command & Fast Navigation */}
        <div className="space-y-6">
          {/* Financial Balance Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4.5 h-4.5 text-emerald-700" />
                <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">
                  Rekap Billing & Kas
                </h3>
              </div>
              <Link
                href="/orders"
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                Semua Order
              </Link>
            </div>

            {/* Total Readout */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 mb-3">
              <span className="text-xs text-slate-500 font-medium block">Total Nilai Pesanan Masuk</span>
              <div className="text-2xl font-black text-slate-900 tracking-tight tabular-nums mt-0.5">
                {formatCurrency(payments?.totalBilling || 0)}
              </div>
              <span className="text-[11px] text-slate-500 block mt-1">
                Tercatat dari <strong className="text-slate-800 tabular-nums">{payments?.totalOrders || 0}</strong> pesanan
              </span>
            </div>

            {/* Split Balance Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/60">
                <span className="text-[11px] font-bold text-emerald-800 block mb-0.5">
                  Sudah Lunas
                </span>
                <span className="text-sm font-black text-emerald-950 tabular-nums block">
                  {formatCurrency(payments?.paidAmount || 0)}
                </span>
                <span className="text-[10px] text-emerald-700 tabular-nums mt-0.5 block">
                  {payments?.paidCount || 0} pesanan
                </span>
              </div>

              <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/60">
                <span className="text-[11px] font-bold text-rose-800 block mb-0.5">
                  Belum Bayar
                </span>
                <span className="text-sm font-black text-rose-950 tabular-nums block">
                  {formatCurrency(payments?.unpaidAmount || 0)}
                </span>
                <span className="text-[10px] text-rose-700 tabular-nums mt-0.5 block">
                  {payments?.unpaidCount || 0} pesanan
                </span>
              </div>
            </div>
          </div>

          {/* Operational Workflow Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
              <TrendingUp className="w-4.5 h-4.5 text-emerald-700" />
              <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">
                Alur Kerja Mingguan
              </h3>
            </div>

            <div className="space-y-2">
              <Link
                href="/orders"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 hover:border-emerald-300 hover:bg-emerald-50/40 transition-all text-xs font-medium text-slate-800 group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <ShoppingCart className="w-3.5 h-3.5" />
                  </div>
                  <span>Entri Pesanan Anggota</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700 transition-colors" />
              </Link>

              <Link
                href={`/cycles/${cycle.id}`}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 hover:border-emerald-300 hover:bg-emerald-50/40 transition-all text-xs font-medium text-slate-800 group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </div>
                  <span>Ekspor Rekap Supplier (L4)</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700 transition-colors" />
              </Link>

              <Link
                href="/reports"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 hover:border-emerald-300 hover:bg-emerald-50/40 transition-all text-xs font-medium text-slate-800 group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center">
                    <Package className="w-3.5 h-3.5" />
                  </div>
                  <span>Penerimaan Barang & Margin</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700 transition-colors" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
