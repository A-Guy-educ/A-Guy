/**
 * Unit Tests for OpenAI Error Handling
 *
 * Tests the OpenAI-specific error handling module.
 */
import { describe, expect, it } from 'vitest'

describe('OpenAI Error Handling', () => {
  describe('OpenAIErrorCode', () => {
    it('should have correct error codes', async () => {
      const { OpenAIErrorCode } = await import('@/infra/llm/providers/openai/openai.errors')
      expect(OpenAIErrorCode.CONFIG_ERROR).toBe('OPENAI_CONFIG_ERROR')
      expect(OpenAIErrorCode.API_ERROR).toBe('OPENAI_API_ERROR')
      expect(OpenAIErrorCode.TIMEOUT_ERROR).toBe('OPENAI_TIMEOUT_ERROR')
      expect(OpenAIErrorCode.RATE_LIMIT_ERROR).toBe('OPENAI_RATE_LIMIT_ERROR')
      expect(OpenAIErrorCode.VALIDATION_ERROR).toBe('OPENAI_VALIDATION_ERROR')
    })
  })

  describe('OpenAIError class', () => {
    it('should create error with correct properties', async () => {
      const { OpenAIError, OpenAIErrorCode } =
        await import('@/infra/llm/providers/openai/openai.errors')

      const error = new OpenAIError('Test error message', OpenAIErrorCode.API_ERROR, true)

      expect(error.message).toBe('Test error message')
      expect(error.code).toBe('OPENAI_API_ERROR')
      expect(error.retryable).toBe(true)
      expect(error.name).toBe('OpenAIError')
    })

    it('should include cause when provided', async () => {
      const { OpenAIError, OpenAIErrorCode } =
        await import('@/infra/llm/providers/openai/openai.errors')

      const originalError = new Error('Original error')
      const error = new OpenAIError('Test error', OpenAIErrorCode.API_ERROR, true, originalError)

      expect(error.cause).toBe(originalError)
    })
  })

  describe('isRetryableOpenAIError', () => {
    it('should return false for auth errors', async () => {
      const { isRetryableOpenAIError } = await import('@/infra/llm/providers/openai/openai.errors')

      expect(isRetryableOpenAIError(new Error('Invalid API key'))).toBe(false)
      expect(isRetryableOpenAIError(new Error('Authentication failed'))).toBe(false)
      expect(isRetryableOpenAIError(new Error('Invalid request error'))).toBe(false)
    })

    it('should return true for transient errors', async () => {
      const { isRetryableOpenAIError } = await import('@/infra/llm/providers/openai/openai.errors')

      expect(isRetryableOpenAIError(new Error('Connection reset'))).toBe(true)
      expect(isRetryableOpenAIError(new Error('Server overloaded'))).toBe(true)
    })
  })

  describe('wrapOpenAIError', () => {
    it('should wrap API key errors', async () => {
      const { wrapOpenAIError, OpenAIErrorCode } =
        await import('@/infra/llm/providers/openai/openai.errors')

      const error = wrapOpenAIError(new Error('No API key provided'))

      expect(error.code).toBe(OpenAIErrorCode.CONFIG_ERROR)
      expect(error.retryable).toBe(false)
    })

    it('should wrap timeout errors', async () => {
      const { wrapOpenAIError, OpenAIErrorCode } =
        await import('@/infra/llm/providers/openai/openai.errors')

      const error = wrapOpenAIError(new Error('Request timed out after 30s'))

      expect(error.code).toBe(OpenAIErrorCode.TIMEOUT_ERROR)
      expect(error.retryable).toBe(true)
    })

    it('should wrap rate limit errors', async () => {
      const { wrapOpenAIError, OpenAIErrorCode } =
        await import('@/infra/llm/providers/openai/openai.errors')

      const error = wrapOpenAIError(new Error('Rate limit exceeded (429)'))

      expect(error.code).toBe(OpenAIErrorCode.RATE_LIMIT_ERROR)
      expect(error.retryable).toBe(true)
    })

    it('should wrap validation errors', async () => {
      const { wrapOpenAIError, OpenAIErrorCode } =
        await import('@/infra/llm/providers/openai/openai.errors')

      const error = wrapOpenAIError(new Error('Invalid request: bad parameter (400)'))

      expect(error.code).toBe(OpenAIErrorCode.VALIDATION_ERROR)
      expect(error.retryable).toBe(false)
    })

    it('should wrap generic API errors', async () => {
      const { wrapOpenAIError, OpenAIErrorCode } =
        await import('@/infra/llm/providers/openai/openai.errors')

      const error = wrapOpenAIError(new Error('Something went wrong'))

      expect(error.code).toBe(OpenAIErrorCode.API_ERROR)
      expect(error.retryable).toBe(true)
    })
  })
})
