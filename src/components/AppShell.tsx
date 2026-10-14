'use client'

import React, { createContext, Suspense, useContext, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  LayoutDashboard,
  Repeat,
  ShoppingCart,
  BarChart3,
  Users,
  Trophy,
  WalletCards,
  PackageCheck,
  Boxes,
  Menu,
  X,
  CalendarDays,
  ShoppingBag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Toaster } from 'sonner'
import { cycleTiming, cycleStatusLabel } from '@/lib/domain/calendar'
import { useBusinessTime } from '../../shared/use-business-time'

interface AppShellProps {
  children: React.ReactNode
}

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/orders', label: 'Pesanan', icon: ShoppingCart },
  { href: '/payments', label: 'Piutang', icon: WalletCards },
  { href: '/inventory', label: 'Barang', icon: PackageCheck },
  { href: '/cycles', label: 'Siklus Pesanan', icon: Repeat },
  { href: '/members', label: 'Komunitas', icon: Users },
  { href: '/reports', label: 'Laporan', icon: BarChart3 },
  { href: '/products', label: 'Katalog Produk', icon: Boxes },
  { href: '/ranking', label: 'Peringkat & Skor', icon: Trophy },
]

type CycleNavItem = { id: string; label: string; periodStart: string; periodEnd?: string | null; evaluatedAt?: string; periodState?: string | null; status?: string; supplierDeadline?: string | null }

type OperationalMode = { operationalSchema: boolean | null }
const OperationalModeContext = createContext<OperationalMode>({ operationalSchema: null })

export function useOperationalMode() {
  return useContext(OperationalModeContext)
}

function AppShellContent({ children }: AppShellProps) {
  const pathname = usePathname()
  const isLogin = pathname === '/login'
  const searchParams = useSearchParams()
  const cycleId = searchParams.get('cycleId')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [cycles, setCycles] = useState<CycleNavItem[]>([])
  const now = useBusinessTime(cycles[0]?.evaluatedAt)
  const [operationalSchema, setOperationalSchema] = useState<boolean | null>(null)
  const activeCycle = useMemo(() => cycles.find((cycle) => cycle.id === cycleId) ?? null, [cycleId, cycles])

  useEffect(() => {
    if (isLogin) return
    let active = true
    fetch('/api/cycles', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : [])
      .then((items: unknown) => {
        if (active && Array.isArray(items)) setCycles(items as CycleNavItem[])
      })
      .catch(() => undefined)
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((result: unknown) => {
        if (active && result && typeof result === 'object' && 'operationalSchema' in result && typeof result.operationalSchema === 'boolean') {
          setOperationalSchema(result.operationalSchema)
        }
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [isLogin])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [mobileMenuOpen])

  const hrefWithCycle = (href: string) => cycleId ? `${href}?cycleId=${encodeURIComponent(cycleId)}` : href

  if (isLogin) return <><Toaster position="top-right" richColors />{children}</>

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col md:flex-row font-sans antialiased">
      <Toaster position="top-right" richColors />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-20 xl:w-64 bg-white border-r border-slate-200/90 shrink-0 select-none">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-5 border-b border-slate-100/90 gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center shadow-xs ring-1 ring-emerald-800/20">
            <ShoppingBag className="w-4.5 h-4.5" />
          </div>
          <div className="hidden xl:block min-w-0">
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
          {navItems.map((item, index) => {
            const Icon = item.icon
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : item.href === '/members'
                ? pathname.startsWith('/members') || pathname.startsWith('/groups')
                : pathname.startsWith(item.href)

            return (
              <React.Fragment key={item.href}>
              {index === 0 || index === 4 ? <p className="hidden xl:block px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{index === 0 ? 'Utama' : 'Pendukung'}</p> : null}
              <Link
                href={hrefWithCycle(item.href)}
                title={item.label}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group relative flex min-h-11 items-center justify-center xl:justify-start gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150',
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
                <span className="hidden xl:block truncate">{item.label}</span>
                {isActive && (
                  <span className="hidden xl:block ml-auto w-1.5 h-1.5 rounded-full bg-emerald-600" />
                )}
              </Link>
              </React.Fragment>
            )
          })}
        </nav>

        {/* Active Cycle Beacon Footer */}
        <div className="hidden xl:block p-3 border-t border-slate-100">
          <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/70">
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="text-xs font-bold text-slate-800 tracking-tight">Konteks kerja</span>
              </div>
              {activeCycle ? <span className="text-[10px] font-semibold text-slate-700">{cycleStatusLabel(cycleTiming(activeCycle, now).effectiveStatus)}</span> : null}
            </div>
            <p className="text-[11px] text-slate-600 font-semibold leading-4">{activeCycle?.label ?? 'Pilih minggu di dashboard'}</p>
            {activeCycle ? <Link href={hrefWithCycle('/')} className="mt-2 inline-flex text-[10px] font-bold text-emerald-800 hover:text-emerald-950">Ganti minggu</Link> : null}
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
          className="min-h-11 px-2.5 text-slate-700 hover:text-slate-950 rounded-lg hover:bg-slate-100 inline-flex items-center gap-2"
          aria-label={mobileMenuOpen ? 'Tutup navigasi' : 'Buka navigasi'}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          <span className="text-xs font-bold">Menu</span>
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 top-14 bg-slate-900/30 backdrop-blur-xs z-30"
            onClick={() => setMobileMenuOpen(false)}
          />
          <nav id="mobile-navigation" aria-label="Navigasi utama" className="md:hidden fixed inset-x-0 top-14 z-40 max-h-[calc(100dvh-3.5rem)] overflow-y-auto overscroll-contain bg-white p-3 space-y-1 border-b border-slate-200 shadow-lg">
            {navItems.map((item, index) => {
              const Icon = item.icon
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : item.href === '/members'
                  ? pathname.startsWith('/members') || pathname.startsWith('/groups')
                  : pathname.startsWith(item.href)

              return (
                <React.Fragment key={item.href}>
                {index === 0 || index === 4 ? <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{index === 0 ? 'Utama' : 'Pendukung'}</p> : null}
                <Link
                  href={hrefWithCycle(item.href)}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex min-h-11 items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    isActive
                      ? 'bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200/60'
                      : 'text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <Icon className={cn('w-4 h-4', isActive ? 'text-emerald-700' : 'text-slate-400')} />
                  {item.label}
                </Link>
                </React.Fragment>
              )
            })}
          </nav>
        </>
      )}

      {/* Main Content Area */}
      <main className="hato-controls flex-1 flex flex-col min-w-0 pb-16 md:pb-0 overflow-y-auto">
        <div className="@container max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-7">
          {operationalSchema === false ? (
            <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
              Mode baca-saja. Data dapat dilihat; penyimpanan dinonaktifkan karena database masih memakai schema lama.
            </div>
          ) : null}
          <OperationalModeContext.Provider value={{ operationalSchema }}>
            {children}
          </OperationalModeContext.Provider>
        </div>
      </main>
    </div>
  )
}

export function AppShell(props: AppShellProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50">{props.children}</div>}>
      <AppShellContent {...props} />
    </Suspense>
  )
}
