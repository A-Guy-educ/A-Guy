'use client'

import React from 'react'
import { Lightbulb, CheckCircle, BookOpen, Loader2, Send } from 'lucide-react'
import { useTranslations } from '@/providers/I18n'
import { useNotebookChat } from './useNotebookChat'
import './index.scss'

export function NotebookChat() {
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
  })

  return (
    <div className="notebook-chat">
      <div ref={messagesContainerRef} className="notebook-chat__messages">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`notebook-chat__bubble ${msg.role === 'user' ? 'notebook-chat__bubble--user' : ''}`}
          >
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div className="notebook-chat__bubble notebook-chat__bubble--loading">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="notebook-chat__actions">
        <button
          className="notebook-chat__action"
          onClick={() => handleQuickAction('hint')}
          disabled={isLoading}
        >
          <Lightbulb className="text-yellow-400" />
          <span>{t('chatHint')}</span>
        </button>
        <button
          className="notebook-chat__action"
          onClick={() => handleQuickAction('solution')}
          disabled={isLoading}
        >
          <CheckCircle className="text-green-500" />
          <span>{t('chatSolution')}</span>
        </button>
        <button
          className="notebook-chat__action"
          onClick={() => handleQuickAction('full')}
          disabled={isLoading}
        >
          <BookOpen className="text-blue-500" />
          <span>{t('chatFullSolution')}</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="notebook-chat__footer">
        <input
          ref={inputRef}
          type="text"
          className="notebook-chat__input"
          placeholder={t('chatInputPlaceholder')}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="notebook-chat__send"
          disabled={isLoading || !inputValue.trim()}
          aria-label="Send message"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  )
}
