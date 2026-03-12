import { logger } from '@/infra/utils/logger'

const SLOW_QUERY_THRESHOLD_MS = 500

/**
 * Wraps an async function and logs its execution time.
 * Logs at debug level normally, warn level if slow (>500ms).
 *
 * Usage:
 *   const result = await timedQuery('queryCourseBySlug', () => payload.find({ ... }))
 */
export async function timedQuery<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now()
  try {
    const result = await fn()
    const durationMs = Math.round(performance.now() - start)

    if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
      logger.warn({ query: label, durationMs }, `Slow query: ${label} took ${durationMs}ms`)
    } else {
      logger.debug({ query: label, durationMs }, `Query: ${label} took ${durationMs}ms`)
    }

    return result
  } catch (error) {
    const durationMs = Math.round(performance.now() - start)
    logger.error(
      { query: label, durationMs, error },
      `Query failed: ${label} after ${durationMs}ms`,
    )
    throw error
  }
}

/**
 * Collects timing entries for a request.
 * Use with Server-Timing header to see timings in browser DevTools.
 *
 * Usage in API route:
 *   const timer = createRequestTimer()
 *   const course = await timer.time('course', () => queryCourseBySlug(...))
 *   const chapters = await timer.time('chapters', () => queryChapters(...))
 *   return NextResponse.json(data, { headers: { 'Server-Timing': timer.header() } })
 */
export function createRequestTimer() {
  const entries: Array<{ name: string; durationMs: number }> = []

  return {
    async time<T>(name: string, fn: () => Promise<T>): Promise<T> {
      const start = performance.now()
      const result = await fn()
      entries.push({ name, durationMs: Math.round(performance.now() - start) })
      return result
    },

    /** Returns Server-Timing header value for browser DevTools */
    header(): string {
      return entries.map((e) => `${e.name};dur=${e.durationMs}`).join(', ')
    },

    /** Returns all collected entries */
    entries() {
      return entries
    },

    /** Total time across all timed operations */
    totalMs(): number {
      return entries.reduce((sum, e) => sum + e.durationMs, 0)
    },
  }
}
