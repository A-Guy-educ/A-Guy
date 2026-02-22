/**
 * Unit tests for API service error logging
 * Tests that console.error is called with descriptive prefixes when network errors occur
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService } from '@/server/services/api/api-service'

// Mock fetch to throw errors
global.fetch = vi.fn()

// Mock console.error to verify it's called
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

describe('apiService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('chat', () => {
    it('logs error to console on network failure', async () => {
      // Arrange
      const networkError = new Error('Network failure')
      vi.mocked(fetch).mockRejectedValue(networkError)

      // Act
      const result = await apiService.chat(
        'Hello',
        'Acknowledgment',
        { exerciseId: 'exercise-123' },
        [],
        [],
        false,
      )

      // Assert - logging
      expect(consoleErrorSpy).toHaveBeenCalledWith('Chat API request failed:', networkError)

      // Assert - return value unchanged (no regression)
      expect(result).toEqual({ success: false, error: 'Network error' })
    })
  })

  describe('getConversation', () => {
    it('logs error to console on network failure', async () => {
      // Arrange
      const networkError = new Error('Network failure')
      vi.mocked(fetch).mockRejectedValue(networkError)

      // Act
      const result = await apiService.getConversation('exercises:abc123')

      // Assert - logging
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Get conversation API request failed:',
        networkError,
      )

      // Assert - return value unchanged (no regression)
      expect(result).toEqual({
        success: false,
        exists: false,
        messages: [],
        error: 'Network error',
      })
    })
  })

  describe('resetChat', () => {
    it('logs error to console on network failure', async () => {
      // Arrange
      const networkError = new Error('Network failure')
      vi.mocked(fetch).mockRejectedValue(networkError)

      // Act
      const result = await apiService.resetChat('exercises:abc123')

      // Assert - logging
      expect(consoleErrorSpy).toHaveBeenCalledWith('Reset chat API request failed:', networkError)

      // Assert - return value unchanged (no regression)
      expect(result).toEqual({ success: false, error: 'Network error' })
    })
  })
})
