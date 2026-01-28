'use client'

import { ChatMessageRole } from '@/infra/llm/chat-message-role'
import { useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'
import { Loader2, Send } from 'lucide-react'
import React from 'react'
import { ChatMessageContent } from '../ChatMessageContent'
import { useNotebookChat } from '../hooks/useNotebookChat'

interface ChatInterfaceProps {
  courseId?: string
  lessonId?: string
  exerciseId?: string
  translationNamespace?: string
}

export function ChatInterface({
  courseId,
  lessonId,
  exerciseId,
  translationNamespace = 'homepage.ask',
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
    setInputValue,
    handleSubmit,
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
    lessonId,
    exerciseId,
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSubmit(e)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-grow overflow-y-auto p-5 space-y-4 min-h-0"
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

      {/* Input Container */}
      <div className="flex-grow-0 flex-shrink-0 bg-card border-t border-border p-5 pb-8">
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

            {/* Send Button */}
            <button
              type="submit"
              className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-input hover:bg-primary/90 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || !inputValue.trim()}
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
