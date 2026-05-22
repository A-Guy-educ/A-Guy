'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'
import { MessageSquare, Send, Plus } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface FloatingAskButtonProps {
  /** Callback when the ask button is clicked */
  onAskClick?: () => void
  /** When true, the button is centered (e.g., when Prev/Next navigation is visible) */
  isCentered?: boolean
}

/**
 * Floating Ask Button with expandable input panel
 *
 * A floating action button that expands into a full chat input panel with math support,
 * image upload, and send functionality. Fixed to bottom-left corner (24px from edges).
 *
 * Issue #1786: Upgrade floating chat button with expandable input panel
 */
export function FloatingAskButton({ onAskClick, isCentered = false }: FloatingAskButtonProps) {
  const t = useTranslations('courses')
  const tAsk = useTranslations('homepage.ask')

  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isFormulaOpen, setIsFormulaOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input when panel opens
  useEffect(() => {
    if (isPanelOpen && inputRef.current) {
      // Small delay to allow animation to start
      const timeout = setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timeout)
    }
  }, [isPanelOpen])

  // Click outside to close panel
  useEffect(() => {
    if (!isPanelOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Don't close if clicking inside the panel or on the floating button
      if (panelRef.current?.contains(target)) return
      // Find the floating button by its aria-label
      const button = document.querySelector(
        '[aria-label="Stuck on a problem? Ask your AI teacher here"]',
      )
      if (button?.contains(target)) return

      setIsPanelOpen(false)
      setIsFormulaOpen(false)
    }

    // Use mousedown for better UX (before focus changes)
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isPanelOpen])

  const handleOpenPanel = useCallback(() => {
    setIsPanelOpen(true)
    onAskClick?.()
    // Dispatch focus-chat-input for backward compatibility
    window.dispatchEvent(new CustomEvent('focus-chat-input'))
  }, [onAskClick])

  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false)
    setIsFormulaOpen(false)
    setInputValue('')
  }, [])

  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return

    // Dispatch quick-chat-submit event with the message
    window.dispatchEvent(
      new CustomEvent('quick-chat-submit', {
        detail: { message: inputValue.trim() },
      }),
    )

    handleClosePanel()
  }, [inputValue, handleClosePanel])

  const _handleFormulaInsert = useCallback(
    (latex: string) => {
      const el = inputRef.current
      const start = el?.selectionStart ?? inputValue.length
      const end = el?.selectionEnd ?? inputValue.length
      const before = inputValue.substring(0, start)
      const after = inputValue.substring(end)
      setInputValue(before + `$${latex}$` + after)
      setIsFormulaOpen(false)
      // Refocus the input after inserting formula
      setTimeout(() => inputRef.current?.focus(), 0)
    },
    [inputValue],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      } else if (e.key === 'Escape') {
        handleClosePanel()
      }
    },
    [handleSend, handleClosePanel],
  )

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Dispatch event to attach file to chat
      Array.from(e.target.files).forEach((file) => {
        window.dispatchEvent(
          new CustomEvent('ask-media-attach', {
            detail: { filename: file.name },
          }),
        )
      })
      e.target.value = ''
    }
  }, [])

  const buttonPosition = isCentered ? 'left-1/2 -translate-x-1/2' : 'left-6'

  return (
    <div className="fixed bottom-6 left-6 z-[70]" ref={panelRef}>
      <AnimatePresence mode="wait">
        {isPanelOpen ? (
          // Expanded panel
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.8, x: -20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: -20 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={cn(
              'bg-card border border-border rounded-full shadow-elevation-3',
              'flex items-center gap-2 pl-3 pr-4 py-2',
              'min-w-[320px] max-w-[400px]',
            )}
          >
            {/* Actions bar - left side */}
            <div className="flex items-center gap-1.5">
              {/* Math formula button */}
              <button
                type="button"
                onClick={() => setIsFormulaOpen(!isFormulaOpen)}
                className={cn(
                  'w-8 h-8 flex items-center justify-center rounded-lg',
                  'bg-primary/10 text-primary border border-primary/20',
                  'hover:bg-primary/20 transition-colors text-sm font-serif italic',
                )}
                title={t('insertFormula')}
                aria-label={t('insertFormula')}
              >
                f
              </button>

              {/* Media upload button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'w-8 h-8 flex items-center justify-center rounded-full',
                  'text-muted-foreground hover:text-primary',
                  'hover:bg-primary/10 transition-colors',
                )}
                title={t('chatAttachFile')}
                aria-label={t('chatAttachFile')}
              >
                <Plus className="w-5 h-5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                multiple
                onChange={handleFileSelect}
              />
            </div>

            {/* Text input - right side */}
            <input
              ref={inputRef}
              type="text"
              className={cn(
                'flex-1 bg-transparent border-none outline-none',
                'text-chat-input text-foreground placeholder:text-muted-foreground',
                'py-2 min-w-0',
                'rtl:text-right ltr:text-left',
              )}
              placeholder={tAsk('chatInputPlaceholder')}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />

            {/* Send button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center',
                'bg-primary text-primary-foreground',
                'shadow-input hover:bg-primary/90 hover:scale-105',
                'transition-all duration-normal',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
              )}
              aria-label={t('sendMessage')}
            >
              <Send className="w-5 h-5" />
            </button>
          </motion.div>
        ) : (
          // Collapsed button
          <motion.button
            key="button"
            type="button"
            onClick={handleOpenPanel}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={cn(
              'fixed bottom-6 z-[70] p-4',
              buttonPosition,
              'text-primary-foreground bg-primary rounded-full',
              'shadow-elevation-3 hover:scale-110 hover:bg-primary/90',
              'transition-all duration-normal flex items-center justify-center',
              'w-14 h-14 md:hidden',
            )}
            aria-label={t('askTip') || 'Stuck on a problem? Ask your AI teacher here'}
          >
            <MessageSquare className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
