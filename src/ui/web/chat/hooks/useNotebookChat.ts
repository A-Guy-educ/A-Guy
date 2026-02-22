'use client'

import { ChatRole } from '@/infra/llm/chat-message-role'
import { formatExerciseContextMessage } from '@/infra/llm/exercise-context'
import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'

import { logger } from '@/infra/utils/logger'
import { apiService } from '@/server/services/api/api-service'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

export interface ChatMessage {
  role: ChatRole
  content: string
  media?: Array<{ mediaId: string; filename?: string }>
}

export interface UploadedMedia {
  id: string
  filename: string
  mimeType: string
}

export interface ChatError {
  type: 'auth' | 'limit' | 'general'
  message: string
}

// Media upload constraints
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_FILES = 5

interface UseNotebookChatProps {
  initialMessage: string
  authRequiredMessage: string
  errorMessage: string
  guestLimitMessage?: string
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
  // Media upload messages
  unsupportedFileTypeMessage?: string
  fileTooLargeMessage?: string
  maxFilesMessage?: string
  uploadFailedMessage?: string
}

export function useNotebookChat({
  initialMessage,
  authRequiredMessage,
  errorMessage,
  guestLimitMessage,
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
  unsupportedFileTypeMessage = 'Unsupported file type',
  fileTooLargeMessage = 'File too large (max 10MB)',
  maxFilesMessage = 'Maximum 5 files allowed',
  uploadFailedMessage = 'Failed to upload file',
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

  // Media upload state
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([])
  const [isUploading, setIsUploading] = useState(false)

  // Persistent media for Ask page — sent with every message, not cleared after send
  const [askMedia, setAskMedia] = useState<UploadedMedia | null>(null)

  // Error state
  const [chatError, setChatError] = useState<ChatError | null>(null)

  // Guest mode state
  const [_isGuestMode, setIsGuestMode] = useState(false)

  // Track last injected exercise ID to avoid duplicate context injection
  const lastInjectedExerciseId = useRef<string | null>(null)

  // Compute contextKey based on available context
  // For admin mode: use users:{userId} (user-scoped conversation)
  // Priority for regular mode: Lesson > Exercise (fallback) > Chapter > Course > Category
  // Exercises within the same lesson share a single conversation
  const contextKey = useMemo(() => {
    if (lessonId) return `lessons:${lessonId}`
    if (exerciseId) return `exercises:${exerciseId}`
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
            // Track guest mode status
            if (result.isGuestMode) {
              setIsGuestMode(true)
            }
            setIsLoadingHistory(false)
            return
          }

          // Track guest mode from successful response
          if (result.isGuestMode) {
            setIsGuestMode(true)
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

  // Handle file selection for media upload
  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return

      // Check max files limit
      if (uploadedMedia.length + files.length > MAX_FILES) {
        toast.error(maxFilesMessage)
        return
      }

      setIsUploading(true)

      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        // Validate file type
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
          toast.error(`${file.name}: ${unsupportedFileTypeMessage}`)
          continue
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name}: ${fileTooLargeMessage}`)
          continue
        }

        try {
          const formData = new FormData()
          formData.append('file', file)

          const response = await fetch('/api/media', {
            method: 'POST',
            credentials: 'include',
            body: formData,
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.message || errorData.error || 'Upload failed')
          }

          const doc = await response.json()
          setUploadedMedia((prev) => [
            ...prev,
            {
              id: doc.doc?.id || doc.id,
              filename: doc.doc?.filename || doc.filename || file.name,
              mimeType: file.type,
            },
          ])
        } catch (error) {
          logger.error({ err: error, filename: file.name }, 'Media upload failed')
          toast.error(`${file.name}: ${uploadFailedMessage}`)
        }
      }

      setIsUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [
      uploadedMedia.length,
      maxFilesMessage,
      unsupportedFileTypeMessage,
      fileTooLargeMessage,
      uploadFailedMessage,
    ],
  )

  // Remove uploaded media
  const removeMedia = useCallback((mediaId: string) => {
    setUploadedMedia((prev) => prev.filter((m) => m.id !== mediaId))
  }, [])

  // Trigger file picker
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const sendMessage = async (message: string) => {
    if ((!message.trim() && uploadedMedia.length === 0 && !askMedia) || isLoading) return

    // Combine regular pending media + persistent ask media
    const mediaIds = uploadedMedia.map((m) => m.id)
    if (askMedia && !mediaIds.includes(askMedia.id)) {
      mediaIds.push(askMedia.id)
    }
    const mediaMetadata = [
      ...uploadedMedia.map((m) => ({ mediaId: m.id, filename: m.filename })),
      ...(askMedia && !uploadedMedia.some((m) => m.id === askMedia.id)
        ? [{ mediaId: askMedia.id, filename: askMedia.filename }]
        : []),
    ]

    const userMessage: ChatMessage = {
      role: ChatRole.User,
      content: message,
      media: mediaMetadata.length > 0 ? mediaMetadata : undefined,
    }
    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // Clear regular pending media but NOT persistent askMedia
    setUploadedMedia([])

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

    // Use streaming when no media attached and not in admin mode
    const useStreaming = mediaIds.length === 0 && !adminMode

    if (useStreaming) {
      await streamMessage(message, acknowledgment, context)
    } else {
      await sendMessageSync(message, acknowledgment, context, mediaIds)
    }
  }

  /**
   * Send message using streaming (SSE)
   */
  const streamMessage = useCallback(
    async (
      message: string,
      acknowledgment: string,
      context: {
        exerciseId?: string
        lessonId?: string
        chapterId?: string
        courseId?: string
        categoryId?: string
      },
      options?: { hidden?: boolean },
    ) => {
      try {
        const stream = apiService.chatStream(message, acknowledgment, context, options)

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
            } else if (errMsg?.toLowerCase().includes('guest message limit')) {
              setChatError({
                type: 'limit' as const,
                message:
                  guestLimitMessage || 'Guest message limit reached. Sign up for unlimited access.',
              })
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
      } catch (error) {
        console.error('Stream message failed:', error)
        toast.error(errorMessage)
      } finally {
        setIsLoading(false)
        inputRef.current?.focus()
      }
    },
    [errorMessage, authRequiredMessage, guestLimitMessage, scrollToBottom],
  )

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
  ) => {
    try {
      const result = await apiService.chat(message, acknowledgment, context, mediaIds, adminMode)

      if (!result.success) {
        if (result.authRequired) {
          setChatError({ type: 'auth' as const, message: authRequiredMessage })
        } else if (result.guestLimitReached) {
          setChatError({
            type: 'limit' as const,
            message:
              guestLimitMessage || 'Guest message limit reached. Sign up for unlimited access.',
          })
        } else {
          toast.error(result.error || errorMessage)
        }
        return
      }

      // Track guest mode
      if (result.isGuestMode) {
        setIsGuestMode(true)
      }

      if (result.message) {
        const assistantMessage: ChatMessage = {
          role: ChatRole.Assistant,
          content: result.message,
        }
        setMessages((prev) => [...prev, assistantMessage])
      }
    } catch (error) {
      console.error('Send message sync failed:', error)
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
        // Track guest mode
        if (result.isGuestMode) {
          setIsGuestMode(true)
        }
      } else {
        toast.error(result.error || resetErrorMessage)
      }
    } catch (error) {
      console.error('Chat reset failed:', error)
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

  const addAssistantMessage = useCallback((content: string) => {
    setMessages((prev) => [...prev, { role: ChatRole.Assistant, content }])
  }, [])

  /**
   * Inject exercise context as a hidden message when student navigates to an exercise.
   * The context is persisted for LLM context but excluded from client responses.
   * Deduplicates: skips injection if same exerciseId was already injected.
   */
  const injectExerciseContext = useCallback(
    async (
      exercise: {
        id: string
        title: string
        content: {
          blocks: Array<{
            id: string
            type: string
            [key: string]: unknown
          }>
        }
      },
      mediaMap?: Record<
        string,
        {
          id: string
          url?: string | null
          filename?: string
          mimeType?: string
          altText?: string
        }
      >,
    ) => {
      if (isLoading || isLoadingHistory) return
      if (lastInjectedExerciseId.current === exercise.id) return

      lastInjectedExerciseId.current = exercise.id

      const formatted = formatExerciseContextMessage(
        exercise.title,
        exercise.content.blocks,
        mediaMap,
      )
      const prompt = `The student is now viewing the following exercise. Use this context to help them if they ask questions.\n\n${formatted}`

      const context = { exerciseId, lessonId, chapterId, courseId, categoryId }
      await streamMessage(prompt, acknowledgment, context, { hidden: true })
    },
    [
      isLoading,
      isLoadingHistory,
      streamMessage,
      acknowledgment,
      exerciseId,
      lessonId,
      chapterId,
      courseId,
      categoryId,
    ],
  )

  /**
   * Send a contextual help prompt to the AI without showing a user message bubble.
   * The prompt is persisted as hidden (for LLM context) but excluded from client responses.
   * Only the AI's streaming response appears in the chat.
   */
  const sendContextualHelp = async (prompt: string) => {
    if (isLoading || isLoadingHistory) return
    setIsLoading(true)
    const context = { exerciseId, lessonId, chapterId, courseId, categoryId }
    await streamMessage(prompt, acknowledgment, context, { hidden: true })
  }

  /**
   * Send a contextual help prompt with an image (e.g. canvas drawing).
   * Uploads the image, then sends via sync path (media requires sync).
   * No user message bubble shown — only the AI response appears.
   * @param additionalMediaIds - extra media IDs to include (e.g. the exercise image)
   */
  const sendContextualHelpWithMedia = async (
    prompt: string,
    imageDataUrl: string,
    additionalMediaIds?: string[],
  ) => {
    if (isLoading || isLoadingHistory) return
    setIsLoading(true)
    const context = { exerciseId, lessonId, chapterId, courseId, categoryId }

    try {
      // Convert data URL to Blob then File
      const [header, data] = imageDataUrl.split(',')
      const mime = header.match(/:(.*?);/)?.[1] || 'image/png'
      const binary = atob(data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      const file = new File([new Blob([bytes], { type: mime })], 'solution.png', { type: mime })

      // Upload to media endpoint
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/media', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Media upload failed')
      }

      const doc = await response.json()
      const mediaId = doc.doc?.id || doc.id

      // Send canvas drawing + any additional media (e.g. exercise image)
      const allMediaIds = [mediaId, ...(additionalMediaIds ?? [])]
      await sendMessageSync(prompt, acknowledgment, context, allMediaIds)
    } catch (error) {
      logger.error({ err: error }, 'Failed to send canvas for check')
      toast.error(errorMessage)
      setIsLoading(false)
    }
  }

  const dismissError = useCallback(() => {
    setChatError(null)
  }, [])

  /**
   * Set persistent Ask-page media (replaces any previous).
   * This media is sent with EVERY chat message until cleared.
   */
  const addExternalMedia = useCallback(
    (mediaId: string, filename: string, mimeType = 'image/jpeg') => {
      setAskMedia({ id: mediaId, filename, mimeType })
    },
    [],
  )

  const clearAskMedia = useCallback(() => {
    setAskMedia(null)
  }, [])

  /**
   * Send a contextual help prompt with an already-uploaded media ID.
   * Used for hint/solution actions where the exercise image is already on the server.
   */
  const sendContextualHelpWithMediaId = async (prompt: string, mediaId: string) => {
    if (isLoading || isLoadingHistory) return
    setIsLoading(true)
    const context = { exerciseId, lessonId, chapterId, courseId, categoryId }
    try {
      await sendMessageSync(prompt, acknowledgment, context, [mediaId])
    } catch (error) {
      logger.error({ err: error }, 'Failed to send contextual help with media ID')
      toast.error(errorMessage)
      setIsLoading(false)
    }
  }

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
    handleKeyDown,
    handleQuickAction,
    handleReset,
    // Media upload
    uploadedMedia,
    isUploading,
    handleFileSelect,
    removeMedia,
    openFilePicker,
    addExternalMedia,
    // Persistent Ask-page media (sent with every message)
    askMedia,
    clearAskMedia,
    // Error handling
    chatError,
    dismissError,
    // Guest mode
    isGuestMode: _isGuestMode,
    // Programmatic message injection
    addAssistantMessage,
    injectExerciseContext,
    sendContextualHelp,
    sendContextualHelpWithMedia,
    sendContextualHelpWithMediaId,
  }
}
