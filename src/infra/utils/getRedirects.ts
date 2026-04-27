import * as Sentry from '@sentry/nextjs'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'

/**
 * Fetch all redirects. Returns [] instead of throwing on transient failure
 * (DB cold-start, pool timeout, Payload init retry) — callers already handle
 * an empty list as "no redirect applies", so the page can fall through.
 */
export async function getRedirects(depth = 1) {
  try {
    const payload = await getPayload({ config: configPromise })

    const { docs: redirects } = await payload.find({
      collection: 'redirects',
      depth,
      limit: 0,
      pagination: false,
    })

    return redirects
  } catch (error) {
    // Re-throw Next.js framework signals (dynamic-route, redirect, notFound).
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof (error as { digest?: unknown }).digest === 'string'
    ) {
      const digest = (error as { digest: string }).digest
      if (digest.startsWith('NEXT_') || digest.startsWith('DYNAMIC_SERVER_USAGE')) {
        throw error
      }
    }
    console.error('[getRedirects] failed to fetch redirects', error)
    try {
      Sentry.captureException(error, { tags: { helper: 'getRedirects' } })
    } catch {
      // Sentry must never crash the caller
    }
    return []
  }
}

/**
 * Returns a unstable_cache function mapped with the cache tag for 'redirects'.
 *
 * Cache all redirects together to avoid multiple fetches.
 */
export const getCachedRedirects = () =>
  unstable_cache(async () => getRedirects(), ['redirects'], {
    tags: ['redirects'],
  })
