'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'emerald' | 'amber' | 'rose' | 'sky' | 'purple' | 'slate'
  size?: 'sm' | 'md'
  dot?: boolean
  pulse?: boolean
  icon?: React.ReactNode
}

export function Badge({
  variant = 'slate',
  size = 'md',
  dot = false,
  pulse = false,
  icon,
  className,
  children,
  ...props
}: BadgeProps) {
  const baseStyles =
    'inline-flex items-center font-bold tracking-tight rounded-full border transition-colors select-none'

  const variantStyles = {
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    amber: 'bg-amber-50 text-amber-800 border-amber-200/80',
    rose: 'bg-rose-50 text-rose-800 border-rose-200/80',
    sky: 'bg-sky-50 text-sky-800 border-sky-200/80',
    purple: 'bg-purple-50 text-purple-800 border-purple-200/80',
    slate: 'bg-slate-100 text-slate-700 border-slate-200/80',
  }

  const dotColors = {
    emerald: 'bg-emerald-600',
    amber: 'bg-amber-600',
    rose: 'bg-rose-600',
    sky: 'bg-sky-600',
    purple: 'bg-purple-600',
    slate: 'bg-slate-500',
  }

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-[11px] sm:text-xs px-2.5 py-0.5 gap-1.5',
  }

  return (
    <span className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)} {...props}>
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            dotColors[variant],
            pulse && 'animate-pulse'
          )}
        />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      {children && <span>{children}</span>}
    </span>
  )
}