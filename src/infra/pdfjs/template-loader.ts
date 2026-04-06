import { logger } from '@/infra/utils/logger'
import { CACHE_CONFIG, VIEWER_URLS, type ViewerUrls } from './config'

/**
 * Fetch helper with consistent error handling
 */
export async function fetchText(
  url: string,
  options?: { revalidate?: number },
): Promise<{ ok: true; text: string } | { ok: false; status: number; statusText: string }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(url, {
      next: { revalidate: options?.revalidate ?? CACHE_CONFIG.revalidateSeconds },
      signal: controller.signal,
    })

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        statusText: response.statusText,
      }
    }

    const text = await response.text()
    return { ok: true, text }
  } catch (error) {
    logger.error({ error, url: url.split('?')[0] }, 'Failed to fetch resource')
    return {
      ok: false,
      status: 0,
      statusText: error instanceof Error ? error.message : 'Unknown error',
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Template cache
 * Memoizes fetched viewer HTML and CSS to avoid repeated fetches
 */
const templateCache = new Map<string, string>()

/**
 * Load viewer HTML template from Blob CDN
 * Result is cached in-memory to avoid repeated fetches
 */
export async function loadViewerTemplate(
  viewerUrls?: ViewerUrls,
): Promise<{ ok: true; html: string } | { ok: false; status: number; statusText: string }> {
  const urls = viewerUrls || VIEWER_URLS
  const cacheKey = 'viewer-html'

  // Check cache first
  const cached = templateCache.get(cacheKey)
  if (cached) {
    logger.debug({ source: 'cache' }, 'Loaded viewer HTML from cache')
    return { ok: true, html: cached }
  }

  // Fetch from CDN
  logger.debug({ url: urls.html }, 'Fetching viewer HTML from CDN')
  const result = await fetchText(urls.html)

  if (!result.ok) {
    return result
  }

  // Cache the result
  templateCache.set(cacheKey, result.text)
  logger.debug({ size: result.text.length }, 'Cached viewer HTML')

  return { ok: true, html: result.text }
}

/**
 * Load viewer CSS from Blob CDN
 * Result is cached in-memory to avoid repeated fetches
 */
export async function loadViewerCss(
  viewerUrls?: ViewerUrls,
): Promise<{ ok: true; css: string } | { ok: false; status: number; statusText: string }> {
  const urls = viewerUrls || VIEWER_URLS
  const cacheKey = 'viewer-css'

  // Check cache first
  const cached = templateCache.get(cacheKey)
  if (cached) {
    logger.debug({ source: 'cache' }, 'Loaded viewer CSS from cache')
    return { ok: true, css: cached }
  }

  // Fetch from CDN
  logger.debug({ url: urls.css }, 'Fetching viewer CSS from CDN')
  const result = await fetchText(urls.css)

  if (!result.ok) {
    return result
  }

  // Cache the result
  templateCache.set(cacheKey, result.text)
  logger.debug({ size: result.text.length }, 'Cached viewer CSS')

  return { ok: true, css: result.text }
}

/**
 * Clear template cache (useful for testing)
 */
export function clearTemplateCache(): void {
  templateCache.clear()
  logger.debug('Cleared template cache')
}
