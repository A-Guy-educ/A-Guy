/**
 * Admin Chat Page
 *
 * @fileType page
 * @domain admin
 * @pattern admin-page
 * @ai-summary Dedicated admin chat interface for querying content via MCP tools
 *
 * Access: Admins only (enforced by endpoint)
 */
'use client'

import { useCurrentUser } from '@/client/hooks/useCurrentUser'
import { ChatRole } from '@/infra/llm/chat-message-role'
import { apiService } from '@/server/services/api/api-service'
import React, { useEffect, useRef, useState } from 'react'

interface ChatMessage {
  role: ChatRole
  content: string
}

const WELCOME_MESSAGE =
  "Hi! I'm your admin AI assistant. Ask me about courses, chapters, lessons, exercises, or media in your system."

export default function AdminChatPage() {
  const { user, isLoading } = useCurrentUser()
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: ChatRole.Assistant, content: WELCOME_MESSAGE },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoadingMessage, setIsLoadingMessage] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoadingMessage) return

    const userMessage: ChatMessage = { role: ChatRole.User, content: inputValue.trim() }
    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoadingMessage(true)

    try {
      const result = await apiService.chat(
        inputValue.trim(),
        'Understood.',
        {},
        undefined,
        true, // adminMode - uses admin:user:{userId} context internally
      )

      const responseContent =
        result.message || result.error || 'An error occurred. Please try again.'
      setMessages((prev) => [...prev, { role: ChatRole.Assistant, content: responseContent }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: ChatRole.Assistant, content: 'An error occurred. Please try again.' },
      ])
    } finally {
      setIsLoadingMessage(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-4">
        <div className="error">Please log in to access admin chat</div>
      </div>
    )
  }

  return (
    <div
      className="p-4"
      style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}
    >
      {/* Messages */}
      <div
        className="messages"
        style={{ flex: 1, overflow: 'auto', padding: '1rem', marginBottom: '1rem' }}
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              maxWidth: '80%',
              padding: '12px 16px',
              marginBottom: '12px',
              borderRadius: '18px',
              backgroundColor:
                msg.role === ChatRole.User ? 'var(--color-primary)' : 'var(--theme-elevation-100)',
              color:
                msg.role === ChatRole.User
                  ? 'var(--color-primary-foreground)'
                  : 'var(--theme-elevation-1000)',
              marginLeft: msg.role === ChatRole.User ? 'auto' : '0',
              borderBottomRightRadius: msg.role === ChatRole.User ? '4px' : '18px',
              borderBottomLeftRadius: msg.role === ChatRole.Assistant ? '4px' : '18px',
            }}
          >
            {msg.content}
          </div>
        ))}
        {isLoadingMessage && (
          <div
            style={{
              maxWidth: '80%',
              padding: '12px 16px',
              borderRadius: '18px',
              backgroundColor: 'var(--theme-elevation-100)',
              color: 'var(--theme-elevation-1000)',
              marginBottom: '12px',
            }}
          >
            <span className="loading">Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask a question..."
          disabled={isLoadingMessage}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '20px',
            border: '1px solid var(--theme-elevation-200)',
            fontSize: '14px',
            backgroundColor: 'var(--theme-elevation-0)',
          }}
        />
        <button
          type="submit"
          disabled={isLoadingMessage || !inputValue.trim()}
          style={{
            padding: '12px 24px',
            borderRadius: '20px',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-primary-foreground)',
            border: 'none',
            cursor: isLoadingMessage || !inputValue.trim() ? 'not-allowed' : 'pointer',
            opacity: isLoadingMessage || !inputValue.trim() ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </form>
    </div>
  )
}
