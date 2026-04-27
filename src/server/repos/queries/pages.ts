import * as Sentry from '@sentry/nextjs'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { cache } from 'react'

/**
 * Look up a page by slug. Returns null when:
 *  - the slug is not found (existing behavior), OR
 *  - the underlying DB call fails transiently (cold-start, pool timeout).
 *
 * Callers already treat null as "page not found" and either redirect or
 * render a fallback, so this prevents transient failures from crashing
 * the entire layout via global-error.tsx.
 */
export const queryPageBySlug = cache(async ({ slug }: { slug: string }) => {
  try {
    const payload = await getPayload({ config: configPromise })

    const result = await payload.find({
      collection: 'pages',
      where: {
        slug: {
          equals: slug,
        },
      },
      limit: 1,
      pagination: false,
      depth: 2,
    })

    return result.docs?.[0] || null
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
    console.error(`[queryPageBySlug] failed for slug "${slug}"`, error)
    try {
      Sentry.captureException(error, { tags: { query: 'queryPageBySlug', slug } })
    } catch {
      // Sentry must never crash the caller
    }
    return null
  }
})

export const queryPublishedPages = cache(async () => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'pages',
    where: {
      _status: {
        equals: 'published',
      },
    },
    sort: 'publishedAt',
    limit: 1000,
    pagination: false,
    depth: 2,
  })

  return result.docs
})

export const queryAllPageSlugs = cache(async () => {
  try {
    const payload = await getPayload({ config: configPromise })

    const result = await payload.find({
      collection: 'pages',
      draft: false,
      limit: 25,
      depth: 0,
      select: {
        slug: true,
      },
    })

    // Defensive: ensure docs is an array before filtering
    const docs = result.docs || []
    return docs
      .filter((doc) => doc.slug !== undefined && doc.slug !== 'home')
      .map(({ slug }) => ({ slug }))
  } catch (error) {
    // During build, MongoDB may not be connected - return empty array
    console.warn('Failed to fetch page slugs, returning empty array:', error)
    return []
  }
})

export const queryAllPagesForSitemap = cache(async () => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'pages',
    where: {
      _status: {
        equals: 'published',
      },
    },
    select: {
      slug: true,
      updatedAt: true,
    },
    limit: 1000,
    pagination: false,
  })

  return result.docs
})
