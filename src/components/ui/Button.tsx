'use client'

import React, { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'subtle'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon,
      iconPosition = 'left',
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold transition-all duration-150 rounded-xl cursor-pointer select-none active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100'

    const variantStyles = {
      primary:
        'bg-emerald-800 hover:bg-emerald-900 text-white border border-emerald-950/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(0,0,0,0.08)] ring-1 ring-emerald-700/20',
      secondary:
        'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_1px_2px_rgba(0,0,0,0.04)]',
      subtle:
        'bg-emerald-50 hover:bg-emerald-100/80 text-emerald-900 border border-emerald-200/60 shadow-2xs',
      outline:
        'bg-transparent hover:bg-slate-100 text-slate-700 border border-slate-200',
      ghost:
        'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-transparent',
      danger:
        'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/80 shadow-2xs',
    }

    const sizeStyles = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5 min-h-[30px]',
      md: 'text-xs sm:text-sm px-3.5 py-2 gap-2 min-h-[36px]',
      lg: 'text-sm px-4.5 py-2.5 gap-2.5 min-h-[42px]',
      icon: 'p-1.5 min-h-[32px] min-w-[32px]',
    }

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {icon && iconPosition === 'left' && (
          <span className="shrink-0 transition-transform">{icon}</span>
        )}
        {children && <span className="tracking-tight">{children}</span>}
        {icon && iconPosition === 'right' && (
          <span className="shrink-0 transition-transform">{icon}</span>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'