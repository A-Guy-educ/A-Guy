'use client'

import { ChatMessageRole } from '@/lib/ai/chat-message-role'
import { useTranslations } from '@/providers/I18n'
import { cn } from '@/utilities/ui'
import { BookOpen, Loader2, Plus, Send } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { ChatMessageContent } from '@/components/chat'
import { FormulaPanel } from '../FormulaPanel'
import { MathPalette } from '../MathPalette'
import { useNotebookChat } from '../NotebookChat/useNotebookChat'

interface ChatInterfaceProps {
  exerciseId?: string
  lessonId?: string
}

export function ChatInterface({ exerciseId, lessonId }: ChatInterfaceProps) {
  const t = useTranslations('courses')
  const {
    messages,
    inputValue,
    isLoading,
    isLoadingHistory,
    messagesContainerRef,
    messagesEndRef,
    inputRef,
    setInputValue,
    handleSubmit,
  } = useNotebookChat({
    initialMessage: t('chatWelcome'),
    authRequiredMessage: t('chatAuthRequired'),
    errorMessage: t('chatError'),
    hintPrompt: t('chatHintPrompt'),
    solutionPrompt: t('chatSolutionPrompt'),
    fullSolutionPrompt: t('chatFullSolutionPrompt'),
    resetConfirmMessage: t('chatResetConfirm'),
    resetSuccessMessage: t('chatResetSuccess'),
    resetErrorMessage: t('chatResetError'),
    acknowledgment: t('chatAIAcknowledgment'),
    exerciseId,
    lessonId,
  })

  const [isMathPaletteOpen, setIsMathPaletteOpen] = useState(false)
  const [isFormulaPanelOpen, setIsFormulaPanelOpen] = useState(false)
  const [mathPreview, setMathPreview] = useState('')

  // Update LaTeX preview
  useEffect(() => {
    if (inputValue.includes('\\') || inputValue.includes('^')) {
      setMathPreview(inputValue)
    } else {
      setMathPreview('')
    }
  }, [inputValue])

  const injectFormula = (template: string, cursorOffset: number) => {
    if (!inputRef.current) return

    const start = inputRef.current.selectionStart ?? 0
    const end = inputRef.current.selectionEnd ?? 0
    const before = inputValue.substring(0, start)
    const after = inputValue.substring(end)

    const newValue = before + template + after
    setInputValue(newValue)

    // Move cursor after state update
    requestAnimationFrame(() => {
      const newCursorPos = start + cursorOffset
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos)
      inputRef.current?.focus()
    })
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsMathPaletteOpen(false)
    setIsFormulaPanelOpen(false)
    handleSubmit(e)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages Area */}
      <div ref={messagesContainerRef} className="flex-grow overflow-y-auto p-5 space-y-4 min-h-0">
        {isLoadingHistory && (
          <div className="flex items-center justify-center p-4 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            {t('chatLoadingHistory')}
          </div>
        )}
        {!isLoadingHistory &&
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                'max-w-[85%] px-[18px] py-3.5 text-base leading-relaxed shadow-sm',
                msg.role === ChatMessageRole.User
                  ? 'ml-auto bg-primary text-primary-foreground rounded-[20px] rounded-bl-[4px]'
                  : 'mr-auto bg-card text-foreground border border-border rounded-[20px] rounded-br-[4px]',
              )}
            >
              <ChatMessageContent content={msg.content} />
            </div>
          ))}
        {isLoading && (
          <div className="mr-auto bg-card text-foreground border border-border px-[18px] py-3.5 rounded-[20px] rounded-br-[4px] max-w-[85%] flex items-center gap-2 shadow-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{t('chatThinking')}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Container */}
      <div className="flex-grow-0 flex-shrink-0 bg-card border-t border-border p-5 pb-8 relative">
        {/* Math Preview Popup */}
        {mathPreview && (
          <div className="absolute bottom-full left-5 right-5 mb-2.5 bg-card border border-primary-soft rounded-xl p-2.5 text-center shadow-panel z-20">
            <span className="text-sm font-mono">{mathPreview}</span>
          </div>
        )}

        {/* Formula Panel (Popup) */}
        <FormulaPanel
          isOpen={isFormulaPanelOpen}
          onClose={() => setIsFormulaPanelOpen(false)}
          onInject={injectFormula}
        />

        {/* Math Palette (Slide-out) */}
        <MathPalette isOpen={isMathPaletteOpen} onInject={injectFormula} />

        {/* Toolbar Above Input */}
        <div className="flex gap-4 mb-2.5 px-1.5">
          <button
            type="button"
            className={cn(
              'p-1 text-muted-foreground hover:text-primary transition-colors',
              isFormulaPanelOpen && 'text-primary',
            )}
            onClick={() => {
              setIsFormulaPanelOpen(!isFormulaPanelOpen)
              setIsMathPaletteOpen(false)
            }}
            aria-label={t('formulaSheet')}
          >
            <BookOpen className="w-5 h-5" />
          </button>
        </div>

        {/* Input Wrapper */}
        <form onSubmit={handleFormSubmit}>
          <div className="max-w-[850px] mx-auto bg-muted rounded-[30px] flex items-center px-4 py-1.5 border border-input gap-3">
            <input
              ref={inputRef}
              type="text"
              className="flex-1 bg-transparent border-none outline-none py-2.5 text-[17px] text-foreground placeholder:text-muted-foreground"
              placeholder={t('chatInputPlaceholder')}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                // Let the form onSubmit handle Enter key submission
                // Don't call handleKeyDown to avoid double submission
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleFormSubmit(e as unknown as React.FormEvent)
                }
              }}
              disabled={isLoading}
            />

            {/* Math Keyboard Toggle */}
            <button
              type="button"
              className={cn(
                'p-1.5 text-muted-foreground hover:text-primary transition-colors',
                isMathPaletteOpen && 'text-primary',
              )}
              onClick={() => {
                setIsMathPaletteOpen(!isMathPaletteOpen)
                setIsFormulaPanelOpen(false)
              }}
              aria-label={t('mathKeyboard')}
            >
              <span className="text-lg font-bold">ƒ</span>
            </button>

            {/* File Upload */}
            <label className="p-1.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer">
              <Plus className="w-5 h-5" />
              <input type="file" className="hidden" />
            </label>

            {/* Send Button */}
            <button
              type="submit"
              className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-input hover:bg-primary/90 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || !inputValue.trim()}
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
