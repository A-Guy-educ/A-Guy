/**
 * Unit tests for API service error logging
 * Tests that logger.error is called with descriptive prefixes when network errors occur
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService } from '@/server/services/api/api-service'
import { logger } from '@/infra/utils/logger'

// Mock fetch to throw errors
global.fetch = vi.fn()

// Mock logger.error to verify it's called
const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

describe('apiService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('chat', () => {
    it('logs error to logger on network failure', async () => {
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

      // Assert - logging (pino signature: logger.error({ err }, 'message'))
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ err: networkError }),
        expect.stringContaining('Chat API request failed'),
      )

      // Assert - return value unchanged (no regression)
      expect(result).toEqual({ success: false, error: 'Network error' })
    })
  })

  describe('getConversation', () => {
    it('logs error to logger on network failure', async () => {
      // Arrange
      const networkError = new Error('Network failure')
      vi.mocked(fetch).mockRejectedValue(networkError)

      // Act
      const result = await apiService.getConversation('exercises:abc123')

      // Assert - logging (pino signature: logger.error({ err }, 'message'))
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ err: networkError }),
        expect.stringContaining('Get conversation API request failed'),
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
    it('logs error to logger on network failure', async () => {
      // Arrange
      const networkError = new Error('Network failure')
      vi.mocked(fetch).mockRejectedValue(networkError)

      // Act
      const result = await apiService.resetChat('exercises:abc123')

      // Assert - logging (pino signature: logger.error({ err }, 'message'))
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ err: networkError }),
        expect.stringContaining('Reset chat API request failed'),
      )

      // Assert - return value unchanged (no regression)
      expect(result).toEqual({ success: false, error: 'Network error' })
    })
  })
})
