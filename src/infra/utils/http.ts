/**
 * HTTP utilities for fetching resources
 */

/**
 * Fetch a buffer from any URL with timeout support
 *
 * @param url - The URL to fetch from (absolute URL)
 * @param timeoutMs - Request timeout in milliseconds (default 30 seconds)
 * @param headers - Optional headers to include in the request
 * @returns Buffer containing the response body
 * @throws Error if fetch fails or times out
 */
export async function fetchBuffer(
  url: string,
  timeoutMs = 30000,
  headers?: Record<string, string>,
): Promise<Buffer> {
  const MAX_RETRIES = 3
  const BASE_DELAY_MS = 500

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers,
      })

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer()
        return Buffer.from(arrayBuffer)
      }

      // Don't retry on 4xx client errors - throw immediately
      if (response.status < 500) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
      }

      // Retry on 5xx server errors with exponential backoff
      lastError = new Error(`HTTP ${response.status} ${response.statusText}`)
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)))
        continue
      }

      throw lastError
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      // Don't retry on client errors (4xx) or if we've exhausted retries
      const isClientError = error instanceof Error && error.message.startsWith('HTTP 4')
      if (isClientError || attempt === MAX_RETRIES) {
        throw lastError
      }
      // For network errors without a response, retry with backoff
      await new Promise((r) => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)))
    } finally {
      clearTimeout(timeoutId)
    }
  }

  throw lastError || new Error('Failed to fetch after retries')
}
