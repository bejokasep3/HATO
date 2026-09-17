'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Repeat, ArrowRight, Loader2 } from 'lucide-react'

export default function InventoryRedirectPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const runRedirect = async () => {
      try {
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search)
          const cId = params.get('cycleId')
          if (cId) {
            router.replace(`/cycles/${cId}?tab=inventory`)
            return
          }
        }

        const res = await fetch('/api/cycles')
        if (!res.ok) throw new Error('Gagal mengambil siklus')
        const cycles = await res.json()

        if (cycles && cycles.length > 0) {
          const activeCycle =
            cycles.find((c: any) => c.status === 'open' || c.status === 'delivered') || cycles[0]
          router.replace(`/cycles/${activeCycle.id}?tab=inventory`)
        } else {
          setLoading(false)
        }
      } catch (err) {
        console.error(err)
        setLoading(false)
      }
    }

    runRedirect()
  }, [router])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">
          Membuka Penerimaan Barang di Siklus...
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-2xl border border-slate-200 text-center shadow-xs">
      <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
        <Repeat className="w-6 h-6" />
      </div>
      <h2 className="text-lg font-bold text-slate-900 mb-2">Penerimaan Barang Terintegrasi di Siklus</h2>
      <p className="text-xs text-slate-500 mb-6 leading-relaxed">
        Pencatatan barang masuk dan HPP kini dikelola langsung di dalam masing-masing Siklus Pesanan. Belum ada siklus aktif yang dapat dibuka.
      </p>
      <Link
        href="/cycles"
        className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
      >
        Lihat Daftar Siklus
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
