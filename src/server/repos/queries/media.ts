import { cache } from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Media } from '@/payload-types'

/**
 * Fetch multiple media documents by their IDs.
 * Returns a map of id -> Media for efficient lookup.
 */
export const queryMediaByIds = cache(async (ids: string[]): Promise<Record<string, Media>> => {
  if (ids.length === 0) return {}

  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'media',
    where: {
      id: { in: ids },
    },
    limit: ids.length,
    pagination: false,
    depth: 0,
  })

  const map: Record<string, Media> = {}
  for (const doc of result.docs) {
    map[doc.id] = doc
  }
  return map
})
