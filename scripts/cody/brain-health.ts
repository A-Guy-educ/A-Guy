/**
 * @fileType utility
 * @domain cody | brain
 * @ai-summary Health check utility for brain server availability
 */

/**
 * Check if brain server is available at the given URL.
 * Returns false if URL is undefined/empty or if the server doesn't respond within 5s.
 */
export async function isBrainAvailable(url: string | undefined): Promise<boolean> {
  if (!url) return false
  try {
    // Strip /sse suffix if present to get base URL for health check
    const baseUrl = url.replace(/\/sse$/, '')
    const resp = await fetch(baseUrl, { signal: AbortSignal.timeout(5000) })
    return resp.ok
  } catch {
    return false
  }
}
