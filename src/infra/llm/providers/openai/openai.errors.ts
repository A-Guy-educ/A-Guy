/**
 * OpenAI-specific error handling
 * Maps SDK errors to domain-safe errors
 */

/** Error codes for OpenAI provider */
export const OpenAIErrorCode = {
  CONFIG_ERROR: 'OPENAI_CONFIG_ERROR',
  API_ERROR: 'OPENAI_API_ERROR',
  TIMEOUT_ERROR: 'OPENAI_TIMEOUT_ERROR',
  RATE_LIMIT_ERROR: 'OPENAI_RATE_LIMIT_ERROR',
  VALIDATION_ERROR: 'OPENAI_VALIDATION_ERROR',
} as const

export type OpenAIErrorCode = (typeof OpenAIErrorCode)[keyof typeof OpenAIErrorCode]

export class OpenAIError extends Error {
  constructor(
    message: string,
    public readonly code: OpenAIErrorCode,
    public readonly retryable: boolean,
    public readonly cause?: Error,
  ) {
    super(message)
    this.name = 'OpenAIError'
  }
}

/**
 * Determine if an error is retryable
 * @internal
 */
export function isRetryableOpenAIError(error: Error): boolean {
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

/**
 * Wrap SDK error in domain-safe OpenAIError
 */
export function wrapOpenAIError(error: Error): OpenAIError {
  const message = error.message.toLowerCase()

  if (message.includes('api key') || message.includes('no api key')) {
    return new OpenAIError(
      'OPENAI_API_KEY environment variable is not configured. Please set it in your .env file.',
      OpenAIErrorCode.CONFIG_ERROR,
      false,
      error,
    )
  }

  if (
    message.includes('timeout') ||
    message.includes('request timed out') ||
    message.includes('etimedout')
  ) {
    return new OpenAIError(
      'OpenAI API request timed out',
      OpenAIErrorCode.TIMEOUT_ERROR,
      true,
      error,
    )
  }

  if (
    message.includes('rate') ||
    message.includes('quota') ||
    message.includes('429') ||
    message.includes('too many requests')
  ) {
    return new OpenAIError(
      'OpenAI API rate limit exceeded',
      OpenAIErrorCode.RATE_LIMIT_ERROR,
      true,
      error,
    )
  }

  if (message.includes('invalid') || message.includes('validation') || message.includes('400')) {
    return new OpenAIError(error.message, OpenAIErrorCode.VALIDATION_ERROR, false, error)
  }

  return new OpenAIError(error.message, OpenAIErrorCode.API_ERROR, true, error)
}
