/**
 * API Service
 *
 * Encapsulates all API calls with error handling.
 * Provides simple interface for components to interact with backend endpoints.
 */
import { ChatRole } from '@/infra/llm/chat-message-role'
import { logger } from '@/infra/utils/logger'

export interface ChatApiResponse {
  success: boolean
  message?: string
  error?: string
  authRequired?: boolean
  guestLimitReached?: boolean
  conversationId?: string
  contextKey?: string
  isGuestMode?: boolean
}

export interface ConversationMessage {
  role: string
  content: string
  media?: Array<{ mediaId: string; filename?: string }>
}

export interface ConversationApiResponse {
  success: boolean
  exists: boolean
  conversationId?: string
  messages: ConversationMessage[]
  error?: string
  authRequired?: boolean
  contextKey?: string
  isGuestMode?: boolean
}

export interface ResetChatApiResponse {
  success: boolean
  conversationId?: string
  contextKey?: string
  error?: string
  isGuestMode?: boolean
}

/**
 * SSE Event types for streaming chat
 */
export interface ChatStreamEvent {
  type: 'chunk' | 'done' | 'error'
  text?: string
  conversationId?: string
  contextKey?: string
  error?: string
}

export const apiService = {
  /**
   * Send a message to the AI chat assistant
   *
   * @param message - The user's message
   * @param acknowledgment - The AI's acknowledgment message (from locale)
   * @param context - Context parameters (prefer IDs over slugs)
   * @param mediaIds - Optional array of media IDs to attach (max 5)
   * @param adminMode - Optional admin mode flag (for legacy admin chat)
   * @returns Response with success status and either message or error
   */
  async chat(
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
    adminMode?: boolean,
  ): Promise<ChatApiResponse> {
    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message,
          acknowledgment,
          ...context,
          ...(mediaIds && mediaIds.length > 0 ? { mediaIds } : {}),
          ...(adminMode ? { adminMode: true } : {}),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Specific handling for auth errors
        if (response.status === 401) {
          return { success: false, authRequired: true }
        }
        // Specific handling for guest message limit
        if (response.status === 429 && data.error?.includes('Guest message limit reached')) {
          return {
            success: false,
            error: data.error || 'Message limit reached',
            guestLimitReached: true,
          }
        }
        return { success: false, error: data.error || 'Request failed' }
      }

      if (data.success && data.message) {
        return {
          success: true,
          message: data.message,
          conversationId: data.conversationId,
          contextKey: data.contextKey,
        }
      }

      return { success: false, error: 'Invalid response format' }
    } catch (error) {
      // Network errors or other exceptions
      logger.error({ err: error }, '[apiService.chat] Network error')
      return { success: false, error: 'Network error' }
    }
  },

  /**
   * Fetch existing conversation history for a context using dedicated endpoint
   * The endpoint explicitly filters by authenticated user ID to guarantee isolation
   *
   * @param contextKey - The context key (e.g., "exercises:abc123")
   * @returns Conversation history with messages
   */
  async getConversation(contextKey: string): Promise<ConversationApiResponse> {
    try {
      logger.debug({ contextKey }, '[getConversation] Fetching via dedicated endpoint')

      const response = await fetch('/api/agent/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ contextKey }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, exists: false, messages: [], authRequired: true }
        }
        return {
          success: false,
          exists: false,
          messages: [],
          error: data.error || 'Request failed',
        }
      }

      if (data.success && data.exists) {
        const messages = (data.messages || []).map(
          (msg: {
            role: string
            content: string
            media?: Array<{ mediaId: string; filename?: string }>
          }) => ({
            role:
              msg.role === ChatRole.User || msg.role === 'user'
                ? ChatRole.User
                : ChatRole.Assistant,
            content: msg.content,
            media: msg.media,
          }),
        )

        logger.debug(
          {
            conversationId: data.conversationId,
            contextKey: data.contextKey,
            messageCount: messages.length,
          },
          '[getConversation] Loaded conversation',
        )

        return {
          success: true,
          exists: true,
          conversationId: data.conversationId,
          messages,
          contextKey: data.contextKey,
        }
      }

      logger.debug({ contextKey }, '[getConversation] No conversation found')
      return { success: true, exists: false, messages: [], contextKey }
    } catch (error) {
      logger.error({ err: error }, '[apiService.getConversation] Network error')
      return { success: false, exists: false, messages: [], error: 'Network error' }
    }
  },

  /**
   * Reset chat for a context (archive current, create new)
   *
   * @param contextKey - The context key to reset
   * @returns Response with new conversation ID
   */
  async resetChat(contextKey: string): Promise<ResetChatApiResponse> {
    try {
      const response = await fetch('/api/agent/reset-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ contextKey }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Authentication required' }
        }
        return { success: false, error: data.error || 'Request failed' }
      }

      if (data.success) {
        return {
          success: true,
          conversationId: data.conversationId,
          contextKey: data.contextKey,
        }
      }

      return { success: false, error: 'Reset failed' }
    } catch (error) {
      logger.error({ err: error }, '[apiService.resetChat] Network error')
      return { success: false, error: 'Network error' }
    }
  },

  /**
   * Stream a chat response using SSE
   *
   * @param message - The user's message
   * @param acknowledgment - The AI's acknowledgment message (from locale)
   * @param context - Context parameters (prefer IDs over slugs)
   * @returns Async generator yielding typed stream events
   * @throws Error if media attachments or admin mode are requested
   */
  async *chatStream(
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
  ): AsyncGenerator<ChatStreamEvent, void, unknown> {
    const response = await fetch('/api/agent/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        message,
        acknowledgment,
        ...context,
        ...(options?.hidden && { hidden: true }),
      }),
    })

    if (!response.ok) {
      if (response.status === 401) {
        yield { type: 'error', error: 'Authentication required' }
        return
      }

      const errorData = await response.json().catch(() => ({}))
      yield { type: 'error', error: errorData.error || 'Request failed' }
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      yield { type: 'error', error: 'Stream not available' }
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (trimmedLine.startsWith('event: ')) {
            const eventType = trimmedLine.slice(7).trim() as 'chunk' | 'done' | 'error'

            // Find the corresponding data line (next line that starts with 'data: ')
            const dataIndex = lines.indexOf(line) + 1
            if (dataIndex < lines.length && lines[dataIndex].trim().startsWith('data: ')) {
              try {
                const eventData = JSON.parse(lines[dataIndex].trim().slice(6))
                yield {
                  type: eventType,
                  ...(eventData.text !== undefined && { text: eventData.text }),
                  ...(eventData.conversationId && { conversationId: eventData.conversationId }),
                  ...(eventData.contextKey && { contextKey: eventData.contextKey }),
                  ...(eventData.error && { error: eventData.error }),
                }
              } catch {
                // Ignore JSON parse errors
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  },
}
