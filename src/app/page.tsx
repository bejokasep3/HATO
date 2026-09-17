'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Sparkles,
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
  PlusCircle,
  Package,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import { formatCurrency, formatDate, getWhatsAppUrl } from '@/lib/utils'

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
          <p className="text-sm text-slate-500 font-medium">Memuat dashboard...</p>
        </div>
      </div>
    )
  }

  if (!data?.hasCycle || !data.currentCycle) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-xl mx-auto my-12">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Belum Ada Siklus Aktif</h2>
        <p className="text-slate-600 mb-6 text-sm">
          Mulai dengan membuat siklus pemesanan baru untuk menjadwalkan rotasi anggota dan menentukan harga mingguan.
        </p>
        <Link
          href="/cycles"
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          Buat Siklus Baru
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
  const recentOrders = data.recentOrders || []

  const scheduledMembers = rotation?.members || []
  const pendingCount = scheduledMembers.filter((m) => !m.isOrdered).length
  const orderedCount = scheduledMembers.filter((m) => m.isOrdered).length

  const filteredRotationMembers = scheduledMembers.filter((m) => {
    if (rotationFilter === 'pending') return !m.isOrdered
    if (rotationFilter === 'ordered') return m.isOrdered
    return true
  })

  return (
    <div className="space-y-6">
      {/* Top Bar: Clean Cycle Switcher Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Stepper Navigation */}
          <div className="inline-flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/80">
            <button
              onClick={() => prevCycle && fetchDashboard(prevCycle.id)}
              disabled={!prevCycle || switchingCycle}
              title={prevCycle ? `Lihat ${prevCycle.label}` : 'Tidak ada siklus sebelumnya'}
              className="p-1.5 rounded-md hover:bg-white hover:text-slate-900 disabled:opacity-25 disabled:hover:bg-transparent text-slate-600 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="relative px-2">
              <select
                value={cycle.id}
                onChange={(e) => fetchDashboard(e.target.value)}
                disabled={switchingCycle}
                className="bg-transparent appearance-none font-bold text-slate-800 text-xs sm:text-sm pr-5 py-1 focus:outline-none cursor-pointer"
              >
                {allCycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} {c.status === 'open' ? '• Aktif' : c.status === 'draft' ? '• Draft' : '• Selesai'}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              onClick={() => nextCycle && fetchDashboard(nextCycle.id)}
              disabled={!nextCycle || switchingCycle}
              title={nextCycle ? `Lihat ${nextCycle.label}` : 'Tidak ada siklus berikutnya'}
              className="p-1.5 rounded-md hover:bg-white hover:text-slate-900 disabled:opacity-25 disabled:hover:bg-transparent text-slate-600 transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Status Badge */}
          <span
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold border ${
              cycle.status === 'open'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : cycle.status === 'draft'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {cycle.status === 'open' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Siklus Aktif
              </>
            ) : cycle.status === 'draft' ? (
              'Draft'
            ) : (
              'Arsip Selesai'
            )}
          </span>

          {switchingCycle && (
            <span className="text-xs text-slate-400 italic animate-pulse">Memuat...</span>
          )}
        </div>

        <Link
          href="/cycles"
          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 self-end sm:self-auto"
        >
          Kelola Semua Siklus
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-900 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider block mb-1">
              Periode {cycle.label}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Dashboard Distribusi Sembako
            </h1>
            <p className="text-emerald-100/80 text-sm mt-1 max-w-xl">
              Pantau target ayam & tahu mingguan, kepatuhan rotasi giliran anggota, dan rekap pembayaran.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/cycles/${cycle.id}`}
              className="inline-flex items-center gap-2 bg-white text-emerald-900 hover:bg-emerald-50 font-semibold px-4 py-2.5 rounded-lg text-sm shadow-sm transition-all"
            >
              Lihat Rekap Siklus
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/orders"
              className="inline-flex items-center gap-2 bg-emerald-600/80 hover:bg-emerald-600 text-white border border-emerald-400/30 font-medium px-4 py-2.5 rounded-lg text-sm transition-all"
            >
              <ShoppingCart className="w-4 h-4" />
              Input Pesanan
            </Link>
          </div>
        </div>

        {/* Cycle Milestone Dates */}
        <div className="mt-6 pt-6 border-t border-emerald-600/40 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="flex items-center gap-2.5 text-emerald-100">
            <Calendar className="w-4 h-4 text-emerald-300 shrink-0" />
            <div>
              <span className="text-emerald-300/80 font-medium block">Mulai Order (Sabtu)</span>
              <span className="font-semibold text-white">{formatDate(cycle.periodStart)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-emerald-100">
            <Clock className="w-4 h-4 text-amber-300 shrink-0" />
            <div>
              <span className="text-amber-300/80 font-medium block">Deadline Rekap (Selasa)</span>
              <span className="font-semibold text-white">{formatDate(cycle.orderDeadline)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-emerald-100">
            <CheckCircle2 className="w-4 h-4 text-teal-300 shrink-0" />
            <div>
              <span className="text-teal-300/80 font-medium block">Distribusi Tiba (Kamis)</span>
              <span className="font-semibold text-white">{formatDate(cycle.deliveryDate)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Target Products Progress Cards (Ayam & Tahu) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {targets.map((target) => {
          const remaining = Math.max(0, target.targetQuantity - target.actualQuantity)
          return (
            <div
              key={target.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                    Target Mingguan
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">{target.name}</h3>
                </div>
                {target.isMet ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Target Tercapai!
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Kurang {remaining} {target.unit}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-baseline text-sm">
                  <span className="text-2xl font-black text-slate-900">
                    {target.actualQuantity}{' '}
                    <span className="text-sm font-normal text-slate-500">
                      / {target.targetQuantity} {target.unit}
                    </span>
                  </span>
                  <span className="font-bold text-slate-700">{target.percentage}%</span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      target.isMet ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, target.percentage)}%` }}
                  />
                </div>

                {/* Variant Breakdown (For Ayam Campur & Tahu Campur) */}
                {target.breakdown && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                    {target.breakdown.map((b: any) => (
                      <span
                        key={b.name}
                        className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md"
                      >
                        {b.name}: <strong className="font-bold text-slate-900">{b.quantity} {target.unit}</strong>
                      </span>
                    ))}
                  </div>
                )}

                {/* Stock Carryover & Leftover Info */}
                <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Stok awal lalu: <strong className="text-slate-700">{target.beginningStock || 0} {target.unit}</strong>
                  </span>
                  <span className={(target.unsoldStock ?? 0) > 0 ? 'text-amber-700 font-semibold' : 'text-slate-700'}>
                    Sisa belum terjual: <strong>{target.unsoldStock ?? 0} {target.unit}</strong>
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Grid of Key Metrics: Rotation & Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rotation Compliance Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-base">Rotasi Siklus Ini</h3>
            </div>
            <Link
              href={`/cycles/${cycle.id}`}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Kelola
            </Link>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl mb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">Anggota Terjadwal</p>
                <p className="text-xl font-black text-slate-900 mt-0.5">
                  {rotation?.orderedCount}{' '}
                  <span className="text-sm font-normal text-slate-500">
                    / {rotation?.scheduledCount}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 font-medium">Partisipasi</p>
                <p className="text-lg font-bold text-emerald-600 mt-0.5">{rotation?.percentage}%</p>
              </div>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2.5 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${rotation?.percentage || 0}%` }}
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg mb-2.5 text-[11px] font-medium">
            <button
              onClick={() => setRotationFilter('all')}
              className={`flex-1 py-1 rounded-md text-center transition-all ${
                rotationFilter === 'all'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({scheduledMembers.length})
            </button>
            <button
              onClick={() => setRotationFilter('pending')}
              className={`flex-1 py-1 rounded-md text-center transition-all ${
                rotationFilter === 'pending'
                  ? 'bg-white text-amber-800 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-amber-700'
              }`}
            >
              Belum ({pendingCount})
            </button>
            <button
              onClick={() => setRotationFilter('ordered')}
              className={`flex-1 py-1 rounded-md text-center transition-all ${
                rotationFilter === 'ordered'
                  ? 'bg-white text-emerald-800 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              Sudah ({orderedCount})
            </button>
          </div>

          {/* Celebration banner if all members have ordered */}
          {pendingCount === 0 && scheduledMembers.length > 0 && (
            <div className="mb-2.5 p-2 bg-emerald-50 border border-emerald-200/80 rounded-lg text-xs text-emerald-800 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Semua anggota terjadwal sudah memesan!</span>
            </div>
          )}

          <div className="flex-1">
            {filteredRotationMembers.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">
                {scheduledMembers.length === 0
                  ? 'Belum ada anggota yang dijadwalkan.'
                  : rotationFilter === 'pending'
                  ? 'Semua anggota sudah memesan.'
                  : 'Belum ada anggota yang memesan.'}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {filteredRotationMembers.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-colors ${
                      m.isOrdered
                        ? 'bg-emerald-50/40 border-emerald-100 hover:bg-emerald-50/70'
                        : 'bg-amber-50/30 border-amber-100 hover:bg-amber-50/60'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-800 truncate">{m.name}</span>
                        {m.role === 'pengurus' && (
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded font-semibold">
                            Pengurus
                          </span>
                        )}
                        {m.role === 'pj' && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-semibold">
                            PJ
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">{m.groupName}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {m.isOrdered ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Sudah Order
                        </span>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
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
                            className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-md transition-colors shadow-xs"
                          >
                            <MessageSquare className="w-3 h-3" />
                            WA
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Payment Summary Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-base">Rekap Pembayaran</h3>
            </div>
            <Link
              href="/orders"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Semua Pesanan
            </Link>
          </div>

          <div className="space-y-3 flex-1 flex flex-col justify-between">
            <div className="p-4 bg-slate-50 rounded-xl">
              <span className="text-xs text-slate-500 font-medium block">Total Nilai Pesanan</span>
              <span className="text-2xl font-black text-slate-900">
                {formatCurrency(payments?.totalBilling || 0)}
              </span>
              <span className="text-xs text-slate-400 block mt-1">
                Dari {payments?.totalOrders || 0} pesanan masuk
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl">
                <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Sudah Bayar
                </div>
                <p className="text-base font-bold text-emerald-900">
                  {formatCurrency(payments?.paidAmount || 0)}
                </p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  {payments?.paidCount || 0} pesanan
                </p>
              </div>

              <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-xl">
                <div className="flex items-center gap-1.5 text-rose-700 text-xs font-semibold mb-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Belum Bayar
                </div>
                <p className="text-base font-bold text-rose-900">
                  {formatCurrency(payments?.unpaidAmount || 0)}
                </p>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  {payments?.unpaidCount || 0} pesanan
                </p>
              </div>
            </div>

            <Link
              href={`/cycles/${cycle.id}`}
              className="w-full text-center py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors"
            >
              Export Rekap Teks WhatsApp
            </Link>
          </div>
        </div>

        {/* Quick Actions & Community Overview */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-base">Aksi Cepat & Navigasi</h3>
            </div>

            <div className="space-y-2">
              <Link
                href="/orders"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition-all text-sm font-medium text-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <span>Input Pesanan Baru</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>

              <Link
                href={`/cycles/${cycle.id}`}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition-all text-sm font-medium text-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                  <span>Ubah Harga Mingguan</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>

              <Link
                href="/members"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition-all text-sm font-medium text-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <span>Daftar Anggota ({data.totalMembers || 0})</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>

              <Link
                href="/ranking"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition-all text-sm font-medium text-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span>Peringkat & Keaktifan</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-500 mt-4 border border-slate-100">
            <span className="font-semibold text-slate-700 block">💡 Tips Distribusi:</span>
            Rekap pesanan otomatis dipersiapkan dengan format rapi untuk disalin langsung ke grup supplier Level 4 pada hari Selasa.
          </div>
        </div>
      </div>

      {/* Recent Orders Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Pesanan Terbaru Siklus Ini</h3>
            <p className="text-xs text-slate-500">Menampilkan pesanan yang baru masuk</p>
          </div>
          <Link
            href="/orders"
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            Lihat Semua Pesanan
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">Belum ada pesanan masuk.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-y border-slate-100">
                <tr>
                  <th className="py-3 px-4">Nama Anggota</th>
                  <th className="py-3 px-4">Sub-Grup</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Status Bayar</th>
                  <th className="py-3 px-4">Status Kirim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">{order.memberName}</td>
                    <td className="py-3 px-4 text-slate-600 text-xs">{order.groupName}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {formatCurrency(order.totalAmount)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          order.paymentStatus === 'paid'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {order.paymentStatus === 'paid' ? 'Lunas' : 'Belum Bayar'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {order.orderStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
