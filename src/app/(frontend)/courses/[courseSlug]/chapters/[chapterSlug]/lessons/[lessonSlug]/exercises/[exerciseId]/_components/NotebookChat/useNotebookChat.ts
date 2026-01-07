import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { toast } from 'sonner'
import { apiService } from '@/services/api/api-service'
import { ChatMessageRole } from '@/lib/ai/chat-message-role'

export interface ChatMessage {
  role: ChatMessageRole
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
}

export function useNotebookChat({
  initialMessage,
  authRequiredMessage,
  errorMessage,
  hintPrompt,
  solutionPrompt,
  fullSolutionPrompt,
  acknowledgment,
}: UseNotebookChatProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: ChatMessageRole.Model, content: initialMessage },
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

    const userMessage: ChatMessage = { role: ChatMessageRole.User, content: message }
    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      const result = await apiService.chat(message, acknowledgment)

      if (!result.success) {
        if (result.authRequired) {
          toast.error(authRequiredMessage)
        } else {
          toast.error(result.error || errorMessage)
        }
        return
      }

      if (result.message) {
        const modelMessage: ChatMessage = {
          role: ChatMessageRole.Model,
          content: result.message,
        }
        setMessages((prev) => [...prev, modelMessage])
      }
    } catch (error) {
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
    messagesContainerRef,
    messagesEndRef,
    inputRef,
    setInputValue,
    handleSubmit,
    handleKeyDown,
    handleQuickAction,
  }
}
