'use client'

import { ChatMessageRole } from '@/infra/llm/chat-message-role'
import { useCurrentUser } from '@/client/hooks/useCurrentUser'
import { cn } from '@/infra/utils/ui'
import { useTranslations } from '@/ui/web/providers/I18n'
import {
  BookOpen,
  CheckCircle,
  FileText,
  FileUp,
  Image as ImageIcon,
  Lightbulb,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  X,
} from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChatErrorSurface } from '../ChatErrorSurface'
import { ChatMessageContent } from '../ChatMessageContent'
import { TTSButton } from '../TTSButton'
import { useNotebookChat } from '../hooks/useNotebookChat'
import { useTeacherProfileLabel } from '../hooks/useTeacherProfileLabel'
import { useTTS } from '../hooks/useTTS'
import { FormulaComposer } from '@/ui/web/shared/MathInput/FormulaComposer'
import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import { FunctionSquare } from 'lucide-react'
import { FormulaSheetButton } from '../FormulaSheetButton'
import { FormulaSheetViewer } from '../FormulaSheetViewer'
import type { FormulaSheetData } from '../FormulaSheetButton'

export type ViewMode = 'PDF' | 'Chat'

interface ChatInterfaceProps {
  // Context
  courseId?: string
  chapterId?: string
  lessonId?: string
  exerciseId?: string

  // Exercise context (optional - for injecting exercise context on navigation)
  // Using loose types to accommodate Payload's Exercise type which may have slight variations
  currentExercise?: {
    id: string
    title: string
    content: {
      blocks: Array<{
        id: string
        type: string
        [key: string]: unknown
      }>
    }
  }
  mediaMap?: Record<
    string,
    {
      id: string
      url?: string | null
      filename?: string
      mimeType?: string
      altText?: string
    }
  >

  // Admin context - category for admin chat scope
  categoryId?: string

  // Admin mode - uses user-specific context without course/lesson context
  adminMode?: boolean
  userId?: string

  // Translations
  translationNamespace?: string
  guestLimitMessage?: string

  // Features
  showQuickActions?: boolean
  showResetButton?: boolean
  showMathTools?: boolean

  // Override computed contextKey (e.g. for Ask page per-session conversations)
  contextKeyOverride?: string

