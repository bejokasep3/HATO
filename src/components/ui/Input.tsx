'use client'

import React, { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, leftIcon, rightIcon, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {leftIcon && (
          <div className="absolute left-3 text-slate-400 pointer-events-none shrink-0 flex items-center">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full text-xs sm:text-sm font-medium border rounded-xl px-3 py-2 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 transition-all duration-150',
            'focus:bg-white focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10',
            leftIcon ? 'pl-9' : 'pl-3',
            rightIcon ? 'pr-9' : 'pr-3',
            error ? 'border-rose-300 focus:border-rose-600 focus:ring-rose-500/10' : 'border-slate-200/90',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 text-slate-400 pointer-events-none shrink-0 flex items-center">
            {rightIcon}
          </div>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'text-xs sm:text-sm font-semibold border rounded-xl px-3 py-2 bg-white text-slate-800 transition-all duration-150 cursor-pointer shadow-2xs',
          'focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10',
          error ? 'border-rose-300' : 'border-slate-200/90',
          className
        )}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = 'Select'