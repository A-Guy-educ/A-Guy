/**
 * @fileType utility
 * @domain infra
 * @pattern cache-tagged-fetch
 * @ai-summary Payload global document fetcher with Next.js unstable_cache per slug; tag is global_{slug}.
 *
 * Each global's cache must be manually revalidated via `revalidateTag('global_{slug}')`
 * after any global update, or the admin panel will show stale data.
 */

import type { Config } from 'src/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'

type Global = keyof Config['globals']

async function getGlobal(slug: Global, depth = 0) {
  const payload = await getPayload({ config: configPromise })

  const global = await payload.findGlobal({
    slug,
    depth,
  })

  return global
}

/**
 * Returns a unstable_cache function mapped with the cache tag for the slug
 */
export const getCachedGlobal = (slug: Global, depth = 0) =>
  unstable_cache(async () => getGlobal(slug, depth), [slug], {
    tags: [`global_${slug}`],
  })
