'use client'

import { motion } from 'framer-motion'
import * as React from 'react'
import { useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'
import { X } from 'lucide-react'

/**
 * @fileType component
 * @domain study-mode
 * @pattern chat-panel
 * @ai-summary Slide-in chat panel for Hint/Ask mode
 */

interface ChatSlidePanelProps {
  children: React.ReactNode
  onClose: () => void
  className?: string
}

export function ChatSlidePanel({ children, onClose, className }: ChatSlidePanelProps) {
  const t = useTranslations('studyMode')
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Determine slide direction based on RTL
  const isRtl = document.body.dir === 'rtl'
  const slideFrom = isRtl ? '-left' : '-right'

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30 z-40 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide panel */}
      <motion.div
        initial={prefersReducedMotion ? {} : { x: `100%${slideFrom}` }}
        animate={{ x: 0 }}
        exit={prefersReducedMotion ? {} : { x: `100%${slideFrom}` }}
        transition={{ type: 'spring', duration: 0.3 }}
        className={cn(
          'fixed top-0 end-0 h-full w-full max-w-md z-50',
          'glass-surface rounded-s-4xl',
          'border-s border-mode-border/20',
          'flex flex-col',
          className,
        )}
        role="dialog"
        aria-label={t('chat.panelLabel')}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-mode-border/20">
          <h2 className="font-semibold">{t('chat.panelLabel')}</h2>
          <button
            onClick={onClose}
            className={cn(
              'p-2 rounded-full hover:bg-mode-surface/50 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mode-accent',
              'min-h-[48px] min-w-[48px] flex items-center justify-center',
            )}
            aria-label={t('chat.slideOut')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </motion.div>
    </>
  )
}
