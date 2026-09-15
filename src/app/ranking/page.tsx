'use client'

import React, { useEffect, useState } from 'react'
import {
  Trophy,
  Building2,
  Sparkles,
  CheckCircle2,
  Clock,
  HelpCircle,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

export default function RankingPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active'>('all')

  const fetchRankings = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/ranking')
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
      toast.error('Gagal memuat peringkat')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRankings()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const leaderboard = data?.leaderboard || []
  const groupStats = data?.groupStats || []
  const activeMembers = leaderboard.filter((m: any) => m.score > 0)
  const displayedMembers = filter === 'active' ? activeMembers : leaderboard
  const topPodium = activeMembers.slice(0, 3)

  const getRankBadge = (rank: number, score: number) => {
    if (score === 0) {
      return <span className="text-slate-300 font-medium text-xs">-</span>
    }
    switch (rank) {
      case 1:
        return (
          <span className="w-7 h-7 rounded-full bg-amber-400 text-white font-bold flex items-center justify-center text-xs shadow-xs">
            🥇 1
          </span>
        )
      case 2:
        return (
          <span className="w-7 h-7 rounded-full bg-slate-300 text-slate-800 font-bold flex items-center justify-center text-xs shadow-xs">
            🥈 2
          </span>
        )
      case 3:
        return (
          <span className="w-7 h-7 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
            🥉 3
          </span>
        )
      default:
        return <span className="text-slate-500 font-bold text-xs px-1">#{rank}</span>
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Peringkat & Keaktifan</h1>
        <p className="text-sm text-slate-500 mt-1">
          Apresiasi keaktifan anggota dan tingkat partisipasi sub-grup dalam pemesanan sembako.
        </p>
      </div>

      {/* Scoring Explainer Card */}
      <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-950 shadow-2xs">
        <div className="flex items-start sm:items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <span className="font-bold block">Skor Poin Praktis & Kompak:</span>
            <span className="text-emerald-800">
              Setiap Pesanan (+10 pts) + Tiap Belanja Rp 10.000 (+1 pt) + Bonus Lunas Tepat Waktu (hingga +10 pts).
            </span>
          </div>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      {topPodium.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold text-slate-900 text-base">Podium Keaktifan Teratas</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topPodium.map((m: any, idx: number) => (
              <div
                key={m.id}
                className={`p-5 rounded-2xl border flex flex-col justify-between shadow-xs transition-all ${
                  idx === 0
                    ? 'bg-gradient-to-b from-amber-50 to-amber-100/40 border-amber-300 ring-2 ring-amber-400/30'
                    : idx === 1
                    ? 'bg-gradient-to-b from-slate-50 to-slate-100/40 border-slate-300'
                    : 'bg-gradient-to-b from-orange-50 to-orange-100/40 border-orange-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    {getRankBadge(idx + 1, m.score)}
                    <span className="text-xs font-black text-slate-800 bg-white/90 px-3 py-1 rounded-full border border-slate-200/60 shadow-2xs">
                      {m.score} pts
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-slate-900 text-lg">{m.name}</h3>
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
                  <p className="text-xs text-slate-500 mt-0.5">{m.groupName}</p>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {m.badges.map((b: string, i: number) => (
                      <span
                        key={i}
                        className="text-[11px] font-semibold bg-white/90 px-2 py-0.5 rounded-md border border-slate-200 text-slate-800 shadow-2xs"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span>{m.orderCount} pesanan</span>
                    {m.paymentRate === 100 ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        Lunas
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                        Belum Lunas
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-slate-900">{formatCurrency(m.totalSpend)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Group Participation Ranking */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="font-bold text-slate-900 text-base">Partisipasi Sub-Grup & Komunitas</h3>
            <p className="text-xs text-slate-500">Tingkat keaktifan belanja anggota di setiap kelompok</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {groupStats.map((g: any, idx: number) => (
            <div
              key={g.id}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-emerald-700">#{idx + 1}</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                      {g.level === 3 ? 'Tim Utama' : 'Sub-Grup'}
                    </span>
                  </div>
                  <span className="text-xs font-bold bg-emerald-100/80 text-emerald-800 px-2 py-0.5 rounded">
                    {g.participationRate}% Aktif
                  </span>
                </div>
                <h4 className="font-bold text-slate-900">{g.name}</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {g.activeOrderingMembers} dari {g.totalMembers} anggota telah berbelanja
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-200 text-xs flex justify-between">
                <span className="text-slate-500">Total Belanja:</span>
                <span className="font-bold text-slate-800">{formatCurrency(g.totalGroupSpend)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Complete Member Leaderboard Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Klasemen Seluruh Anggota</h3>
            <p className="text-xs text-slate-500">
              Diurutkan berdasarkan skor total keaktifan dan ketepatan pembayaran.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium self-start sm:self-auto">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filter === 'all'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({leaderboard.length})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filter === 'active'
                  ? 'bg-white text-emerald-800 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              Sudah Aktif ({activeMembers.length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-100">
              <tr>
                <th className="py-3 px-4 w-16 text-center">Rank</th>
                <th className="py-3 px-4">Nama Anggota</th>
                <th className="py-3 px-4">Sub-Grup</th>
                <th className="py-3 px-4">Lencana (Badges)</th>
                <th className="py-3 px-4 text-center">Pesanan</th>
                <th className="py-3 px-4">Ketepatan Bayar</th>
                <th className="py-3 px-4 text-right">Total Belanja</th>
                <th className="py-3 px-4 text-right">Skor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedMembers.map((m: any, idx: number) => (
                <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 text-center">{getRankBadge(idx + 1, m.score)}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{m.name}</span>
                      {m.role === 'pengurus' && (
                        <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded font-semibold">
                          Pengurus
                        </span>
                      )}
                      {m.role === 'pj' && (
                        <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded font-semibold">
                          PJ
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">{m.groupName}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {m.badges.length === 0 ? (
                        <span className="text-slate-300 text-xs">-</span>
                      ) : (
                        m.badges.map((b: string, i: number) => (
                          <span
                            key={i}
                            className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium"
                          >
                            {b}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center text-xs font-semibold text-slate-700">
                    {m.orderCount > 0 ? `${m.orderCount} kali` : '-'}
                  </td>
                  <td className="py-3 px-4">
                    {m.orderCount === 0 ? (
                      <span className="text-slate-300 text-xs">-</span>
                    ) : m.paymentRate === 100 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        100% Lunas (+10 pts)
                      </span>
                    ) : m.paymentRate > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                        <Clock className="w-3 h-3 text-amber-600" />
                        {m.paymentRate}% Lunas
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                        Belum Lunas (0 pts)
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900 text-xs">
                    {m.totalSpend > 0 ? formatCurrency(m.totalSpend) : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-black">
                    <span className={m.score > 0 ? 'text-emerald-700 text-sm' : 'text-slate-400 text-xs'}>
                      {m.score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

