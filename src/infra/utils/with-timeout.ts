/**
 * Promise timeout helper.
 *
 * @fileType utility
 * @domain shared
 * @pattern promise-race-timeout
 * @ai-summary Races a promise against a timer; throws a TimeoutError when the timer wins.
 *
 * Extracted out of the two duplication-pipeline helpers
 * (lesson-duplication-variation-service.ts and validators/semantic.ts) that
 * each had their own copy and were starting to drift in error class and
 * message format. Kept generic so other LLM callers can reuse.
 */

/** Thrown when a `withTimeout` race is won by the timer. */
export class PromiseTimeoutError extends Error {
  readonly code = 'TIMEOUT'
  constructor(stage: string, timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms in ${stage}`)
    this.name = 'PromiseTimeoutError'
  }
}

/** Race `promise` against a `timeoutMs` timer. The loser is cleaned up. */
export function withTimeout<T>(promise: Promise<T>, stage: string, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new PromiseTimeoutError(stage, timeoutMs)), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}
