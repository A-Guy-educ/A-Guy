'use client'

import { ChatRole } from '@/infra/llm/chat-message-role'
import { useTranslations } from '@/ui/providers/I18n'
import { cn } from '@/infra/utils/ui'
import { BookOpen, CheckCircle, Lightbulb, Loader2, RefreshCw, Send } from 'lucide-react'
import { ChatMessageContent } from '@/ui/web/chat'
import { useNotebookChat } from './useNotebookChat'

interface NotebookChatProps {
  exerciseId: string
  lessonId?: string
  chapterId?: string
  courseId?: string
}

export function NotebookChat({ exerciseId, lessonId, chapterId, courseId }: NotebookChatProps) {
  const t = useTranslations('courses')
  const {
    messages,
    inputValue,
    isLoading,
    isLoadingHistory,
    messagesContainerRef,
    messagesEndRef,
    inputRef,
    contextKey,
    setInputValue,
    handleSubmit,
    handleKeyDown,
    handleQuickAction,
    handleReset,
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
    chapterId,
    courseId,
  })

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header with reset button */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="font-medium text-sm text-foreground">{t('chatTitle')}</h3>
        {contextKey && (
          <button
            onClick={handleReset}
            disabled={isLoading}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title={t('chatReset')}
          >
            <RefreshCw className="w-3 h-3" />
            <span>{t('chatReset')}</span>
          </button>
        )}
      </div>

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
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
                'p-3 rounded-lg max-w-[85%]',
                msg.role === ChatRole.User
                  ? 'ml-auto bg-primary text-primary-foreground'
                  : 'mr-auto bg-muted text-foreground',
              )}
            >
              <ChatMessageContent content={msg.content} />
            </div>
          ))}
        {isLoading && (
          <div className="mr-auto bg-muted text-foreground p-3 rounded-lg max-w-[85%] flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{t('chatThinking')}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2 p-3 border-t border-border">
        <button
          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => handleQuickAction('hint')}
          disabled={isLoading}
        >
          <Lightbulb className="w-4 h-4 text-yellow-400" />
          <span>{t('chatHint')}</span>
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => handleQuickAction('solution')}
          disabled={isLoading}
        >
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span>{t('chatSolution')}</span>
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => handleQuickAction('full')}
          disabled={isLoading}
        >
          <BookOpen className="w-4 h-4 text-blue-500" />
          <span>{t('chatFullSolution')}</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-border">
        <input
          ref={inputRef}
          type="text"
          className="flex-1 px-4 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          placeholder={t('chatInputPlaceholder')}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading || !inputValue.trim()}
          aria-label={t('sendMessage')}
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  )
}