  // Called when the server creates/returns a conversationId (e.g. after first message)
  onConversationCreated?: (conversationId: string, contextKey: string) => void

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
  currentExercise,
  mediaMap,
  categoryId,
  adminMode = false,
  userId,
  translationNamespace = 'homepage.ask',
  guestLimitMessage: _guestLimitMessage,
  showQuickActions = false,
  showResetButton = false,
  showMathTools = false,
  contextKeyOverride,
  onConversationCreated,
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
    // Direct-to-Blob uploads
    directUploads,
    addDirectUploads,
    removeDirectUpload,
    isDirectUploading,
    completedChatAssetIds,
    openFilePicker,
    // Error handling
    chatError,
    dismissError,
    // External media injection (Ask page uploads)
    addExternalMedia,
    askMedia: _askMedia,
    clearAskMedia: _clearAskMedia,
    // Programmatic message injection
    injectExerciseContext,
    addAssistantMessage,
    // Contextual help for incorrect answers
    sendContextualHelp,
    sendVisibleHelp,
    sendContextualHelpWithMedia,
    sendContextualHelpWithMediaId,
  } = useNotebookChat({
    initialMessage: t('chatWelcome'),
    authRequiredMessage: t('chatAuthRequired'),
    guestLimitMessage: tCourses('chatGuestLimitMessage'),
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
    categoryId,
    adminMode,
    userId,
    contextKeyOverride,
    onConversationCreated,
  })

  const { speak, playingMessageId } = useTTS()

  // Teacher profile badge (authenticated users only)
  const { user: currentUser } = useCurrentUser()
  const { label: teacherProfileLabel } = useTeacherProfileLabel(!!currentUser)

  // Auto-send contextual help on incorrect answer (ref pattern for stable listener)
  const incorrectAnswerRef = useRef<(e: Event) => void>(() => {})
  incorrectAnswerRef.current = (e: Event) => {
    const { questionJson, studentAnswer } = (e as CustomEvent).detail as {
      questionJson: string
      studentAnswer: string
    }
    onChatInteraction?.()
    sendContextualHelp(
      `The student answered incorrectly. Here is the full question data:\n${questionJson}\n\nThe student's answer was: "${studentAnswer}"\n\nPlease help them understand why their answer is wrong and guide them toward the correct solution. Be encouraging and supportive.`,
    )
  }

  useEffect(() => {
    const handler = (e: Event) => incorrectAnswerRef.current(e)
    window.addEventListener('exercise-incorrect-answer', handler)
    return () => window.removeEventListener('exercise-incorrect-answer', handler)
  }, [])

  // Ask page: attach uploaded exercise images to the chat's pending media
  const askMediaAttachRef = useRef<(e: Event) => void>(() => {})
  askMediaAttachRef.current = (e: Event) => {
    const { mediaId, filename } = (e as CustomEvent).detail as {
      mediaId: string
      filename: string
    }
    addExternalMedia(mediaId, filename)
  }

  useEffect(() => {
    const handler = (e: Event) => askMediaAttachRef.current(e)
    window.addEventListener('ask-media-attach', handler)
    return () => window.removeEventListener('ask-media-attach', handler)
  }, [])

  // Ask page actions (hint, solution, check solution from canvas)
  const askActionRef = useRef<(e: Event) => void>(() => {})
  askActionRef.current = (e: Event) => {
    const { type, title, imageData, mediaId } = (e as CustomEvent).detail as {
      type: 'hint' | 'solution' | 'check'
      title: string
      imageData?: string
      mediaId?: string
    }
    onChatInteraction?.()
    if (type === 'hint') {
      if (mediaId) {
        sendContextualHelpWithMediaId(
          `The student is working on "${title}" and needs a hint. Look at the uploaded exercise image carefully. Provide a helpful hint without giving away the answer. Be encouraging.`,
          mediaId,
        )
      } else {
        sendContextualHelp(
          `The student is working on "${title}" and needs a hint. Provide a helpful hint without giving away the answer. Be encouraging.`,
        )
      }
    } else if (type === 'solution') {
      if (mediaId) {
        sendContextualHelpWithMediaId(
          `The student is working on "${title}" and wants to see the solution approach. Look at the uploaded exercise image carefully. Guide them step by step through the solution.`,
          mediaId,
        )
      } else {
        sendContextualHelp(
          `The student is working on "${title}" and wants to see the solution approach. Guide them step by step through the solution.`,
        )
      }
    } else if (type === 'check' && imageData) {
      sendContextualHelpWithMedia(
        `The student drew a solution for "${title}" on the canvas. You are receiving two images: the first is the student's handwritten work from the canvas, and the second is the original exercise/question. Compare the student's work against the original question and tell them if their approach and answer look correct. Be encouraging and supportive.`,
        imageData,
        mediaId ? [mediaId] : undefined,
      )
    }
  }

  useEffect(() => {
    const handler = (e: Event) => askActionRef.current(e)
    window.addEventListener('ask-action', handler)
    return () => window.removeEventListener('ask-action', handler)
  }, [])

  // Exercise help system actions (hint/guiding/solution from HelpSystem component)
  const exerciseHelpRef = useRef<(e: Event) => void>(() => {})
  exerciseHelpRef.current = (e: Event) => {
    const { type, questionContent, backendContent } = (e as CustomEvent).detail as {
      type: 'hint' | 'guiding' | 'solution'
      questionContent?: string
      backendContent?: string
      exerciseId?: string
      lessonId?: string
    }
    onChatInteraction?.()

    if (backendContent) {
      // Backend has content — show it directly without AI call (persisted for refresh)
      addAssistantMessage(backendContent)
    } else if (type === 'hint') {
      sendVisibleHelp(
        `The student needs a hint for this exercise question: "${questionContent}". Provide a short, helpful hint that nudges them in the right direction without giving away the answer.`,
      )
    } else if (type === 'guiding') {
      sendVisibleHelp(
        `The student needs a guiding question for this exercise question: "${questionContent}". Ask them a thought-provoking guiding question that helps them think about the problem without giving the answer.`,
      )
    } else if (type === 'solution') {
      sendVisibleHelp(
        `The student is requesting the full solution for this exercise question: "${questionContent}". Provide a clear, step-by-step solution.`,
      )
    }
  }

  useEffect(() => {
    const handler = (e: Event) => exerciseHelpRef.current(e)
    window.addEventListener('exercise-help-action', handler)
    return () => window.removeEventListener('exercise-help-action', handler)
  }, [])

  // Inject exercise context when student navigates to an exercise
  useEffect(() => {
    if (currentExercise && injectExerciseContext) {
      injectExerciseContext(currentExercise, mediaMap)
    }
  }, [currentExercise, injectExerciseContext, mediaMap])

  const [formulaComposerOpen, setFormulaComposerOpen] = useState(false)
  const [isChatInputFocused, setIsChatInputFocused] = useState(false)
  const [formulaSheetOpen, setFormulaSheetOpen] = useState(false)
  const [formulaSheetData, setFormulaSheetData] = useState<FormulaSheetData | null>(null)

  const handleFormulaInsert = useCallback(
    (latex: string) => {
      const el = inputRef.current
      const start = el?.selectionStart ?? inputValue.length
      const end = el?.selectionEnd ?? inputValue.length
      const before = inputValue.substring(0, start)
      const after = inputValue.substring(end)
      setInputValue(before + `$${latex}$` + after)
      setFormulaComposerOpen(false)
      setIsChatInputFocused(false)
    },
    [inputValue, setInputValue, inputRef],
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const switchChatToEditMode = useCallback(() => {
    setIsChatInputFocused(true)
    const el = inputRef.current
    if (el) {
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
  }, [inputRef])

  const handleChatInputBlur = useCallback((e: React.FocusEvent) => {
    const related = e.relatedTarget as HTMLElement | null
    if (related?.closest('[data-math-controls]')) return
    setIsChatInputFocused(false)
  }, [])

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (showMathTools) {
      setFormulaComposerOpen(false)
    }

    setIsChatInputFocused(false)

    if (onChatInteraction) {
      onChatInteraction()
    }

    handleSubmit(e)
  }

  const showChatViewOverlay = showMathTools && !isChatInputFocused && inputValue.includes('$')

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header with optional reset button and teacher profile badge */}
      {showResetButton && (
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm text-foreground">{tCourses('chatTitle')}</h3>
            {teacherProfileLabel && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                {teacherProfileLabel}
              </span>
            )}
          </div>
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
            <Loader2 className="w-4 h-4 animate-spin me-2" />
            {tCourses('chatLoadingHistory')}
          </div>
        )}
        {!isLoadingHistory &&
          messages.map((msg) => {
            const isAssistant = msg.role !== ChatMessageRole.User
            const messageId = msg.id
            const isCurrentlyPlaying = playingMessageId === messageId

            return (
              <div
                key={msg.id}
                className={cn(
                  'max-w-[85%] px-[18px] py-3.5 text-base leading-relaxed shadow-sm',
                  msg.role === ChatMessageRole.User
                    ? 'ms-auto bg-primary text-primary-foreground rounded-[20px] rounded-bl-[4px]'
                    : 'me-auto bg-card text-foreground border border-border rounded-[20px] rounded-br-[4px]',
                  isCurrentlyPlaying && 'ring-2 ring-primary/30',
                )}
              >
                {msg.media && msg.media.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {msg.media.map((mediaItem) => (
                      <div
                        key={mediaItem.mediaId}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs',
                          msg.role === ChatMessageRole.User
                            ? 'bg-primary-foreground/20'
                            : 'bg-muted',
                        )}
                      >
                        <ImageIcon className="w-3 h-3" />
                        <span className="max-w-[120px] truncate">
                          {mediaItem.filename || mediaItem.mediaId}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {msg.chatAssets && msg.chatAssets.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {msg.chatAssets.map((asset) => (
                      <div
                        key={asset.chatAssetId}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs',
                          msg.role === ChatMessageRole.User
                            ? 'bg-primary-foreground/20'
                            : 'bg-muted',
                        )}
                      >
                        <FileUp className="w-3 h-3" />
                        <span className="max-w-[120px] truncate">
                          {asset.filename || asset.chatAssetId}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <ChatMessageContent content={msg.content} />
                {isAssistant && (
                  <TTSButton
                    isPlaying={isCurrentlyPlaying}
                    onToggle={() => speak(messageId, msg.content)}
                    labelPlay={tCourses('chatReadAloud')}
                    labelStop={tCourses('chatStopReading')}
                  />
                )}
              </div>
            )
          })}
        {isLoading && (
          <div className="me-auto bg-card text-foreground border border-border px-[18px] py-3.5 rounded-[20px] rounded-br-[4px] max-w-[85%] flex items-center gap-2 shadow-sm">
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

      {/* Chat Error Surface */}
      {chatError && (
        <div className="flex-grow-0 flex-shrink-0 px-5 pt-3">
          <ChatErrorSurface
            type={chatError.type}
            message={chatError.message}
            onDismiss={dismissError}
          />
        </div>
      )}

      {/* Formula Sheet Toolbar */}
      {lessonId && (
        <div className="flex-grow-0 flex-shrink-0 px-5 pt-3">
          <FormulaSheetButton
            lessonId={lessonId}
            onOpen={(data) => {
              setFormulaSheetData(data)
              setFormulaSheetOpen(true)
            }}
          />
        </div>
      )}

      {/* Input Container */}
      <div
        className="flex-grow-0 flex-shrink-0 bg-card border-t border-border p-5 pb-8 relative"
        data-math-controls
      >
        {/* Formula Composer Popup */}
        {showMathTools && formulaComposerOpen && (
          <div className="mb-2.5 max-w-[850px] mx-auto">
            <FormulaComposer
              onInsert={handleFormulaInsert}
              onClose={() => setFormulaComposerOpen(false)}
            />
          </div>
        )}

        {/* Mobile Toggle */}
        {isMobile && viewMode && onModeToggle && (
          <div className="flex mb-2.5 px-1.5 justify-end max-w-[850px] mx-auto">
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
          </div>
        )}

        {/* Direct Upload Previews */}
        {directUploads.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2.5 max-w-[850px] mx-auto">
            {directUploads.map((file) => (
              <div
                key={file.localId}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm border',
                  file.status === 'complete' &&
                    'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950',
                  file.status === 'failed' &&
                    'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950',
                  file.status === 'uploading' && 'border-border bg-muted',
                  file.status === 'finalizing' && 'border-border bg-muted',
                  file.status === 'cancelled' && 'border-muted bg-muted/50',
                  file.status === 'queued' && 'border-border bg-muted',
                )}
              >
                {file.file.type.startsWith('image/') ? (
                  <ImageIcon
                    className={cn(
                      'w-4 h-4',
                      file.status === 'failed' ? 'text-red-500' : 'text-muted-foreground',
                    )}
                  />
                ) : (
                  <FileUp
                    className={cn(
                      'w-4 h-4',
                      file.status === 'failed' ? 'text-red-500' : 'text-muted-foreground',
                    )}
                  />
                )}
                <span className="max-w-[120px] truncate text-foreground">{file.file.name}</span>
                {file.status === 'uploading' && (
                  <span className="text-xs text-muted-foreground">{file.progress}%</span>
                )}
                {file.status === 'complete' && (
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                )}
                {file.status === 'failed' && <span className="text-xs text-red-500">Failed</span>}
                <button
                  type="button"
                  onClick={() => removeDirectUpload(file.localId)}
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
          <div className="max-w-[850px] mx-auto bg-muted rounded-[30px] flex items-center px-4 py-1.5 border border-input gap-3 relative">
            {/* Input — always mounted */}
            <input
              ref={inputRef}
              type="text"
              className="flex-1 bg-transparent border-none outline-none py-2.5 text-[17px] text-foreground placeholder:text-muted-foreground"
              placeholder={t('chatInputPlaceholder')}
              value={inputValue}
              onChange={handleInputChange}
              onFocus={() => setIsChatInputFocused(true)}
              onBlur={handleChatInputBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleFormSubmit(e as unknown as React.FormEvent)
                }
              }}
              disabled={isLoading}
            />

            {/* View overlay: rendered math on top of input when blurred */}
            {showChatViewOverlay && (
              <div
                onClick={switchChatToEditMode}
                className="absolute inset-y-0 start-4 end-[120px] flex items-center bg-muted cursor-text overflow-hidden"
              >
                <MathMarkdown
                  content={inputValue}
                  className="text-[17px] leading-relaxed truncate"
                />
              </div>
            )}

            {/* Formula button — inside the pill */}
            {showMathTools && (
              <button
                type="button"
                onClick={() => setFormulaComposerOpen(!formulaComposerOpen)}
                className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                title={tCourses('insertFormula')}
              >
                <FunctionSquare className="w-5 h-5" />
              </button>
            )}

            {/* File Upload */}
            <button
              type="button"
              className={cn(
                'p-1.5 text-muted-foreground hover:text-primary transition-colors',
                isDirectUploading && 'opacity-50 cursor-not-allowed',
              )}
              onClick={openFilePicker}
              disabled={
                isDirectUploading ||
                directUploads.filter((f) => f.status !== 'cancelled' && f.status !== 'failed')
                  .length >= 5
              }
              aria-label={tCourses('chatAttachFile')}
            >
              {isDirectUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              multiple
              onChange={(e) => {
                if (e.target.files) addDirectUploads(e.target.files)
                e.target.value = ''
              }}
            />

            {/* Send Button */}
            <button
              type="submit"
              className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-input hover:bg-primary/90 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                isLoading ||
                isDirectUploading ||
                (!inputValue.trim() && completedChatAssetIds.length === 0)
              }
              aria-label={tCourses('sendMessage')}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>

      {/* Formula Sheet Viewer */}
      <FormulaSheetViewer
        sheet={formulaSheetData}
        isOpen={formulaSheetOpen}
        onClose={() => setFormulaSheetOpen(false)}
      />
    </div>
  )
}
