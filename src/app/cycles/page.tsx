'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Calendar,
  Clock,
  CheckCircle2,
  Plus,
  ArrowRight,
  Truck,
  X,
  Repeat,
  ShoppingBag,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

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
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Buka (Aktif)
          </span>
        )
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Ditutup (Closed)
          </span>
        )
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-sky-50 text-sky-800 border border-sky-200">
            <Truck className="w-3.5 h-3.5 text-sky-600" />
            Terkirim
          </span>
        )
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Selesai
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-50 text-slate-600 border border-slate-200">
            Draf
          </span>
        )
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Command Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap mb-1">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Siklus Distribusi Sembako</h1>
            <Badge variant="emerald" size="sm" className="tabular-nums font-bold">
              {cycles.length} Siklus Terdata
            </Badge>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Kelola periode distribusi mingguan, pantau deadline rekap pesanan ke supplier, dan tracking distribusi fisik.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={handleOpenModal}
          icon={<Plus className="w-4 h-4" />}
        >
          Buat Siklus Baru
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[35vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Memuat data siklus...</p>
          </div>
        </div>
      ) : cycles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-10 text-center max-w-md mx-auto shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
            <Repeat className="w-6 h-6 text-slate-600" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Belum Ada Siklus</h3>
          <p className="text-xs text-slate-500 mt-1 mb-5">
            Buat siklus baru untuk mulai mengumpulkan pesanan sembako mingguan dan rotasi jadwal.
          </p>
          <Button
            variant="primary"
            onClick={handleOpenModal}
            icon={<Plus className="w-4 h-4" />}
          >
            Buat Siklus Pertama
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {cycles.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">{c.label}</h3>
                    {c.notes ? (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{c.notes}</p>
                    ) : (
                      <p className="text-xs text-slate-500 mt-0.5">Siklus distribusi mingguan</p>
                    )}
                  </div>
                  {getStatusBadge(c.status)}
                </div>

                {/* Milestone Dates Strip */}
                <div className="grid grid-cols-3 gap-2 py-3 my-3 border-y border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Buka Order</span>
                    <span className="font-semibold text-slate-800 tabular-nums">{formatDate(c.periodStart)}</span>
                  </div>
                  <div>
                    <span className="text-amber-800 font-semibold block text-[11px]">Deadline Rekap</span>
                    <span className="font-bold text-slate-900 tabular-nums">{formatDate(c.orderDeadline)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Tiba Distribusi</span>
                    <span className="font-semibold text-slate-800 tabular-nums">{formatDate(c.deliveryDate)}</span>
                  </div>
                </div>

                {/* Metrics Stats Row */}
                <div className="grid grid-cols-2 divide-x divide-slate-100 py-3 mb-2 bg-slate-50/70 rounded-xl border border-slate-200/70">
                  <div className="px-4">
                    <span className="text-[11px] text-slate-500 block font-medium">Pesanan Masuk</span>
                    <span className="text-lg font-black text-slate-900 mt-0.5 block tabular-nums">
                      {c.totalOrders} <span className="text-xs font-normal text-slate-500">pesanan</span>
                    </span>
                  </div>
                  <div className="px-4">
                    <span className="text-[11px] text-slate-500 block font-medium">Total Nilai Billing</span>
                    <span className="text-lg font-black text-slate-900 mt-0.5 block tabular-nums">
                      {formatCurrency(c.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-2">
                <span className="text-xs text-slate-500">
                  Giliran rotasi: <strong className="text-slate-800 tabular-nums">{c.totalRotation} anggota</strong>
                </span>
                <Link
                  href={`/cycles/${c.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200/60 transition-colors"
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200/90 relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/60">
                  <Calendar className="w-4 h-4" />
                </div>
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Buat Siklus Pemesanan Baru</h2>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
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
                  className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:border-emerald-600 transition-all"
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
                    className="w-full text-xs font-medium border border-slate-200 rounded-xl px-2.5 py-2 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:border-emerald-600 transition-all tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-800 mb-1">
                    Deadline (Selasa)
                  </label>
                  <input
                    type="date"
                    required
                    value={orderDeadline}
                    onChange={(e) => setOrderDeadline(e.target.value)}
                    className="w-full text-xs font-medium border border-amber-300 rounded-xl px-2.5 py-2 bg-amber-50/30 focus:bg-white focus:outline-hidden focus:border-emerald-600 transition-all tabular-nums"
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
                    className="w-full text-xs font-medium border border-slate-200 rounded-xl px-2.5 py-2 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:border-emerald-600 transition-all tabular-nums"
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
                  placeholder="Informasi pengiriman khusus atau instruksi supplier..."
                  className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:border-emerald-600 transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submitting}
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Siklus Baru'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
