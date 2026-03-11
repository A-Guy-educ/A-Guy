import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import type { Where } from 'payload'

import type { ContentLocale } from '@/server/payload/fields/contentLocale'

const QUERY_CACHE_TTL = 60 // seconds — cached across requests via Next.js Data Cache

const _queryCourseBySlug = async (slug: string, locale?: string) => {
  const payload = await getPayload({ config: configPromise })

  const conditions: Where[] = [
    { slug: { equals: slug } },
    { status: { equals: 'published' } },
    { isActive: { equals: true } },
  ]

  if (locale) {
    conditions.push({ locale: { equals: locale } })
  }

  const result = await payload.find({
    collection: 'courses',
    where: { and: conditions },
    limit: 1,
    pagination: false,
    depth: 1,
    overrideAccess: false,
  })

  return result.docs?.[0] || null
}

export const queryCourseBySlug = async ({
  slug,
  locale,
}: {
  slug: string
  locale?: ContentLocale
}) => {
  const cached = unstable_cache(_queryCourseBySlug, ['course-by-slug', slug, locale ?? ''], {
    revalidate: QUERY_CACHE_TTL,
    tags: ['courses'],
  })
  return cached(slug, locale)
}

const _queryPublishedCourses = async (locale?: string) => {
  const payload = await getPayload({ config: configPromise })

  const conditions: Where[] = [{ status: { equals: 'published' } }, { isActive: { equals: true } }]

  if (locale) {
    conditions.push({ locale: { equals: locale } })
  }

  const result = await payload.find({
    collection: 'courses',
    where: { and: conditions },
    sort: 'order',
    limit: 1000,
    pagination: false,
    depth: 1,
    overrideAccess: false,
  })

  return result.docs
}

export const queryPublishedCourses = async (locale?: ContentLocale) => {
  const cached = unstable_cache(_queryPublishedCourses, ['published-courses', locale ?? ''], {
    revalidate: QUERY_CACHE_TTL,
    tags: ['courses'],
  })
  return cached(locale)
}
