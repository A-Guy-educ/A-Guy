/**
 * Timeout Utility
 * Race a promise against a timeout
 *
 * @fileType utility
 * @domain ai
 * @pattern timeout
 */

export interface TimeoutOptions {
  /** Timeout in milliseconds */
  timeoutMs?: number
  /** Error message for timeout */
  message?: string
  /** Cleanup function to call on timeout or completion */
  cleanup?: () => void
}

/**
 * Error thrown when an operation times out
 */
export class TimeoutError extends Error {
  constructor(
    message: string = 'Operation timed out',
    public readonly timeoutMs: number,
  ) {
    super(message)
    this.name = 'TimeoutError'
  }
}

/**
 * Race an operation against a timeout
 *
 * @param operation - The async operation to execute
 * @param options - Timeout configuration
 * @returns The result of the operation
 * @throws TimeoutError if the operation doesn't complete in time
 *
 * @example
 * ```ts
 * const result = await withTimeout(
 *   () => fetchChatCompletion(input),
 *   { timeoutMs: 30_000, message: 'Chat completion timed out' }
 * )
 * ```
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  options: TimeoutOptions = {},
): Promise<T> {
  const {
    timeoutMs = 30_000,
    message = `Operation timed out after ${timeoutMs}ms`,
    cleanup,
  } = options

  if (timeoutMs <= 0) {
    cleanup?.()
    return operation()
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      cleanup?.()
      reject(new TimeoutError(message, timeoutMs))
    }, timeoutMs)
  })

  try {
    const result = await Promise.race([operation(), timeoutPromise])
    clearTimeout(timeoutId)
    return result
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * Create a timeout promise that can be awaited alongside other operations
 *
 * @param timeoutMs - Timeout in milliseconds
 * @param message - Error message for timeout
 * @returns A promise that rejects with TimeoutError after the timeout
 *
 * @example
 * ```ts
 * const result = await Promise.race([
 *   someOperation(),
 *   createTimeout(30_000, 'Operation took too long')
 * ])
 * ```
 */
export function createTimeout(
  timeoutMs: number,
  message: string = `Operation timed out after ${timeoutMs}ms`,
): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new TimeoutError(message, timeoutMs)), timeoutMs)
  })
}

/**
 * Abort controller wrapper for timeout
 * Creates an AbortController that will be aborted after the timeout
 *
 * @param timeoutMs - Timeout in milliseconds
 * @returns Object with signal and cleanup function
 *
 * @example
 * ```ts
 * const { signal, abort } = createAbortSignal(30_000)
 * const response = await fetch(url, { signal })
 * ```
 */
export function createAbortSignal(timeoutMs: number): {
  signal: AbortSignal
  abort: (reason?: string) => void
} {
  const controller = new AbortController()

  const timeoutId = setTimeout(() => {
    controller.abort(new TimeoutError('Operation timed out', timeoutMs))
  }, timeoutMs)

  return {
    signal: controller.signal,
    abort: (reason?: string) => {
      clearTimeout(timeoutId)
      controller.abort(new Error(reason || 'Operation aborted'))
    },
  }
}
