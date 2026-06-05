'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'
import { MessageSquare, X } from 'lucide-react'
import React, { useCallback, useEffect } from 'react'

interface MobileChatFABProps {
  /** Whether the FAB panel is currently open */
  isOpen: boolean
  /** Called when the panel should open */
  onOpen: () => void
  /** Called when the panel should close */
  onClose: () => void
  /** The ChatInterface component to render inside the panel */
  children: React.ReactNode
}

/**
 * Mobile Chat FAB (Floating Action Button) component
 *
 * - A single button at bottom-left that toggles a bottom-anchored chat panel
 * - When closed: MessageSquare icon, sits 1.5rem from the bottom
 * - When open: X icon, rises so it sits 1.5rem above the panel
 * - Panel has no internal header — the button itself closes the chat
 * - Sets a CSS custom property `--mobile-chat-panel-h` on documentElement
 *   so other bottom-fixed UI (e.g. the Learning Assistant button) can lift
 *   to clear the panel while it's open.
 *
 * Issue #2192: Add mobile chat FAB (button-to-open) on lesson pages
 */
export function MobileChatFAB({ isOpen, onOpen, onClose, children }: MobileChatFABProps) {
  const t = useTranslations('courses')

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // focus-chat-input event auto-opens the panel (wrong-answer help, etc.)
  useEffect(() => {
    const handleFocusChatInput = () => onOpen()
    window.addEventListener('focus-chat-input', handleFocusChatInput)
    return () => window.removeEventListener('focus-chat-input', handleFocusChatInput)
  }, [onOpen])

  // Expose panel height as a CSS variable so siblings can lift above it.
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.style.setProperty('--mobile-chat-panel-h', isOpen ? '60dvh' : '0px')
    return () => {
      document.documentElement.style.setProperty('--mobile-chat-panel-h', '0px')
    }
  }, [isOpen])

  const handleToggle = useCallback(() => {
    if (isOpen) onClose()
    else onOpen()
  }, [isOpen, onOpen, onClose])

  return (
    <>
      {/* Toggle button — always rendered. Bottom position lifts above the
          panel via the same --mobile-chat-panel-h variable used by other
          bottom-fixed UI. */}
      <button
        type="button"
        onClick={handleToggle}
        style={{ bottom: 'calc(var(--mobile-chat-panel-h, 0px) + 1.5rem)' }}
        className={cn(
          'fixed left-6 z-[70]',
          'w-14 h-14',
          'bg-primary text-primary-foreground rounded-full',
          'shadow-elevation-3 hover:scale-110 hover:bg-primary/90',
          'transition-all duration-normal flex items-center justify-center',
          'lg:hidden',
        )}
        aria-label={isOpen ? t('closeChat') : t('openChat')}
        aria-expanded={isOpen}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>

      {/* Bottom panel — fixed 60dvh so the inner flex layout (messages on
          top, input pinned at bottom) has a real height to distribute. */}
      {isOpen && (
        <div
          className={cn(
            'fixed left-0 right-0 bottom-0 z-[60]',
            'bg-card border-t border-border',
            'h-[60dvh]',
            'flex flex-col overflow-hidden',
            'animate-in slide-in-from-bottom-0 duration-slow',
            'lg:hidden',
          )}
          role="dialog"
          aria-modal="false"
          aria-label={t('chatPanelTitle')}
        >
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>
        </div>
      )}
    </>
  )
}
