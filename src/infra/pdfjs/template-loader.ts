import { CACHE_CONFIG, VIEWER_URLS } from './config'
import { logger } from '@/infra/utils/logger'

/**
 * Fetch helper with consistent error handling
 */
export async function fetchText(
  url: string,
  options?: { revalidate?: number },
): Promise<{ ok: true; text: string } | { ok: false; status: number; statusText: string }> {
  try {
    const response = await fetch(url, {
      next: { revalidate: options?.revalidate ?? CACHE_CONFIG.revalidateSeconds },
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
export async function loadViewerTemplate(): Promise<
  { ok: true; html: string } | { ok: false; status: number; statusText: string }
> {
  const cacheKey = 'viewer-html'

  // Check cache first
  const cached = templateCache.get(cacheKey)
  if (cached) {
    logger.debug({ source: 'cache' }, 'Loaded viewer HTML from cache')
    return { ok: true, html: cached }
  }

  // Fetch from CDN
  logger.debug({ url: VIEWER_URLS.html }, 'Fetching viewer HTML from CDN')
  const result = await fetchText(VIEWER_URLS.html)

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
export async function loadViewerCss(): Promise<
  { ok: true; css: string } | { ok: false; status: number; statusText: string }
> {
  const cacheKey = 'viewer-css'

  // Check cache first
  const cached = templateCache.get(cacheKey)
  if (cached) {
    logger.debug({ source: 'cache' }, 'Loaded viewer CSS from cache')
    return { ok: true, css: cached }
  }

  // Fetch from CDN
  logger.debug({ url: VIEWER_URLS.css }, 'Fetching viewer CSS from CDN')
  const result = await fetchText(VIEWER_URLS.css)

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
