'use client'

import React, { useEffect, useRef, useLayoutEffect, useState } from 'react'
import { Lightbulb, CheckCircle, BookOpen, Loader2 } from 'lucide-react'
import { useTranslations } from '@/providers/I18n'
import { toast } from 'sonner'
import './index.scss'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function NotebookChat() {
  const t = useTranslations('courses')
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: t('chatWelcome') },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useLayoutEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom()
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const sendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return

    const userMessage: ChatMessage = { role: 'user', content: message }
    const updatedHistory = [...messages, userMessage]
    setMessages(updatedHistory)
    setInputValue('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/exercises/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response')
      }

      if (data.success && data.message) {
        const assistantMessage: ChatMessage = { role: 'assistant', content: data.message }
        setMessages((prev) => [...prev, assistantMessage])
      }
    } catch (error) {
      toast.error('Failed to send message. Please try again.')
      console.error('Chat error:', error)
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(inputValue)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }

  const handleQuickAction = (actionType: 'hint' | 'solution' | 'full') => {
    const prompts = {
      hint: 'Can you give me a hint for this problem?',
      solution: 'Can you show me the solution approach?',
      full: 'Can you provide the full solution with explanation?',
    }
    sendMessage(prompts[actionType])
  }

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
          <Lightbulb className="w-6 h-6 text-yellow-400" />
          <span>{t('chatHint')}</span>
        </button>
        <button
          className="notebook-chat__action"
          onClick={() => handleQuickAction('solution')}
          disabled={isLoading}
        >
          <CheckCircle className="w-6 h-6 text-green-500" />
          <span>{t('chatSolution')}</span>
        </button>
        <button
          className="notebook-chat__action"
          onClick={() => handleQuickAction('full')}
          disabled={isLoading}
        >
          <BookOpen className="w-6 h-6 text-blue-500" />
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
        >
          {t('chatSend')}
        </button>
      </form>
    </div>
  )
}
