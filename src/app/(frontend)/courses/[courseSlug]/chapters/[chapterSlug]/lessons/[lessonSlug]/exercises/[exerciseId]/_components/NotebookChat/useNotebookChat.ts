import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { toast } from 'sonner'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface UseNotebookChatProps {
  initialMessage: string
}

export function useNotebookChat({ initialMessage }: UseNotebookChatProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: initialMessage },
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
          conversationHistory: updatedHistory,
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

  return {
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
  }
}
