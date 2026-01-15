/**
 * API Service
 *
 * Encapsulates all API calls with error handling.
 * Provides simple interface for components to interact with backend endpoints.
 */

export interface ChatApiResponse {
  success: boolean
  message?: string
  error?: string
  authRequired?: boolean
  conversationId?: string
}

export interface ConversationMessage {
  role: string
  content: string
}

export interface ConversationApiResponse {
  success: boolean
  exists: boolean
  conversationId?: string
  messages: ConversationMessage[]
  error?: string
  authRequired?: boolean
}

export const apiService = {
  /**
   * Send a message to the AI chat assistant
   *
   * @param message - The user's message
   * @param acknowledgment - The AI's acknowledgment message (from locale)
   * @param exerciseId - The ID of the exercise being discussed (optional)
   * @param lessonId - The ID of the lesson being discussed (optional)
   * @returns Response with success status and either message or error
   */
  async chat(
    message: string,
    acknowledgment: string,
    exerciseId?: string,
    lessonId?: string,
  ): Promise<ChatApiResponse> {
    try {
      const body: {
        message: string
        acknowledgment: string
        exerciseId?: string
        lessonId?: string
      } = { message, acknowledgment }
      if (exerciseId) {
        body.exerciseId = exerciseId
      } else if (lessonId) {
        body.lessonId = lessonId
      }

      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        // Specific handling for auth errors
        if (response.status === 401) {
          return { success: false, authRequired: true }
        }
        return { success: false, error: data.error || 'Request failed' }
      }

      if (data.success && data.message) {
        return {
          success: true,
          message: data.message,
          conversationId: data.conversationId,
        }
      }

      return { success: false, error: 'Invalid response format' }
    } catch (_error) {
      // Network errors or other exceptions
      return { success: false, error: 'Network error' }
    }
  },

  /**
   * Fetch existing conversation history for an exercise or lesson using Payload's REST API
   *
   * @param exerciseId - The ID of the exercise (optional)
   * @param lessonId - The ID of the lesson (optional)
   * @returns Conversation history with messages
   */
  async getConversation(exerciseId?: string, lessonId?: string): Promise<ConversationApiResponse> {
    try {
      // Use Payload's auto-generated REST API with query filters
      // Access control is automatically enforced by Payload
      const whereClause: {
        exercise?: { equals: string }
        lesson?: { equals: string }
      } = {}
      if (exerciseId) {
        whereClause.exercise = { equals: exerciseId }
      } else if (lessonId) {
        whereClause.lesson = { equals: lessonId }
      }
      const whereQuery = JSON.stringify(whereClause)

      const response = await fetch(
        `/api/conversations?where=${encodeURIComponent(whereQuery)}&limit=1`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      )

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, exists: false, messages: [], authRequired: true }
        }
        return {
          success: false,
          exists: false,
          messages: [],
          error: data.errors?.[0]?.message || 'Request failed',
        }
      }

      // Payload returns { docs: [...], totalDocs, ... }
      if (data.docs && data.docs.length > 0) {
        const conversation = data.docs[0] as {
          id: string
          messages?: Array<{ role: string; content: string }>
        }
        const messages = conversation.messages || []

        return {
          success: true,
          exists: true,
          conversationId: conversation.id,
          messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }
      }

      // No conversation exists yet
      return {
        success: true,
        exists: false,
        messages: [],
      }
    } catch (_error) {
      return { success: false, exists: false, messages: [], error: 'Network error' }
    }
  },
}
