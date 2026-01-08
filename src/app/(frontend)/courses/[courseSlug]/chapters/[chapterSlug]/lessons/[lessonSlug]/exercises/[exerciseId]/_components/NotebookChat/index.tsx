'use client'

import React from 'react'
import { Lightbulb, CheckCircle, BookOpen, Loader2, Send } from 'lucide-react'
import { useTranslations } from '@/providers/I18n'
import { useNotebookChat } from './useNotebookChat'
import { ChatMessageRole } from '@/lib/ai/chat-message-role'
import { cn } from '@/utilities/ui'

interface NotebookChatProps {
  exerciseId: string
}

export function NotebookChat({ exerciseId }: NotebookChatProps) {
  const t = useTranslations('courses')
  const {
    messages,
    inputValue,
    isLoading,
    messagesContainerRef,
    messagesEndRef,
    inputRef,
    setInputValue,
    handleSubmit,
    handleKeyDown,
    handleQuickAction,
  } = useNotebookChat({
    initialMessage: t('chatWelcome'),
    authRequiredMessage: t('chatAuthRequired'),
    errorMessage: t('chatError'),
    hintPrompt: t('chatHintPrompt'),
    solutionPrompt: t('chatSolutionPrompt'),
    fullSolutionPrompt: t('chatFullSolutionPrompt'),
    acknowledgment: t('chatAIAcknowledgment'),
    exerciseId,
  })

  return (
    <div className="h-full flex flex-col bg-card">
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={cn(
              'p-3 rounded-lg max-w-[85%]',
              msg.role === ChatMessageRole.User
                ? 'ml-auto bg-primary text-primary-foreground'
                : 'mr-auto bg-muted text-foreground',
            )}
          >
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div className="mr-auto bg-muted text-foreground p-3 rounded-lg max-w-[85%] flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Thinking...</span>
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
          aria-label="Send message"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  )
}
