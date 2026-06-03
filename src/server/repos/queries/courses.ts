import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import { cache } from 'react'

import type { ContentLocale } from '@/server/payload/fields/contentLocale'
import { localeWhereClause } from '@/server/payload/fields/contentLocale'

export const queryCourseBySlug = cache(
  async ({ slug, locale }: { slug: string; locale?: ContentLocale }) => {
    const payload = await getPayload({ config: configPromise })

    // Check if user is authenticated to determine which filters to apply
    let user: { id: string; role?: string } | null = null
    try {
      const { headers: headersModule } = await import('next/headers')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { user: authUser } = await (payload as any).auth({ headers: await headersModule() })
      user = authUser
    } catch {
      user = null
    }

    const isAuthenticated = user !== null

    const conditions: Where[] = [
      { slug: { equals: slug } },
      // Only apply status=published filter for anonymous users
      ...(isAuthenticated ? [] : [{ status: { equals: 'published' } }]),
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
  },
)

export const queryPublishedCourses = cache(async (locale?: ContentLocale) => {
  const payload = await getPayload({ config: configPromise })

  // Check if user is authenticated to determine which filters to apply
  // For authenticated users, access control allows all courses, so we only filter by isActive
  // For anonymous users, access control restricts to published+active, so we also filter by status
  let user: { id: string; role?: string } | null = null
  try {
    const { headers: headersModule } = await import('next/headers')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { user: authUser } = await (payload as any).auth({ headers: await headersModule() })
    user = authUser
  } catch {
    // Not authenticated or error - treat as anonymous
    user = null
  }

  const isAuthenticated = user !== null

  const conditions: Where[] = [
    // Only apply status=published filter for anonymous users
    // Authenticated users can see all courses (access control handles visibility)
    ...(isAuthenticated ? [] : [{ status: { equals: 'published' } }]),
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
    depth: 1,
    overrideAccess: false,
  })

  return result.docs
})
