import { unstable_cache } from 'next/cache'

/**
 * Wrapper around Next.js unstable_cache that falls back to direct execution
 * when the incremental cache infrastructure isn't available (e.g., in Vitest).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyParts: string[],
  options: { revalidate: number; tags: string[] },
): T {
  return (async (...args: Parameters<T>) => {
    try {
      const cached = unstable_cache(fn, keyParts, options)
      return await cached(...args)
    } catch (error) {
      // Fall back to direct execution when Next.js cache isn't available (tests)
      if (error instanceof Error && error.message.includes('incrementalCache')) {
        return fn(...args)
      }
      throw error
    }
  }) as T
}
