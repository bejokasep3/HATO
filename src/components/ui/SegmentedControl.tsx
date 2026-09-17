'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedOption {
  id: string
  label: string
  icon?: React.ReactNode
  badge?: string | number
}

export interface SegmentedControlProps {
  options: SegmentedOption[]
  value: string
  onChange: (id: string) => void
  className?: string
  size?: 'sm' | 'md'
}

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  size = 'md',
}: SegmentedControlProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 gap-1 select-none overflow-x-auto',
        className
      )}
    >
      {options.map((opt) => {
        const isActive = opt.id === value
        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.id)}
            className={cn(
              'flex items-center gap-2 rounded-xl font-bold transition-all duration-150 cursor-pointer shrink-0',
              size === 'sm' ? 'text-xs px-3 py-1.5' : 'text-xs sm:text-sm px-3.5 py-2',
              isActive
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/70'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent'
            )}
          >
            {opt.icon && <span className={cn('shrink-0', isActive ? 'text-emerald-700' : 'text-slate-400')}>{opt.icon}</span>}
            <span className="tracking-tight">{opt.label}</span>
            {opt.badge !== undefined && (
              <span
                className={cn(
                  'text-[10px] font-extrabold px-1.5 py-0.2 rounded-full tabular-nums',
                  isActive
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                    : 'bg-slate-200/80 text-slate-600'
                )}
              >
                {opt.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}