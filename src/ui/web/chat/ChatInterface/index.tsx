'use client'

import { ChatMessageRole } from '@/infra/llm/chat-message-role'
import { useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'
import {
  Loader2,
  Send,
  Plus,
  X,
  Image as ImageIcon,
  FileUp,
  BookOpen,
  CheckCircle,
  Lightbulb,
  RefreshCw,
  MessageSquare,
  FileText,
} from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { ChatMessageContent } from '../ChatMessageContent'
import { useNotebookChat } from '../hooks/useNotebookChat'

// Optional components - will be lazy-loaded if needed
let FormulaPanel: React.ComponentType<{
  isOpen: boolean
  onClose: () => void
  onInject: (template: string, cursorOffset: number) => void
}> | null = null

let MathPalette: React.ComponentType<{
  isOpen: boolean
  onInject: (template: string, cursorOffset: number) => void
}> | null = null

export type ViewMode = 'PDF' | 'Chat'

interface ChatInterfaceProps {
  // Context
  courseId?: string
  chapterId?: string
  lessonId?: string
  exerciseId?: string

  // Translations
  translationNamespace?: string

  // Features
  showQuickActions?: boolean
  showResetButton?: boolean
  showMathTools?: boolean

  // Display
  displayMode?: 'full' | 'input-only'

  // Mobile
  isMobile?: boolean
  viewMode?: ViewMode
  onModeToggle?: () => void
  onChatInteraction?: () => void
}

export function ChatInterface({
  courseId,
  chapterId,
  lessonId,
  exerciseId,
  translationNamespace = 'homepage.ask',
  showQuickActions = false,
  showResetButton = false,
  showMathTools = false,
  displayMode = 'full',
  isMobile,
  viewMode,
  onModeToggle,
  onChatInteraction,
}: ChatInterfaceProps) {
  const t = useTranslations(translationNamespace)
  const tCourses = useTranslations('courses')

  const {
    messages,
    inputValue,
    isLoading,
    isLoadingHistory,
    messagesContainerRef,
    messagesEndRef,
    inputRef,
    fileInputRef,
    contextKey,
    setInputValue,
    handleSubmit,
    handleQuickAction,
    handleReset,
    // Media upload
    uploadedMedia,
    isUploading,
    handleFileSelect,
    removeMedia,
    openFilePicker,
  } = useNotebookChat({
    initialMessage: t('chatWelcome'),
    authRequiredMessage: t('chatAuthRequired'),
    errorMessage: tCourses('chatError'),
    hintPrompt: tCourses('chatHintPrompt'),
    solutionPrompt: tCourses('chatSolutionPrompt'),
    fullSolutionPrompt: tCourses('chatFullSolutionPrompt'),
    resetConfirmMessage: tCourses('chatResetConfirm'),
    resetSuccessMessage: tCourses('chatResetSuccess'),
    resetErrorMessage: tCourses('chatResetError'),
    acknowledgment: tCourses('chatAIAcknowledgment'),
    courseId,
    chapterId,
    lessonId,
    exerciseId,
    // Media upload messages
    unsupportedFileTypeMessage: tCourses('chatUnsupportedFileType'),
    fileTooLargeMessage: tCourses('chatFileTooLarge'),
    maxFilesMessage: tCourses('chatMaxFiles'),
    uploadFailedMessage: tCourses('chatUploadFailed'),
  })

  // Math tools state
  const [isMathPaletteOpen, setIsMathPaletteOpen] = useState(false)
  const [isFormulaPanelOpen, setIsFormulaPanelOpen] = useState(false)
  const [mathPreview, setMathPreview] = useState('')

  // Lazy-load math tools components if needed
  useEffect(() => {
    if (showMathTools && !FormulaPanel) {
      import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseId]/_components/FormulaPanel').then(
        (mod) => {
          FormulaPanel = mod.FormulaPanel
        },
      )
      import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseId]/_components/MathPalette').then(
        (mod) => {
          MathPalette = mod.MathPalette
        },
      )
    }
  }, [showMathTools])

  // Update LaTeX preview
  useEffect(() => {
    if (showMathTools && (inputValue.includes('\\') || inputValue.includes('^'))) {
      setMathPreview(inputValue)
    } else {
      setMathPreview('')
    }
  }, [inputValue, showMathTools])

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (showMathTools) {
      setIsMathPaletteOpen(false)
      setIsFormulaPanelOpen(false)
    }

    if (onChatInteraction) {
      onChatInteraction()
    }

    handleSubmit(e)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header with optional reset button */}
      {showResetButton && (
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="font-medium text-sm text-foreground">{tCourses('chatTitle')}</h3>
          {contextKey && (
            <button
              onClick={handleReset}
              disabled={isLoading}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title={tCourses('chatReset')}
            >
              <RefreshCw className="w-3 h-3" />
              <span>{tCourses('chatReset')}</span>
            </button>
          )}
        </div>
      )}

      {/* Messages Area - Hidden when displayMode is 'input-only' */}
      <div
        ref={messagesContainerRef}
        className={cn(
          'flex-grow overflow-y-auto p-5 space-y-4 min-h-0',
          displayMode === 'input-only' && 'hidden',
        )}
      >
        {isLoadingHistory && (
          <div className="flex items-center justify-center p-4 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            {tCourses('chatLoadingHistory')}
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
              {msg.media && msg.media.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {msg.media.map((mediaItem, mediaIdx) => (
                    <div
                      key={mediaIdx}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs',
                        msg.role === ChatMessageRole.User ? 'bg-primary-foreground/20' : 'bg-muted',
                      )}
                    >
                      <ImageIcon className="w-3 h-3" />
                      <span className="max-w-[120px] truncate">
                        {mediaItem.filename || `media-${mediaIdx + 1}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <ChatMessageContent content={msg.content} />
            </div>
          ))}
        {isLoading && (
          <div className="mr-auto bg-card text-foreground border border-border px-[18px] py-3.5 rounded-[20px] rounded-br-[4px] max-w-[85%] flex items-center gap-2 shadow-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{tCourses('chatThinking')}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {showQuickActions && (
        <div className="flex gap-2 p-3 border-t border-border">
          <button
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => handleQuickAction('hint')}
            disabled={isLoading}
          >
            <Lightbulb className="w-4 h-4 text-yellow-400" />
            <span>{tCourses('chatHint')}</span>
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => handleQuickAction('solution')}
            disabled={isLoading}
          >
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>{tCourses('chatSolution')}</span>
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => handleQuickAction('full')}
            disabled={isLoading}
          >
            <BookOpen className="w-4 h-4 text-blue-500" />
            <span>{tCourses('chatFullSolution')}</span>
          </button>
        </div>
      )}

      {/* Input Container */}
      <div className="flex-grow-0 flex-shrink-0 bg-card border-t border-border p-5 pb-8 relative">
        {/* Math Preview Popup */}
        {showMathTools && mathPreview && (
          <div className="absolute bottom-full left-5 right-5 mb-2.5 bg-card border border-primary-soft rounded-xl p-2.5 text-center shadow-panel z-20">
            <span className="text-sm font-mono">{mathPreview}</span>
          </div>
        )}

        {/* Formula Panel (Popup) */}
        {showMathTools && FormulaPanel && (
          <FormulaPanel
            isOpen={isFormulaPanelOpen}
            onClose={() => setIsFormulaPanelOpen(false)}
            onInject={injectFormula}
          />
        )}

        {/* Math Palette (Slide-out) */}
        {showMathTools && MathPalette && (
          <MathPalette isOpen={isMathPaletteOpen} onInject={injectFormula} />
        )}

        {/* Toolbar Above Input */}
        {(showMathTools || (isMobile && viewMode && onModeToggle)) && (
          <div className="flex gap-4 mb-2.5 px-1.5 justify-between items-center">
            {showMathTools && (
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
                aria-label={tCourses('formulaSheet')}
              >
                <BookOpen className="w-5 h-5" />
              </button>
            )}

            {/* Mobile Toggle */}
            {isMobile && viewMode && onModeToggle && (
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-muted hover:bg-muted/80"
                onClick={onModeToggle}
                aria-label={viewMode === 'PDF' ? tCourses('switchToChat') : tCourses('switchToPdf')}
              >
                {viewMode === 'PDF' ? (
                  <>
                    <MessageSquare className="w-4 h-4" />
                    <span className="hidden sm:inline">{tCourses('chat')}</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    <span className="hidden sm:inline">{tCourses('content')}</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Media Preview Chips */}
        {uploadedMedia.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2.5 max-w-[850px] mx-auto">
            {uploadedMedia.map((media) => (
              <div
                key={media.id}
                className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1.5 text-sm border border-input"
              >
                {media.mimeType.startsWith('image/') ? (
                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <FileUp className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="max-w-[120px] truncate text-foreground">{media.filename}</span>
                <button
                  type="button"
                  onClick={() => removeMedia(media.id)}
                  className="p-0.5 hover:bg-destructive/20 rounded-full transition-colors"
                  aria-label={tCourses('chatRemoveFile')}
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Wrapper */}
        <form onSubmit={handleFormSubmit}>
          <div className="max-w-[850px] mx-auto bg-muted rounded-[30px] flex items-center px-4 py-1.5 border border-input gap-3">
            <input
              ref={inputRef}
              type="text"
              className="flex-1 bg-transparent border-none outline-none py-2.5 text-[17px] text-foreground placeholder:text-muted-foreground"
              placeholder={t('chatInputPlaceholder')}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleFormSubmit(e as unknown as React.FormEvent)
                }
              }}
              disabled={isLoading}
            />

            {/* Math Keyboard Toggle */}
            {showMathTools && (
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
                aria-label={tCourses('mathKeyboard')}
              >
                <span className="text-lg font-bold">ƒ</span>
              </button>
            )}

            {/* File Upload */}
            <button
              type="button"
              className={cn(
                'p-1.5 text-muted-foreground hover:text-primary transition-colors',
                isUploading && 'opacity-50 cursor-not-allowed',
              )}
              onClick={openFilePicker}
              disabled={isUploading || uploadedMedia.length >= 5}
              aria-label={tCourses('chatAttachFile')}
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
            />

            {/* Send Button */}
            <button
              type="submit"
              className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-input hover:bg-primary/90 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                isLoading || isUploading || (!inputValue.trim() && uploadedMedia.length === 0)
              }
              aria-label={tCourses('sendMessage')}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
