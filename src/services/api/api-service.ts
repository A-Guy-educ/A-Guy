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
}

export const apiService = {
  /**
   * Send a message to the AI chat assistant
   *
   * @param message - The user's message
   * @param acknowledgment - The AI's acknowledgment message (from locale)
   * @returns Response with success status and either message or error
   */
  async chat(message: string, acknowledgment: string): Promise<ChatApiResponse> {
    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, acknowledgment }),
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
        return { success: true, message: data.message }
      }

      return { success: false, error: 'Invalid response format' }
    } catch (error) {
      // Network errors or other exceptions
      return { success: false, error: 'Network error' }
    }
  },
}
