import { ChatRole } from '@/lib/ai/chat-message-role'
import { apiService } from '@/services/api/api-service'
import { logger } from '@/utilities/logger'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAnalytics } from '@/lib/analytics/providers/AnalyticsProvider'
import { PRODUCT_EVENTS } from '@/lib/analytics/contracts/events'

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
  chapterId?: string
  courseId?: string
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
  chapterId,
  courseId,
}: UseNotebookChatProps) {
  const analytics = useAnalytics()
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: ChatRole.Assistant, content: initialMessage },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)

  // Compute contextKey based on available context (priority: Exercise > Lesson > Chapter > Course)
  const contextKey = useMemo(() => {
    if (exerciseId) return `exercises:${exerciseId}`
    if (lessonId) return `lessons:${lessonId}`
    if (chapterId) return `chapters:${chapterId}`
    if (courseId) return `courses:${courseId}`
    return null
  }, [exerciseId, lessonId, chapterId, courseId])

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
      if (!contextKey) {
        setIsLoadingHistory(false)
        return
      }

      try {
        const result = await apiService.getConversation(contextKey)

        if (result.authRequired) {
          // Keep initial message, user needs to log in
          setIsLoadingHistory(false)
          return
        }

        if (result.success && result.exists) {
          if (result.messages && result.messages.length > 0) {
            // Map API messages to chat messages
            const loadedMessages: ChatMessage[] = result.messages.map((msg) => ({
              role:
                msg.role === ChatRole.User || msg.role === 'user'
                  ? ChatRole.User
                  : ChatRole.Assistant,
              content: msg.content,
            }))

            // Only update messages if we have valid messages to avoid clearing the chat
            if (loadedMessages.length > 0) {
              setMessages(loadedMessages)
            } else {
              logger.warn(
                {
                  conversationId: result.conversationId,
                  contextKey,
                  rawMessages: result.messages,
                },
                '[useNotebookChat] Conversation exists but loaded messages are empty',
              )
            }
          } else {
            // Conversation exists but has no messages yet - keep initial welcome message
            logger.warn(
              {
                conversationId: result.conversationId,
                contextKey,
              },
              '[useNotebookChat] Conversation exists but has no messages',
            )
          }
        } else if (result.success && !result.exists) {
          // No conversation exists yet - keep initial welcome message
          // This is expected for new conversations
          logger.debug({ contextKey }, '[useNotebookChat] No conversation found for contextKey')
        } else {
          // API call failed
          logger.error(
            {
              error: result.error,
              contextKey,
              success: result.success,
              exists: result.exists,
            },
            '[useNotebookChat] Failed to load conversation',
          )
        }
      } catch (error) {
        // Fail silently - keep initial message
        logger.error(
          { err: error, contextKey },
          '[useNotebookChat] Failed to load conversation history',
        )
      } finally {
        setIsLoadingHistory(false)
      }
    }

    loadConversationHistory()
  }, [contextKey])

  const sendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return

    const userMessage: ChatMessage = { role: ChatRole.User, content: message }
    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // Track chat message sent (message length only, NOT content)
    analytics.track(PRODUCT_EVENTS.CHAT_MESSAGE_SENT, {
      conversation_id: contextKey || 'unknown',
      message_length: message.length,
      lesson_id: lessonId,
    })

    try {
      const result = await apiService.chat(message, acknowledgment, {
        exerciseId,
        lessonId,
        chapterId,
        courseId,
      })

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

  const handleReset = useCallback(async () => {
    if (!contextKey || isLoading) return

    const confirmed = confirm(
      'Are you sure you want to reset the conversation? This will start a new chat.',
    )
    if (!confirmed) return

    try {
      const result = await apiService.resetChat(contextKey)

      if (result.success) {
        // Clear messages and show welcome
        setMessages([{ role: ChatRole.Assistant, content: initialMessage }])
        toast.success('Conversation reset')
      } else {
        toast.error(result.error || 'Failed to reset conversation')
      }
    } catch (_error) {
      toast.error('Failed to reset conversation')
    }
  }, [contextKey, isLoading, initialMessage])

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
    contextKey,
    setInputValue,
    handleSubmit,
    handleKeyDown,
    handleQuickAction,
    handleReset,
  }
}
