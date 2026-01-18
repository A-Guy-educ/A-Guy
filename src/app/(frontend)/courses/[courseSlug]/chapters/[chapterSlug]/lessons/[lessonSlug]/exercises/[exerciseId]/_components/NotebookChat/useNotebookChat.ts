import { ChatRole } from '@/lib/ai/chat-message-role'
import { apiService } from '@/services/api/api-service'
import { logger } from '@/utilities/logger'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

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
  resetConfirmMessage: string
  resetSuccessMessage: string
  resetErrorMessage: string
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
  resetConfirmMessage,
  resetSuccessMessage,
  resetErrorMessage,
  acknowledgment,
  exerciseId,
  lessonId,
  chapterId,
  courseId,
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

      // Ensure loading indicator shows for minimum duration to avoid race conditions
      const minLoadingTime = Promise.all([new Promise((resolve) => setTimeout(resolve, 100))])

      try {
        const retryDelayMs = 500
        const maxRetries = 10
        let attempt = 0
        let result = (
          await Promise.all([apiService.getConversation(contextKey), minLoadingTime])
        )[0]

        while (attempt <= maxRetries) {
          if (result.authRequired) {
            // Keep initial message, user needs to log in
            setIsLoadingHistory(false)
            return
          }

          if (result.success && result.exists) {
            // DEBUG: Log the raw result
            logger.debug(
              {
                contextKey,
                conversationId: result.conversationId,
                rawMessages: result.messages,
                rawMessagesLength: result.messages?.length,
                rawMessagesType: typeof result.messages,
                isArray: Array.isArray(result.messages),
              },
              '[useNotebookChat] API response received',
            )

            // Filter out invalid messages and map to chat messages
            const rawMessages = result.messages || []
            logger.debug(
              { contextKey, rawMessagesLength: rawMessages.length },
              '[useNotebookChat] Processing raw messages',
            )

            const validMessages = rawMessages.filter(
              (msg) => msg && msg.role && msg.content && typeof msg.content === 'string',
            )

            logger.debug(
              { contextKey, validMessagesLength: validMessages.length },
              '[useNotebookChat] Valid messages count',
            )

            if (validMessages.length > 0) {
              // Map API messages to chat messages
              const loadedMessages: ChatMessage[] = validMessages.map((msg) => ({
                role:
                  msg.role === ChatRole.User || msg.role === 'user'
                    ? ChatRole.User
                    : ChatRole.Assistant,
                content: String(msg.content),
              }))

              logger.debug(
                {
                  contextKey,
                  conversationId: result.conversationId,
                  messageCount: loadedMessages.length,
                  messagesPreview: loadedMessages
                    .slice(0, 2)
                    .map((m) => ({ role: m.role, content: m.content.substring(0, 30) })),
                },
                '[useNotebookChat] Loaded conversation history',
              )

              // Only update messages if we have valid messages to avoid clearing the chat
              if (loadedMessages.length > 0) {
                // Set messages and loading state together
                // React will batch these updates, but we need to ensure messages
                // are actually in the DOM before hiding the loading indicator
                setMessages(loadedMessages)
                // Wait for React to render using double rAF pattern
                // First rAF: schedules callback before next paint
                // Second rAF: ensures the paint cycle completed
                // This ensures loading indicator hides only after messages are in DOM
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    setIsLoadingHistory(false)
                  })
                })
                return
              }
            }

            // Conversation exists but messages may still be persisting
            attempt += 1
            if (attempt > maxRetries) {
              logger.warn(
                {
                  conversationId: result.conversationId,
                  contextKey,
                  rawMessages: result.messages,
                  messageCount: result.messages?.length || 0,
                },
                '[useNotebookChat] Conversation exists but messages are empty after retries',
              )
              setIsLoadingHistory(false)
              return
            }

            // Exponential backoff for retries
            const delay = retryDelayMs * Math.min(attempt, 3)
            await new Promise((resolve) => setTimeout(resolve, delay))
            result = await apiService.getConversation(contextKey)
            continue
          }

          if (result.success && !result.exists) {
            // No conversation exists yet - keep initial welcome message
            logger.debug({ contextKey }, '[useNotebookChat] No conversation found for contextKey')
            setIsLoadingHistory(false)
            return
          }

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
          setIsLoadingHistory(false)
          return
        }
      } catch (error) {
        // Fail silently - keep initial message
        logger.error(
          { err: error, contextKey },
          '[useNotebookChat] Failed to load conversation history',
        )
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

    const confirmed = confirm(resetConfirmMessage)
    if (!confirmed) return

    try {
      const result = await apiService.resetChat(contextKey)

      if (result.success) {
        // Clear messages and show welcome
        setMessages([{ role: ChatRole.Assistant, content: initialMessage }])
        toast.success(resetSuccessMessage)
      } else {
        toast.error(result.error || resetErrorMessage)
      }
    } catch (_error) {
      toast.error(resetErrorMessage)
    }
  }, [
    contextKey,
    isLoading,
    initialMessage,
    resetConfirmMessage,
    resetErrorMessage,
    resetSuccessMessage,
  ])

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
