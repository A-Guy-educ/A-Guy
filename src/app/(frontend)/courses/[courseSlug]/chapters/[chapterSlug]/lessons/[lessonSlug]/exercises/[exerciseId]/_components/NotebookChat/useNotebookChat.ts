import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { toast } from 'sonner'
import { apiService } from '@/services/api/api-service'
import { ChatRole } from '@/lib/ai/chat-message-role'

export interface ChatMessage {
  role: ChatRole
  content: string
}

interface UseNotebookChatProps {
  initialMessage: string
  authRequiredMessage: string
  errorMessage: string
  hintPrompt: string
  solutionPrompt: string
  fullSolutionPrompt: string
  acknowledgment: string
  exerciseId?: string
  lessonId?: string
}

export function useNotebookChat({
  initialMessage,
  authRequiredMessage,
  errorMessage,
  hintPrompt,
  solutionPrompt,
  fullSolutionPrompt,
  acknowledgment,
  exerciseId,
  lessonId,
}: UseNotebookChatProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: ChatRole.Assistant, content: initialMessage },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)

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

  // Load existing conversation history on mount
  useEffect(() => {
    async function loadConversationHistory() {
      try {
        const result = await apiService.getConversation(exerciseId, lessonId)

        if (result.success && result.exists && result.messages.length > 0) {
          // Map API messages to chat messages
          const loadedMessages: ChatMessage[] = result.messages.map((msg) => ({
            role: msg.role === 'user' ? ChatRole.User : ChatRole.Assistant,
            content: msg.content,
          }))
          setMessages(loadedMessages)
        }
        // If no conversation exists, keep the initial welcome message
      } catch (error) {
        // Fail silently - keep initial message
        console.error('Failed to load conversation history:', error)
      } finally {
        setIsLoadingHistory(false)
      }
    }

    loadConversationHistory()
  }, [exerciseId, lessonId, initialMessage])

  const sendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return

    const userMessage: ChatMessage = { role: ChatRole.User, content: message }
    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      const result = await apiService.chat(message, acknowledgment, exerciseId, lessonId)

      if (!result.success) {
        if (result.authRequired) {
          toast.error(authRequiredMessage)
        } else {
          toast.error(result.error || errorMessage)
        }
        return
      }

      if (result.message) {
        const assistantMessage: ChatMessage = {
          role: ChatRole.Assistant,
          content: result.message,
        }
        setMessages((prev) => [...prev, assistantMessage])
      }
    } catch (_error) {
      toast.error(errorMessage)
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
      hint: hintPrompt,
      solution: solutionPrompt,
      full: fullSolutionPrompt,
    }
    sendMessage(prompts[actionType])
  }

  return {
    messages,
    inputValue,
    isLoading,
    isLoadingHistory,
    messagesContainerRef,
    messagesEndRef,
    inputRef,
    setInputValue,
    handleSubmit,
    handleKeyDown,
    handleQuickAction,
  }
}
