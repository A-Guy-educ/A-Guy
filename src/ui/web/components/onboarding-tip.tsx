'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/infra/utils/ui'

interface OnboardingTipProps {
  id: string // unique key for localStorage persistence
  children: React.ReactNode
  tip: string
  position?: 'top' | 'bottom' | 'start' | 'end'
  className?: string
}

const STORAGE_KEY = 'aguy-dismissed-tips'

function getDismissedTips(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function dismissTip(id: string) {
  const dismissed = getDismissedTips()
  if (!dismissed.includes(id)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed, id]))
  }
}

export function OnboardingTip({
  id,
  children,
  tip,
  position = 'bottom',
  className,
}: OnboardingTipProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const dismissed = getDismissedTips()
    if (!dismissed.includes(id)) {
      // Small delay so it doesn't flash on load
      const timer = setTimeout(() => setShow(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [id])

  const handleDismiss = () => {
    setShow(false)
    dismissTip(id)
  }

  const positionClasses = {
    top: 'bottom-full mb-2 start-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 start-1/2 -translate-x-1/2',
    start: 'end-full me-2 top-1/2 -translate-y-1/2',
    end: 'start-full ms-2 top-1/2 -translate-y-1/2',
  }

  return (
    <div className={cn('relative inline-flex', className)}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'absolute z-tooltip w-max max-w-[240px]',
              'bg-foreground text-background text-body-xs rounded-lg',
              'px-3 py-2 shadow-elevation-3',
              'flex items-start gap-2',
              positionClasses[position],
            )}
          >
            <span className="flex-1">{tip}</span>
            <button
              onClick={handleDismiss}
              className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Dismiss tip"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
