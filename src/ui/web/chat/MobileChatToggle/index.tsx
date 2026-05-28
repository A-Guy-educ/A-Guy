'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'
import { ChevronDown, FunctionSquare, Loader2, MessageCircle, Plus, Send } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

interface MobileChatToggleProps {
  /** Called when the FAB is tapped to expand the chat */
  onExpand: () => void
  /** Called when the collapse button is pressed */
  onCollapse: () => void
  /** Current input value (controlled) */
  inputValue: string
  /** Called when input value changes */
  onInputChange: (value: string) => void
  /** Called when form is submitted */
  onSubmit: (e: React.FormEvent) => void
  /** Called when file picker should open */
  onOpenFilePicker: () => void
  /** Whether there are active uploads */
  isUploading: boolean
  /** Whether math tools (formula) should be shown */
  showMathTools: boolean
  /** Called when formula button is toggled */
  onFormulaToggle: () => void
  /** Whether formula composer is open */
  isFormulaOpen: boolean
  /** Whether the input is focused */
  isInputFocused: boolean
  /** Called when input focus state changes */
  onInputFocusChange: (focused: boolean) => void
  /** Ref to the input element (passed from ChatInterface) */
  inputRef: React.RefObject<HTMLInputElement | null>
  /** Whether the chat is currently visible (from SplitPaneLayout) */
  isChatVisible: boolean
  /** Loading state for submit */
  isSubmitting: boolean
  /** Translation namespace */
  translationNamespace?: string
}

/**
 * Mobile chat FAB toggle component.
 *
 * On mobile (<1024px), replaces the draggable chat panel with a FAB that
 * expands into a full-width pill-shaped input bar.
 *
 * - FAB is always visible at bottom-left (LTR) or bottom-right (RTL)
 * - Tapping FAB expands it into the chat input bar
 * - Collapse button or Escape closes back to FAB
 * - Listens for focus-chat-input event to auto-open (from onChatInteraction callbacks)
 */
export function MobileChatToggle({
  onExpand,
  onCollapse,
  inputValue,
  onInputChange,
  onSubmit,
  onOpenFilePicker,
  isUploading,
  showMathTools,
  onFormulaToggle,
  isFormulaOpen,
  isInputFocused,
  onInputFocusChange,
  inputRef,
  isChatVisible,
  isSubmitting,
  translationNamespace = 'homepage.ask',
}: MobileChatToggleProps) {
  const t = useTranslations(translationNamespace)
  const [isOpen, setIsOpen] = useState(false)
  const [localInputValue, setLocalInputValue] = useState(inputValue)
  const isInternalOpen = isOpen || isChatVisible
  const formRef = useRef<HTMLFormElement>(null)

  // Sync local input value with prop
  useEffect(() => {
    setLocalInputValue(inputValue)
  }, [inputValue])

  const open = useCallback(() => {
    setIsOpen(true)
    onExpand()
  }, [onExpand])

  const close = useCallback(() => {
    setIsOpen(false)
    onCollapse()
  }, [onCollapse])

  // Listen for focus-chat-input event dispatched by ChatInterface
  // This auto-opens the FAB when onChatInteraction callbacks fire
  useEffect(() => {
    const handleFocusInput = () => {
      if (!isInternalOpen) {
        open()
      }
    }
    window.addEventListener('focus-chat-input', handleFocusInput)
    return () => window.removeEventListener('focus-chat-input', handleFocusInput)
  }, [open, isInternalOpen])

  const handleFabClick = () => {
    if (!isInternalOpen) {
      open()
    }
  }

  const handleCollapse = () => {
    close()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && isInternalOpen) {
      e.preventDefault()
      close()
    }
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!localInputValue.trim() || isSubmitting) return
    onSubmit(e)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalInputValue(e.target.value)
    onInputChange(e.target.value)
  }

  const handleInputFocus = () => {
    onInputFocusChange(true)
  }

  const handleInputBlur = (e: React.FocusEvent) => {
    // Don't blur if focusing within formula controls
    const related = e.relatedTarget as HTMLElement | null
    if (related?.closest('[data-math-controls]')) return
    onInputFocusChange(false)
  }

  // Collapsed FAB state
  if (!isInternalOpen) {
    return (
      <button
        onClick={handleFabClick}
        className="fixed bottom-6 start-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-elevation-3 hover:scale-110 hover:bg-primary/90 transition-all duration-normal flex items-center justify-center"
        aria-label={t('openChat')}
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    )
  }

  // Expanded input bar state
  return (
    <div
      className="fixed inset-0 z-40 bg-black/5 animate-in fade-in duration-normal"
      onClick={handleCollapse}
    >
      <div
        className="absolute bottom-0 start-0 end-0 bg-card rounded-t-2xl shadow-elevation-4 p-card-padding pb-8 animate-in slide-in-from-bottom-0 duration-normal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header with collapse button */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={handleCollapse}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label={t('closeChat')}
          >
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          </button>
          <span className="text-body-sm font-medium text-foreground">{t('chatTitle')}</span>
          <div className="w-9" /> {/* Spacer to balance layout */}
        </div>

        {/* Input form */}
        <form ref={formRef} onSubmit={handleFormSubmit}>
          <div
            className={cn(
              'bg-muted rounded-full flex items-center px-4 py-1.5 border border-input gap-3',
              isInputFocused && 'ring-2 ring-primary/30',
            )}
          >
            {/* Formula button */}
            {showMathTools && (
              <button
                type="button"
                onClick={onFormulaToggle}
                className={cn(
                  'p-1.5 rounded-lg border transition-colors',
                  isFormulaOpen
                    ? 'bg-primary/20 text-primary border-primary/40'
                    : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20',
                )}
                title={t('insertFormula')}
              >
                <FunctionSquare className="w-5 h-5" />
              </button>
            )}

            {/* Text input */}
            <input
              ref={inputRef}
              type="text"
              className="flex-1 bg-transparent border-none outline-none py-2.5 text-chat-input text-foreground placeholder:text-muted-foreground"
              placeholder={t('chatInputPlaceholder')}
              value={localInputValue}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleFormSubmit(e as unknown as React.FormEvent)
                }
              }}
              disabled={isSubmitting}
            />

            {/* Media upload button */}
            <button
              type="button"
              onClick={onOpenFilePicker}
              className={cn(
                'p-1.5 text-muted-foreground hover:text-primary transition-colors',
                isUploading && 'opacity-disabled cursor-not-allowed',
              )}
              disabled={isUploading}
              aria-label={t('attachFile')}
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
            </button>

            {/* Send button */}
            <button
              type="submit"
              className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-input hover:bg-primary/90 transition-all hover:scale-105 disabled:opacity-disabled disabled:cursor-not-allowed disabled:hover:scale-100"
              disabled={isSubmitting || !localInputValue.trim()}
              aria-label={t('sendMessage')}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
