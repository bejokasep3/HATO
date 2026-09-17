'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Repeat,
  ShoppingCart,
  BarChart3,
  Users,
  Package,
  Trophy,
  Menu,
  X,
  Sparkles,
  ShoppingBag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Toaster } from 'sonner'

interface AppShellProps {
  children: React.ReactNode
}

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/cycles', label: 'Siklus Pesanan', icon: Repeat },
  { href: '/orders', label: 'Pesanan', icon: ShoppingCart },
  { href: '/members', label: 'Komunitas', icon: Users },
  { href: '/reports', label: 'Laporan', icon: BarChart3 },
  { href: '/products', label: 'Katalog Produk', icon: Package },
  { href: '/ranking', label: 'Peringkat & Skor', icon: Trophy },
]

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col md:flex-row font-sans antialiased">
      <Toaster position="top-right" richColors />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200/90 shrink-0 select-none">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-5 border-b border-slate-100/90 gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center shadow-xs ring-1 ring-emerald-800/20">
            <ShoppingBag className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-900 text-base tracking-tight">HATO</span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50">
                L3
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate">Distribusi Sembako</p>
          </div>
        </div>

        {/* Navigation Deck */}
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : item.href === '/members'
                ? pathname.startsWith('/members') || pathname.startsWith('/groups')
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group relative flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150',
                  isActive
                    ? 'bg-emerald-50/80 text-emerald-900 font-semibold shadow-2xs border border-emerald-200/60'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border border-transparent'
                )}
              >
                <Icon
                  className={cn(
                    'w-4 h-4 transition-colors',
                    isActive ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'
                  )}
                />
                <span className="truncate">{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-600" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Active Cycle Beacon Footer */}
        <div className="p-3 border-t border-slate-100">
          <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/70">
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-xs font-bold text-slate-800 tracking-tight">Siklus Berjalan</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Open
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Minggu 2 - Sep 2026</p>
            <div className="mt-2.5 pt-2 border-t border-slate-200/50 flex items-center justify-between text-[10px] text-slate-500 font-medium">
              <span>Deadline Rekap:</span>
              <span className="font-semibold text-slate-700">Selasa 23:59</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Top Navbar */}
      <div className="md:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-slate-200/90 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center text-white shadow-xs">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-slate-900 text-sm tracking-tight">HATO Manajer</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 focus:outline-hidden"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 top-14 bg-slate-900/30 backdrop-blur-xs z-30"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="md:hidden fixed inset-x-0 top-14 z-40 bg-white p-3 space-y-1 border-b border-slate-200 shadow-lg">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : item.href === '/members'
                  ? pathname.startsWith('/members') || pathname.startsWith('/groups')
                  : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    isActive
                      ? 'bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200/60'
                      : 'text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <Icon className={cn('w-4 h-4', isActive ? 'text-emerald-700' : 'text-slate-400')} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0 overflow-y-auto">
        <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-7">
          {children}
        </div>
      </main>
    </div>
  )
}
