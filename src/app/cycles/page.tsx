'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Calendar,
  Clock,
  CheckCircle2,
  PlusCircle,
  ArrowRight,
  TrendingUp,
  X,
  Repeat,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'sonner'

interface CycleItem {
  id: string
  label: string
  periodStart: string
  orderDeadline: string
  deliveryDate: string
  status: string
  notes?: string
  totalOrders: number
  totalRotation: number
  totalAmount: number
  paidAmount: number
}

export default function CyclesPage() {
  const [cycles, setCycles] = useState<CycleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form states
  const [label, setLabel] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [orderDeadline, setOrderDeadline] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [notes, setNotes] = useState('')

  const fetchCycles = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/cycles')
      const json = await res.json()
      setCycles(json)
    } catch (err) {
      console.error('Failed to load cycles:', err)
      toast.error('Gagal memuat data siklus')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCycles()
  }, [])

  const handleOpenModal = () => {
    // Suggest dates: next upcoming Saturday, Tuesday, Thursday
    const now = new Date()
    const nextSat = new Date(now)
    const day = now.getDay()
    const diff = (6 - day + 7) % 7 || 7
    nextSat.setDate(now.getDate() + diff)

    const nextTue = new Date(nextSat)
    nextTue.setDate(nextSat.getDate() + 3)

    const nextThu = new Date(nextSat)
    nextThu.setDate(nextSat.getDate() + 5)

    const formatDateInput = (d: Date) => d.toISOString().split('T')[0]

    setLabel(`Minggu ${Math.ceil(nextSat.getDate() / 7)} - ${nextSat.toLocaleString('id-ID', { month: 'short' })} ${nextSat.getFullYear()}`)
    setPeriodStart(formatDateInput(nextSat))
    setOrderDeadline(formatDateInput(nextTue))
    setDeliveryDate(formatDateInput(nextThu))
    setNotes('')
    setModalOpen(true)
  }

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      const res = await fetch('/api/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          periodStart,
          orderDeadline,
          deliveryDate,
          notes,
          status: 'draft',
        }),
      })

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'Gagal membuat siklus')
      }

      toast.success('Siklus baru berhasil dibuat!')
      setModalOpen(false)
      fetchCycles()
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">🟢 Buka (Open)</span>
      case 'closed':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">🟡 Ditutup (Closed)</span>
      case 'delivered':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-sky-50 text-sky-700 border border-sky-200">🚚 Terkirim</span>
      case 'completed':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">✅ Selesai</span>
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-50 text-slate-600 border border-slate-200">Draft</span>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Siklus Pemesanan</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola periode mingguan, jadwal deadline supplier, dan riwayat distribusi.
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm transition-all shadow-xs shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          Buat Siklus Baru
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : cycles.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-md mx-auto">
          <Repeat className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">Belum Ada Siklus</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Buat siklus baru untuk mulai mengumpulkan pesanan sembako mingguan.
          </p>
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg text-sm"
          >
            <PlusCircle className="w-4 h-4" />
            Buat Siklus
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {cycles.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{c.label}</h3>
                    {c.notes && <p className="text-xs text-slate-500 mt-0.5">{c.notes}</p>}
                  </div>
                  {getStatusBadge(c.status)}
                </div>

                <div className="grid grid-cols-3 gap-2 py-3 my-3 border-y border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Mulai</span>
                    <span className="font-semibold text-slate-700">{formatDate(c.periodStart)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Deadline Rekap</span>
                    <span className="font-semibold text-amber-700">{formatDate(c.orderDeadline)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Pengiriman</span>
                    <span className="font-semibold text-teal-700">{formatDate(c.deliveryDate)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-2.5 bg-slate-50 rounded-lg text-xs">
                    <span className="text-slate-400 block">Pesanan Masuk</span>
                    <span className="text-base font-bold text-slate-900 mt-0.5">
                      {c.totalOrders} <span className="text-xs font-normal text-slate-500">pesanan</span>
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg text-xs">
                    <span className="text-slate-400 block">Total Nilai</span>
                    <span className="text-base font-bold text-slate-900 mt-0.5">
                      {formatCurrency(c.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-400">
                  Terjadwal: <strong className="text-slate-700">{c.totalRotation} orang</strong>
                </span>
                <Link
                  href={`/cycles/${c.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Detail & Rekap
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Dialog for New Cycle */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Buat Siklus Pemesanan Baru</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCycle} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama / Label Siklus
                </label>
                <input
                  type="text"
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Contoh: Minggu 3 - Sep 2026"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mulai Order (Sabtu)
                  </label>
                  <input
                    type="date"
                    required
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-hidden focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Deadline (Selasa)
                  </label>
                  <input
                    type="date"
                    required
                    value={orderDeadline}
                    onChange={(e) => setOrderDeadline(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-hidden focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pengiriman (Kamis)
                  </label>
                  <input
                    type="date"
                    required
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-hidden focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan / Keterangan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Pembukaan pesanan tahap 2, target ayam & tahu normal."
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs">
                💡 Harga mingguan akan otomatis disalin dari siklus sebelumnya sehingga Anda tidak perlu mengetik ulang semua harga dari nol.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Buat Siklus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
