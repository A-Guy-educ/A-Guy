/**
 * @fileType utility
 * @domain infra
 * @pattern cache-tagged-fetch
 * @ai-summary Payload redirects collection fetcher; cached with Next.js unstable_cache and tagged for revalidation.
 *
 * The 'redirects' cache tag must be revalidated after any redirect CRUD operation,
 * otherwise stale redirects will be served until the Next.js cache expires.
 */

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'

export async function getRedirects(depth = 1) {
  const payload = await getPayload({ config: configPromise })

  const { docs: redirects } = await payload.find({
    collection: 'redirects',
    depth,
    limit: 0,
    pagination: false,
  })

  return redirects
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
