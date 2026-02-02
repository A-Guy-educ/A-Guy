'use client'

import { ChatRole } from '@/infra/llm/chat-message-role'
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
  type: 'auth' | 'general'
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

  // Error state
  const [chatError, setChatError] = useState<ChatError | null>(null)

  // Compute contextKey based on available context
  // Priority for admin mode: user-specific admin context
  // Priority for regular mode: Exercise > Lesson > Chapter > Course > Category
  const contextKey = useMemo(() => {
    if (adminMode && userId) {
      return `admin:user:${userId}`
    }
    if (exerciseId) return `exercises:${exerciseId}`
    if (lessonId) return `lessons:${lessonId}`
    if (chapterId) return `chapters:${chapterId}`
    if (courseId) return `courses:${courseId}`
    if (categoryId) return `categories:${categoryId}`
    return null
  }, [adminMode, userId, exerciseId, lessonId, chapterId, courseId, categoryId])

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
    if ((!message.trim() && uploadedMedia.length === 0) || isLoading) return

    // Capture mediaIds and metadata before clearing
    const mediaIds = uploadedMedia.map((m) => m.id)
    const mediaMetadata = uploadedMedia.map((m) => ({ mediaId: m.id, filename: m.filename }))

    const userMessage: ChatMessage = {
      role: ChatRole.User,
      content: message,
      media: mediaMetadata.length > 0 ? mediaMetadata : undefined,
    }
    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    setUploadedMedia([])

    // Track chat message submitted (message length only, NOT content)
    systemEventBus.emit(SYSTEM_EVENTS.CHAT_MESSAGE_SUBMITTED, {
      conversation_id: contextKey || 'unknown',
      message_type: 'user',
      message_length: message.length,
    })

    try {
      const result = await apiService.chat(
        message,
        acknowledgment,
        {
          exerciseId,
          lessonId,
          chapterId,
          courseId,
          categoryId,
        },
        mediaIds.length > 0 ? mediaIds : undefined,
        adminMode, // Pass adminMode flag to API
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
    handleKeyDown,
    handleQuickAction,
    handleReset,
    // Media upload
    uploadedMedia,
    isUploading,
    handleFileSelect,
    removeMedia,
    openFilePicker,
    // Error handling
    chatError,
    dismissError,
  }
}
