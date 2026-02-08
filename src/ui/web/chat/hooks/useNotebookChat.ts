'use client'

import { ChatRole } from '@/infra/llm/chat-message-role'
import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'

import { logger } from '@/infra/utils/logger'
import { apiService } from '@/server/services/api/api-service'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useDirectChatAssetUpload } from './useDirectChatAssetUpload'

export interface ChatMessage {
  role: ChatRole
  content: string
  media?: Array<{ mediaId: string; filename?: string }>
  chatAssets?: Array<{ chatAssetId: string; filename?: string }>
}

export interface ChatError {
  type: 'auth' | 'general'
  message: string
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
  // Admin context - category for admin chat scope
  categoryId?: string
  // Admin mode - uses user-specific context without course/lesson context
  adminMode?: boolean
  userId?: string
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
  categoryId,
  adminMode = false,
  userId,
}: UseNotebookChatProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: ChatRole.Assistant, content: initialMessage },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)

  // Direct-to-Blob chat asset uploads
  const {
    uploadingFiles: directUploads,
    addFiles: addDirectUploads,
    cancelFile: cancelDirectUpload,
    retryFile: retryDirectUpload,
    removeFile: removeDirectUpload,
    isUploading: isDirectUploading,
    completedAssetIds: completedChatAssetIds,
  } = useDirectChatAssetUpload()

  // Error state
  const [chatError, setChatError] = useState<ChatError | null>(null)

  // Compute contextKey based on available context
  // For admin mode: use users:{userId} (user-scoped conversation)
  // Priority for regular mode: Exercise > Lesson > Chapter > Course > Category
  const contextKey = useMemo(() => {
    if (exerciseId) return `exercises:${exerciseId}`
    if (lessonId) return `lessons:${lessonId}`
    if (chapterId) return `chapters:${chapterId}`
    if (courseId) return `courses:${courseId}`
    if (categoryId) return `categories:${categoryId}`
    if (adminMode && userId) return `users:${userId}`
    return null
  }, [exerciseId, lessonId, chapterId, courseId, categoryId, adminMode, userId])

  // Simple scroll to bottom using scrollTop instead of scrollIntoView
  // scrollIntoView can cause layout issues in nested flex containers
  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [])

  // Scroll to bottom when messages change
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      scrollToBottom()
    })
  }, [messages, scrollToBottom])

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
                media: (msg as { media?: Array<{ mediaId: string; filename?: string }> }).media,
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

  // Trigger file picker
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const sendMessage = async (message: string) => {
    if ((!message.trim() && completedChatAssetIds.length === 0) || isLoading) return

    // Capture chat asset metadata before clearing
    const chatAssetMetadata = completedChatAssetIds.map((id) => ({ chatAssetId: id }))

    const userMessage: ChatMessage = {
      role: ChatRole.User,
      content: message,
      chatAssets: chatAssetMetadata.length > 0 ? chatAssetMetadata : undefined,
    }
    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // Track chat message submitted (message length only, NOT content)
    systemEventBus.emit(SYSTEM_EVENTS.CHAT_MESSAGE_SUBMITTED, {
      conversation_id: contextKey || 'unknown',
      message_type: 'user',
      message_length: message.length,
    })

    const context = {
      exerciseId,
      lessonId,
      chapterId,
      courseId,
      categoryId,
    }

    // Use streaming when no attachments and not in admin mode
    const hasAttachments = completedChatAssetIds.length > 0
    const useStreaming = !hasAttachments && !adminMode

    if (useStreaming) {
      await streamMessage(message, acknowledgment, context)
    } else {
      await sendMessageSync(message, acknowledgment, context, [], completedChatAssetIds)
    }
  }

  /**
   * Send message using streaming (SSE)
   */
  const streamMessage = async (
    message: string,
    acknowledgment: string,
    context: {
      exerciseId?: string
      lessonId?: string
      chapterId?: string
      courseId?: string
      categoryId?: string
    },
  ) => {
    try {
      const stream = apiService.chatStream(message, acknowledgment, context)

      // Create placeholder assistant message for streaming
      const placeholderMessage: ChatMessage = {
        role: ChatRole.Assistant,
        content: '',
      }
      setMessages((prev) => [...prev, placeholderMessage])

      let fullText = ''

      let hasAuthError = false

      for await (const event of stream) {
        if (event.type === 'chunk' && event.text) {
          fullText += event.text
          // Update the last message with streaming content
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = { ...placeholderMessage, content: fullText }
            return updated
          })
          scrollToBottom()
        } else if (event.type === 'done') {
          // done event received, conversation metadata available for future features
        } else if (event.type === 'error') {
          const errMsg = event.error || errorMessage
          // Check if this is an auth error (contains "auth" or "authentication")
          if (errMsg?.toLowerCase().includes('auth')) {
            hasAuthError = true
            setChatError({ type: 'auth' as const, message: authRequiredMessage })
          } else {
            toast.error(errMsg || errorMessage)
          }
          // Remove the empty/partial message on error
          setMessages((prev) => prev.slice(0, -1))
          break
        }
      }

      // If auth error occurred, skip finalizing the message
      if (hasAuthError) {
        return
      }

      // Finalize the message
      if (fullText) {
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...placeholderMessage, content: fullText }
          return updated
        })
      }
    } catch (_error) {
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  /**
   * Send message synchronously (with media or admin mode)
   */
  const sendMessageSync = async (
    message: string,
    acknowledgment: string,
    context: {
      exerciseId?: string
      lessonId?: string
      chapterId?: string
      courseId?: string
      categoryId?: string
    },
    mediaIds?: string[],
    chatAssetIds?: string[],
  ) => {
    try {
      const result = await apiService.chat(
        message,
        acknowledgment,
        context,
        mediaIds,
        chatAssetIds,
        adminMode,
      )

      if (!result.success) {
        if (result.authRequired) {
          setChatError({ type: 'auth', message: authRequiredMessage })
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

  const handleQuickAction = (actionType: 'hint' | 'solution' | 'full') => {
    const prompts = {
      hint: hintPrompt,
      solution: solutionPrompt,
      full: fullSolutionPrompt,
    }
    // Quick actions use synchronous chat for backward compatibility
    const prompt = prompts[actionType]
    const context = {
      exerciseId,
      lessonId,
      chapterId,
      courseId,
      categoryId,
    }
    sendMessageSync(prompt, acknowledgment, context)
  }

  const dismissError = useCallback(() => {
    setChatError(null)
  }, [])

  return {
    messages,
    inputValue,
    isLoading,
    isLoadingHistory,
    messagesContainerRef,
    messagesEndRef,
    inputRef,
    fileInputRef,
    contextKey,
    setInputValue,
    handleSubmit,
    handleQuickAction,
    handleReset,
    openFilePicker,
    // Direct-to-Blob chat asset uploads
    directUploads,
    addDirectUploads,
    cancelDirectUpload,
    retryDirectUpload,
    removeDirectUpload,
    isDirectUploading,
    completedChatAssetIds,
    // Error handling
    chatError,
    dismissError,
  }
}
