import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import { cache } from 'react'

import type { ContentLocale } from '@/server/payload/fields/contentLocale'
import { localeWhereClause } from '@/server/payload/fields/contentLocale'

export const queryCourseBySlug = cache(
  async ({ slug, locale }: { slug: string; locale?: ContentLocale }) => {
    const payload = await getPayload({ config: configPromise })

    const conditions: Where[] = [
      { slug: { equals: slug } },
      { status: { equals: 'published' } },
      { isActive: { equals: true } },
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
  },
)

export const queryPublishedCourses = cache(async (locale?: ContentLocale) => {
  const payload = await getPayload({ config: configPromise })

  const conditions: Where[] = [{ status: { equals: 'published' } }, { isActive: { equals: true } }]

  if (locale) {
    conditions.push(localeWhereClause(locale))
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
})
