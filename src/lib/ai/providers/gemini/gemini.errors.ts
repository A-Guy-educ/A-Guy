/**
 * Gemini-specific error handling
 * Maps SDK errors to domain-safe errors
 */

/** Error codes for Gemini provider */
export const GeminiErrorCode = {
  CONFIG_ERROR: 'GEMINI_CONFIG_ERROR',
  API_ERROR: 'GEMINI_API_ERROR',
  TIMEOUT_ERROR: 'GEMINI_TIMEOUT_ERROR',
  RATE_LIMIT_ERROR: 'GEMINI_RATE_LIMIT_ERROR',
  VALIDATION_ERROR: 'GEMINI_VALIDATION_ERROR',
} as const

export type GeminiErrorCode = (typeof GeminiErrorCode)[keyof typeof GeminiErrorCode]

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly code: GeminiErrorCode,
    public readonly retryable: boolean,
    public readonly cause?: Error,
  ) {
    super(message)
    this.name = 'GeminiError'
  }
}

/**
 * Determine if an error is retryable
 * @internal
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase()

  // Non-retryable errors
  if (
    message.includes('api key') ||
    message.includes('invalid') ||
    message.includes('validation') ||
    message.includes('authentication')
  ) {
    return false
  }

  // Retryable errors (transient)
  return true
}

/**
 * Wrap SDK error in domain-safe GeminiError
 */
export function wrapGeminiError(error: Error): GeminiError {
  const message = error.message.toLowerCase()

  if (message.includes('api key')) {
    return new GeminiError(
      'GEMINI_API_KEY environment variable is not configured. Please set it in your .env file.',
      GeminiErrorCode.CONFIG_ERROR,
      false,
      error,
    )
  }

  if (message.includes('timeout')) {
    return new GeminiError(
      'Gemini API request timed out',
      GeminiErrorCode.TIMEOUT_ERROR,
      true,
      error,
    )
  }

  if (message.includes('rate') || message.includes('quota')) {
    return new GeminiError(
      'Gemini API rate limit exceeded',
      GeminiErrorCode.RATE_LIMIT_ERROR,
      true,
      error,
    )
  }

  if (message.includes('invalid') || message.includes('validation')) {
    return new GeminiError(
      error.message,
      GeminiErrorCode.VALIDATION_ERROR,
      false,
      error,
    )
  }

  return new GeminiError(
    error.message,
    GeminiErrorCode.API_ERROR,
    true,
    error,
  )
}
