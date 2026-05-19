'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

export interface LearningAgentMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface UseLearningAgentChatOptions {
  gradeLevel: string
  initialMessage?: string
  onConversationCreated?: (conversationId: string) => void
}

interface UseLearningAgentChatReturn {
  messages: LearningAgentMessage[]
  inputValue: string
  isLoading: boolean
  isOpen: boolean
  conversationId: string | null
  setInputValue: (value: string) => void
  sendMessage: (message: string) => Promise<void>
  setIsOpen: (open: boolean) => void
  resetChat: () => void
}

/**
 * Hook for managing learning agent chat state and API calls
 */
export function useLearningAgentChat({
  gradeLevel,
  initialMessage = "Hi! I'm your personal learning assistant. How can I help you today?",
  onConversationCreated,
}: UseLearningAgentChatOptions): UseLearningAgentChatReturn {
  const [messages, setMessages] = useState<LearningAgentMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: initialMessage,
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || isLoading) return

      const userMessage: LearningAgentMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message.trim(),
      }

      setMessages((prev) => [...prev, userMessage])
      setInputValue('')
      setIsLoading(true)

      try {
        const response = await fetch('/api/agent/learning-chat', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage.content,
            acknowledgment: 'Understood',
            conversationId,
            gradeLevel,
          }),
        })

        if (!response.ok) {
          if (response.status === 401) {
            toast.error('Please log in to use the learning assistant')
            return
          }
          throw new Error('Failed to send message')
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let fullText = ''
        let assistantMessageId = crypto.randomUUID()

        // Add placeholder assistant message
        setMessages((prev) => [...prev, { id: assistantMessageId, role: 'assistant', content: '' }])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.type === 'chunk' && data.text) {
                  fullText += data.text
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId ? { ...msg, content: fullText } : msg,
                    ),
                  )
                } else if (data.type === 'done') {
                  if (data.conversationId) {
                    setConversationId(data.conversationId)
                    onConversationCreated?.(data.conversationId)
                  }
                } else if (data.type === 'error') {
                  throw new Error(data.error || 'Chat error')
                }
              } catch {
                // Ignore parse errors for incomplete JSON
              }
            }
          }
        }
      } catch (error) {
        console.error('Chat error:', error)
        toast.error('Failed to send message. Please try again.')

        // Remove the user message on error
        setMessages((prev) => prev.slice(0, -1))
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, conversationId, gradeLevel, onConversationCreated],
  )

  const resetChat = useCallback(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: initialMessage,
      },
    ])
    setConversationId(null)
  }, [initialMessage])

  return {
    messages,
    inputValue,
    isLoading,
    isOpen,
    conversationId,
    setInputValue,
    sendMessage,
    setIsOpen,
    resetChat,
  }
}
