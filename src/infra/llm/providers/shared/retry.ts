/**
 * Retry Utility with Exponential Backoff
 * Provides robust retry logic for LLM API calls
 *
 * @fileType utility
 * @domain ai
 * @pattern retry
 */

export interface RetryOptions<E extends Error> {
  /** Maximum number of retry attempts */
  maxRetries?: number
  /** Initial delay between retries in milliseconds */
  delayMs?: number
  /** Function to determine if an error is retryable */
  isRetryable?: (error: Error) => boolean
  /** Function to wrap errors with provider-specific context */
  wrapError?: (error: Error) => E
  /** Prefix for log messages */
  logPrefix?: string
  /** Callback before each retry (useful for logging) */
  onRetry?: (error: Error, attempt: number) => void
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(baseDelayMs: number, attempt: number): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1)
  const jitter = exponentialDelay * 0.1 * Math.random()
  return Math.floor(exponentialDelay + jitter)
}

/**
 * Execute an operation with retry logic
 *
 * @param operation - The async operation to execute
 * @param options - Retry configuration options
 * @returns The result of the operation
 * @throws The last error if all retries are exhausted
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => fetchChatCompletion(input),
 *   {
 *     maxRetries: 3,
 *     delayMs: 1000,
 *     isRetryable: (e) => e.message.includes('timeout'),
 *     wrapError: (e) => new OpenAIError(e.message, 'API_ERROR', true),
 *     logPrefix: '[ChatService]'
 *   }
 * )
 * ```
 */
export async function withRetry<T, E extends Error>(
  operation: () => Promise<T>,
  options: RetryOptions<E> = {},
): Promise<T> {
  const {
    maxRetries = 2,
    delayMs = 1000,
    isRetryable = () => true,
    wrapError = (error: Error) => error as E,
    logPrefix = '[Retry]',
    onRetry,
  } = options

  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const castError = error instanceof Error ? error : new Error(String(error))
      lastError = castError

      const isLastAttempt = attempt > maxRetries
      const shouldRetry = !isLastAttempt && isRetryable(castError)

      if (!shouldRetry) {
        throw wrapError(castError)
      }

      const retryDelay = calculateDelay(delayMs, attempt)

      if (onRetry) {
        onRetry(castError, attempt)
      }

      console.debug(
        `${logPrefix} Retry attempt ${attempt}/${maxRetries} after ${retryDelay}ms: ${castError.message}`,
      )

      await sleep(retryDelay)
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError ? wrapError(lastError) : new Error('Unknown error')
}

/**
 * Sleep utility for delays
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
