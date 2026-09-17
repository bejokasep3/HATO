'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Repeat,
  ShoppingCart,
  ClipboardCheck,
  BarChart3,
  Users,
  Building2,
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row font-sans">
      <Toaster position="top-right" richColors />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-100 gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm shadow-emerald-200">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 leading-none text-base">HATO Manajer</h1>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">Manajer Distribusi (L3)</p>
          </div>
        </div>

        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
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
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <Icon className={cn('w-4 h-4', isActive ? 'text-emerald-600' : 'text-slate-400')} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/60">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-slate-700">Siklus Aktif</span>
            </div>
            <p className="text-xs text-slate-500">Minggu 2 - Sep 2026</p>
            <div className="mt-2 text-[11px] font-medium text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded inline-block">
              🟢 Status: Open
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Top Navbar */}
      <div className="md:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-900 text-sm">HATO Manajer</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100 focus:outline-hidden"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-14 z-40 bg-white p-4 space-y-1 border-b border-slate-200 shadow-lg">
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
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                )}
              >
                <Icon className={cn('w-5 h-5', isActive ? 'text-emerald-600' : 'text-slate-400')} />
                {item.label}
              </Link>
            )
          })}
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0 overflow-y-auto">
        <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
