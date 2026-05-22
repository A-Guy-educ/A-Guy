'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'
import { MessageSquare } from 'lucide-react'
import React from 'react'

interface FloatingAskButtonProps {
  /** Callback when the ask button is clicked */
  onAskClick?: () => void
  /** When true, the button is centered (e.g., when Prev/Next navigation is visible) */
  isCentered?: boolean
}

/**
 * Floating Ask Button component
 *
 * A floating action button that focuses the chat input when clicked.
 * Fixed to bottom-left corner (above safe-area on iOS).
 *
 * Issue #1741: [Mobile] Floating "שאל שאלה" button in bottom-left corner
 */
export function FloatingAskButton({ onAskClick, isCentered = false }: FloatingAskButtonProps) {
  const t = useTranslations('courses')

  const handleClick = () => {
    // Dispatch focus event to ChatInterface
    window.dispatchEvent(new CustomEvent('focus-chat-input'))
    onAskClick?.()
  }

  const buttonPosition = isCentered ? 'left-1/2 -translate-x-1/2' : 'left-0'

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'fixed bottom-0 z-[70] p-4',
        'pb-[max(1rem,env(safe-area-inset-bottom))]',
        buttonPosition,
        'text-primary-foreground bg-primary rounded-full',
        'shadow-elevation-3 hover:scale-110 hover:bg-primary/90',
        'transition-all duration-normal flex items-center justify-center',
        'w-14 h-14 md:hidden',
      )}
      aria-label={t('askTip') || 'Stuck on a problem? Ask your AI teacher here'}
    >
      <MessageSquare className="w-6 h-6" />
    </button>
  )
}
