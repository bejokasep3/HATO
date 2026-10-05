'use client'

import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  icon?: React.ReactNode
  children: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  icon,
  children,
  maxWidth = 'lg',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const closeRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]')).filter((element) => !element.matches(':disabled') && element.getClientRects().length > 0)
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    if (isOpen) {
      const previouslyFocused = document.activeElement as HTMLElement | null
      const previousOverflow = document.body.style.overflow
      const background = Array.from(document.body.children).filter((element): element is HTMLElement => element instanceof HTMLElement && element !== overlayRef.current).map((element) => ({ element, inert: element.inert }))
      background.forEach(({ element }) => { element.inert = true })
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
      const frame = requestAnimationFrame(() => closeRef.current?.focus())
      return () => {
        cancelAnimationFrame(frame)
        document.body.style.overflow = previousOverflow
        background.forEach(({ element, inert }) => { element.inert = inert })
        window.removeEventListener('keydown', handleKeyDown)
        previouslyFocused?.focus()
      }
    }
  }, [isOpen])

  if (!isOpen || typeof document === 'undefined') return null

  const widthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }

  return createPortal(
    <div ref={overlayRef} className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div
        className="fixed inset-0"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'relative w-full bg-white rounded-2xl border border-slate-200/90 shadow-2xl p-4 sm:p-6 z-10 animate-in fade-in zoom-in-95 duration-150 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain',
          widthStyles[maxWidth]
        )}
      >
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 gap-3">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200/60">
                {icon}
              </div>
            )}
            <div>
              <h2 id={titleId} className="text-base font-extrabold text-slate-900 tracking-tight">{title}</h2>
              {description && (
                <p id={descriptionId} className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
              )}
            </div>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="min-h-11 min-w-11 p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer shrink-0 inline-flex items-center justify-center"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="pt-4">{children}</div>
      </div>
    </div>, document.body
  )
}
