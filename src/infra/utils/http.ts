/**
 * HTTP utilities for fetching resources
 */

/**
 * Fetch a buffer from any URL with timeout support
 *
 * @param url - The URL to fetch from (absolute URL)
 * @param timeoutMs - Request timeout in milliseconds (default 30 seconds)
 * @returns Buffer containing the response body
 * @throws Error if fetch fails or times out
 */
export async function fetchBuffer(url: string, timeoutMs = 30000): Promise<Buffer> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } finally {
    clearTimeout(timeoutId)
  }
}
