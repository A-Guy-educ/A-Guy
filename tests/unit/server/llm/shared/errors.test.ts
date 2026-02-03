/**
 * Unit Tests for LLM Shared Utilities - Errors
 *
 * @fileType test
 * @domain ai
 */
import { LLMError, LLMErrorCode, createErrorClassifier } from '@/infra/llm/providers/shared/errors'
import { describe, expect, it } from 'vitest'

describe('LLMError', () => {
  it('creates error with all properties', () => {
    const error = new LLMError('Test error', LLMErrorCode.API_ERROR, 'test-provider', true)

    expect(error.message).toBe('Test error')
    expect(error.code).toBe('API_ERROR')
    expect(error.provider).toBe('test-provider')
    expect(error.retryable).toBe(true)
    expect(error.name).toBe('LLMError')
  })

  it('includes cause when provided', () => {
    const cause = new Error('Original error')
    const error = new LLMError('Wrapped', LLMErrorCode.API_ERROR, 'provider', false, cause)

    expect(error.cause).toBe(cause)
  })

  it('converts to JSON for logging', () => {
    const error = new LLMError('Test error', LLMErrorCode.TIMEOUT_ERROR, 'gemini', true)
    const json = error.toJSON()

    expect(json.name).toBe('LLMError')
    expect(json.message).toBe('Test error')
    expect(json.code).toBe('TIMEOUT_ERROR')
    expect(json.provider).toBe('gemini')
    expect(json.retryable).toBe(true)
  })
})

describe('createErrorClassifier', () => {
  describe('isRetryable', () => {
    it('returns false for api key errors', () => {
      const { isRetryable } = createErrorClassifier('gemini')
      expect(isRetryable(new Error('invalid api key'))).toBe(false)
    })

    it('returns false for authentication errors', () => {
      const { isRetryable } = createErrorClassifier('openai')
      expect(isRetryable(new Error('authentication failed'))).toBe(false)
    })

    it('returns false for validation errors', () => {
      const { isRetryable } = createErrorClassifier('gemini')
      expect(isRetryable(new Error('invalid request'))).toBe(false)
    })

    it('returns false for 401 errors', () => {
      const { isRetryable } = createErrorClassifier('openai')
      expect(isRetryable(new Error('401 Unauthorized'))).toBe(false)
    })

    it('returns true for timeout errors', () => {
      const { isRetryable } = createErrorClassifier('gemini')
      expect(isRetryable(new Error('request timed out'))).toBe(true)
    })

    it('returns true for rate limit errors', () => {
      const { isRetryable } = createErrorClassifier('openai')
      expect(isRetryable(new Error('rate limit exceeded'))).toBe(true)
    })

    it('returns true for server errors', () => {
      const { isRetryable } = createErrorClassifier('gemini')
      expect(isRetryable(new Error('internal server error'))).toBe(true)
    })
  })

  describe('wrapError', () => {
    it('creates CONFIG_ERROR for api key issues', () => {
      const { wrapError } = createErrorClassifier('openai')
      const error = wrapError(new Error('no api key found'))

      expect(error.code).toBe('CONFIG_ERROR')
      expect(error.provider).toBe('openai')
      expect(error.retryable).toBe(false)
    })

    it('creates TIMEOUT_ERROR for timeout issues', () => {
      const { wrapError } = createErrorClassifier('gemini')
      const error = wrapError(new Error('request timed out'))

      expect(error.code).toBe('TIMEOUT_ERROR')
      expect(error.provider).toBe('gemini')
      expect(error.retryable).toBe(true)
    })

    it('creates RATE_LIMIT_ERROR for rate limit issues', () => {
      const { wrapError } = createErrorClassifier('openai')
      const error = wrapError(new Error('rate limit exceeded'))

      expect(error.code).toBe('RATE_LIMIT_ERROR')
      expect(error.provider).toBe('openai')
      expect(error.retryable).toBe(true)
    })

    it('creates VALIDATION_ERROR for validation issues', () => {
      const { wrapError } = createErrorClassifier('gemini')
      const error = wrapError(new Error('invalid request body'))

      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.provider).toBe('gemini')
      expect(error.retryable).toBe(false)
    })

    it('creates API_ERROR for unknown errors', () => {
      const { wrapError } = createErrorClassifier('openai')
      const error = wrapError(new Error('something went wrong'))

      expect(error.code).toBe('API_ERROR')
      expect(error.provider).toBe('openai')
      expect(error.retryable).toBe(true)
    })

    it('uses custom default code when provided', () => {
      const { wrapError } = createErrorClassifier('gemini')
      const error = wrapError(new Error('unknown error'), LLMErrorCode.RATE_LIMIT_ERROR)

      expect(error.code).toBe('RATE_LIMIT_ERROR')
    })

    it('preserves cause', () => {
      const { wrapError } = createErrorClassifier('openai')
      const cause = new Error('original error')
      const error = wrapError(cause)

      expect(error.cause).toBe(cause)
    })
  })
})

describe('LLMErrorCode', () => {
  it('has all expected error codes', () => {
    expect(LLMErrorCode.CONFIG_ERROR).toBe('CONFIG_ERROR')
    expect(LLMErrorCode.API_ERROR).toBe('API_ERROR')
    expect(LLMErrorCode.TIMEOUT_ERROR).toBe('TIMEOUT_ERROR')
    expect(LLMErrorCode.RATE_LIMIT_ERROR).toBe('RATE_LIMIT_ERROR')
    expect(LLMErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
  })
})
