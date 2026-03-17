import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { Where } from 'payload'

import type { ContentLocale } from '@/server/payload/fields/contentLocale'
import { localeWhereClause } from '@/server/payload/fields/contentLocale'
import { safeCache } from './cache-utils'

const QUERY_CACHE_TTL = 60 // seconds — cached across requests via Next.js Data Cache

const _queryCourseBySlug = async (slug: string, locale?: ContentLocale) => {
  const payload = await getPayload({ config: configPromise })

  const conditions: Where[] = [
    { slug: { equals: slug } },
    { status: { equals: 'published' } },
    { isActive: { equals: true } },
    // Exclude "Soon" content that is not visible to students
    {
      or: [{ contentStatus: { not_equals: 'soon' } }, { contentStatusVisible: { equals: true } }],
    },
  ]

  if (locale) {
    conditions.push(localeWhereClause(locale))
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
  const cached = safeCache(_queryCourseBySlug, ['course-by-slug', slug, locale ?? ''], {
    revalidate: QUERY_CACHE_TTL,
    tags: ['courses'],
  })
  return cached(slug, locale)
}

const _queryPublishedCourses = async (locale?: ContentLocale) => {
  const payload = await getPayload({ config: configPromise })

  const conditions: Where[] = [
    { status: { equals: 'published' } },
    { isActive: { equals: true } },
    // Exclude "Soon" content that is not visible to students
    {
      or: [{ contentStatus: { not_equals: 'soon' } }, { contentStatusVisible: { equals: true } }],
    },
  ]

  if (locale) {
    conditions.push(localeWhereClause(locale))
  }

  const result = await payload.find({
    collection: 'courses',
    where: { and: conditions },
    sort: 'order',
    limit: 1000,
    pagination: false,
    depth: 0,
    overrideAccess: false,
    select: {
      title: true,
      slug: true,
      description: true,
      courseLabel: true,
      order: true,
      status: true,
      isActive: true,
      pageAccessType: true,
      accessType: true,
      contentStatus: true,
      contentStatusExpiresAt: true,
      contentStatusVisible: true,
    },
  })

  return result.docs
}

export const queryPublishedCourses = async (locale?: ContentLocale) => {
  const cached = safeCache(_queryPublishedCourses, ['published-courses', locale ?? ''], {
    revalidate: QUERY_CACHE_TTL,
    tags: ['courses'],
  })
  return cached(locale)
}
