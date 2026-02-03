/**
 * LLM Error Handling
 * Base LLMError class and error classification utilities
 *
 * @fileType error-handling
 * @domain ai
 */

/** Error codes for LLM providers */
export const LLMErrorCode = {
  CONFIG_ERROR: 'CONFIG_ERROR',
  API_ERROR: 'API_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const

export type LLMErrorCode = (typeof LLMErrorCode)[keyof typeof LLMErrorCode]

/**
 * Base LLM Error class
 * Provides structured error information for LLM operations
 */
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code: LLMErrorCode,
    public readonly provider: string,
    public readonly retryable: boolean,
    public readonly cause?: Error,
  ) {
    super(message)
    this.name = 'LLMError'
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LLMError)
    }
  }

  /**
   * Convert to JSON for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      provider: this.provider,
      retryable: this.retryable,
      cause: this.cause?.message,
      stack: this.stack,
    }
  }
}

/**
 * Create an error classifier for a specific provider
 *
 * @param provider - The provider name (e.g., 'gemini', 'openai')
 * @returns Object with isRetryable and wrapError functions
 */
export function createErrorClassifier(provider: string): {
  isRetryable: (error: Error) => boolean
  wrapError: (error: Error, defaultCode?: LLMErrorCode) => LLMError
} {
  const isRetryable = (error: Error): boolean => {
    const message = error.message.toLowerCase()

    // Non-retryable errors
    if (
      message.includes('api key') ||
      message.includes('invalid') ||
      message.includes('validation') ||
      message.includes('authentication') ||
      message.includes('401') ||
      message.includes('invalid_request_error')
    ) {
      return false
    }

    // Retryable errors (transient)
    return true
  }

  const wrapError = (
    error: Error,
    defaultCode: LLMErrorCode = LLMErrorCode.API_ERROR,
  ): LLMError => {
    const message = error.message.toLowerCase()

    // Configuration errors
    if (
      message.includes('api key') ||
      message.includes('no api key') ||
      message.includes('not configured')
    ) {
      return new LLMError(error.message, LLMErrorCode.CONFIG_ERROR, provider, false, error)
    }

    // Timeout errors
    if (
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('etimedout')
    ) {
      return new LLMError(
        `${provider} API request timed out`,
        LLMErrorCode.TIMEOUT_ERROR,
        provider,
        true,
        error,
      )
    }

    // Rate limit errors
    if (
      message.includes('rate') ||
      message.includes('quota') ||
      message.includes('429') ||
      message.includes('too many requests')
    ) {
      return new LLMError(
        `${provider} API rate limit exceeded`,
        LLMErrorCode.RATE_LIMIT_ERROR,
        provider,
        true,
        error,
      )
    }

    // Validation errors
    if (message.includes('invalid') || message.includes('validation') || message.includes('400')) {
      return new LLMError(error.message, LLMErrorCode.VALIDATION_ERROR, provider, false, error)
    }

    // Default API error
    return new LLMError(error.message, defaultCode, provider, true, error)
  }

  return { isRetryable, wrapError }
}
