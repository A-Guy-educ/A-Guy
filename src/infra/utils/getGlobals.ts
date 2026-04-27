import type { Config } from 'src/payload-types'

import * as Sentry from '@sentry/nextjs'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'

type Global = keyof Config['globals']
type GlobalData<S extends Global> = Config['globals'][S]

/**
 * Fetch a Payload global. Returns null instead of throwing on transient
 * failures (DB cold-start, connection-pool timeout, Payload init retry).
 * This prevents one failed global fetch from crashing the entire layout
 * and bubbling up to global-error.tsx.
 */
async function getGlobal<S extends Global>(slug: S, depth = 0): Promise<GlobalData<S> | null> {
  try {
    const payload = await getPayload({ config: configPromise })
    const global = await payload.findGlobal({ slug, depth })
    return global as GlobalData<S>
  } catch (error) {
    console.error(`[getGlobal] failed to fetch global "${slug}"`, error)
    try {
      Sentry.captureException(error, { tags: { global: slug } })
    } catch {
      // Sentry must never crash the caller
    }
    return null
  }
}

/**
 * Returns a unstable_cache function mapped with the cache tag for the slug.
 * The cached function may return null on fetch failure — callers MUST handle.
 */
export const getCachedGlobal = <S extends Global>(slug: S, depth = 0) =>
  unstable_cache(async () => getGlobal(slug, depth), [slug], {
    tags: [`global_${slug}`],
  })
