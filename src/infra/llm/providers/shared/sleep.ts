/**
 * Sleep Utility
 * Simple promise-based delay
 *
 * @fileType utility
 * @domain ai
 */

/**
 * Sleep for a specified duration
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 *
 * @example
 * ```ts
 * await sleep(1000) // Sleep for 1 second
 * await sleep(500)  // Sleep for 500ms
 * ```
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Sleep for a random duration between min and max
 *
 * @param minMs - Minimum delay in milliseconds
 * @param maxMs - Maximum delay in milliseconds
 * @returns Promise that resolves after a random delay
 *
 * @example
 * ```ts
 * await randomSleep(100, 500) // Sleep for 100-500ms
 * ```
 */
export function randomSleep(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
  return sleep(delay)
}

/**
 * Sleep with exponential backoff
 *
 * @param baseMs - Base delay in milliseconds
 * @param attempt - Current attempt number (1-indexed)
 * @param maxMs - Maximum delay in milliseconds
 * @returns Promise that resolves after the exponential delay
 *
 * @example
 * ```ts
 * await exponentialSleep(100, 1) // 100ms
 * await exponentialSleep(100, 2) // 200ms
 * await exponentialSleep(100, 3) // 400ms
 * ```
 */
export function exponentialSleep(
  baseMs: number,
  attempt: number,
  maxMs: number = 30_000,
): Promise<void> {
  const delay = Math.min(baseMs * Math.pow(2, attempt - 1), maxMs)
  return sleep(delay)
}
