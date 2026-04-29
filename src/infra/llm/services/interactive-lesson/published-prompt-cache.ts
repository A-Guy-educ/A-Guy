/**
 * Module-scope cache of the currently-published `interactive_lesson` prompt.
 *
 * Both lesson generation (which needs the template) and lesson cache
 * eviction (which needs the source provenance) hit this on every request.
 * Without memoization, every cached-lesson read pays an extra DB round-trip
 * to look up the prompt — defeating the point of the cache. Cache for a
 * short TTL and let a Prompts afterChange hook invalidate it eagerly when
 * an admin actually edits the row.
 *
 * Lives at module scope (per Node process). Each serverless instance has
 * its own copy; staleness is bounded by the TTL plus the eager invalidate
 * within a single instance. With a 30s TTL, the worst-case window where a
 * non-edit-source instance is still serving the stale prompt id is 30s,
 * which is acceptable for a feature where lesson generation is rare.
 */

import type { Payload } from 'payload'

export interface PublishedInteractiveLessonPrompt {
  id: string
  template: string
  /** Source updatedAt as ISO string (normalized so date format is deterministic). */
  updatedAt: string
}

interface CacheEntry {
  /** null means "we looked and there is no published prompt" — cached as a negative. */
  prompt: PublishedInteractiveLessonPrompt | null
  fetchedAt: number
}

const CACHE_TTL_MS = 30_000

let cache: CacheEntry | null = null

/**
 * Look up the currently-published `interactive_lesson` prompt, with a
 * short TTL memoization. Returns null if no published prompt exists.
 */
export async function getPublishedInteractiveLessonPrompt(
  payload: Payload,
): Promise<PublishedInteractiveLessonPrompt | null> {
  const now = Date.now()
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.prompt
  }

  const result = await payload.find({
    collection: 'prompts',
    where: {
      and: [{ usage: { equals: 'interactive_lesson' } }, { status: { equals: 'published' } }],
    },
    limit: 1,
    overrideAccess: true,
  })

  const doc = result.docs[0]
  if (!doc) {
    cache = { prompt: null, fetchedAt: now }
    return null
  }

  const template = doc.template?.trim()
  if (!template) {
    cache = { prompt: null, fetchedAt: now }
    return null
  }

  cache = {
    prompt: {
      id: String(doc.id),
      template,
      updatedAt: normalizeIsoDate(doc.updatedAt),
    },
    fetchedAt: now,
  }
  return cache.prompt
}

/**
 * Drop the cached prompt — fired by the Prompts collection's afterChange /
 * afterDelete hook so admin edits are visible to the next request without
 * waiting out the TTL. Safe to call when no entry is cached.
 */
export function invalidatePublishedInteractiveLessonPrompt(): void {
  cache = null
}

/**
 * Normalize a Payload-returned updatedAt to an ISO string. Payload may
 * return Date or ISO depending on driver/path; without normalizing, the
 * cache invalidation comparison flips to "evict on every read" the moment
 * the two sides disagree on format.
 */
export function normalizeIsoDate(value: unknown): string {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    return d.toISOString()
  }
  return ''
}
