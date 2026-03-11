import { cache } from 'react'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'

import type { ContentLocale } from '@/server/payload/fields/contentLocale'

const QUERY_CACHE_TTL = 60 // seconds

const _queryChaptersByCourse = async (courseId: string) => {
  const payload = await getPayload({ config: configPromise })

  // Verify the course is published+active (hierarchy invariant)
  const courseResult = await payload.findByID({
    collection: 'courses',
    id: courseId,
    depth: 0,
    overrideAccess: false,
    disableErrors: true,
  })

  if (!courseResult || courseResult.status !== 'published' || !courseResult.isActive) {
    return []
  }

  const result = await payload.find({
    collection: 'chapters',
    where: {
      and: [
        { course: { equals: courseId } },
        { status: { equals: 'published' } },
        { isActive: { equals: true } },
      ],
    },
    sort: 'order',
    limit: 1000,
    pagination: false,
    depth: 1,
    overrideAccess: false,
  })

  return result.docs
}

export const queryChaptersByCourse = async ({ courseId }: { courseId: string }) => {
  const cached = unstable_cache(_queryChaptersByCourse, ['chapters-by-course', courseId], {
    revalidate: QUERY_CACHE_TTL,
    tags: ['chapters'],
  })
  return cached(courseId)
}

export const queryChapterBySlug = cache(async ({ slug }: { slug: string }) => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'chapters',
    where: {
      and: [
        { slug: { equals: slug } },
        { status: { equals: 'published' } },
        { isActive: { equals: true } },
      ],
    },
    limit: 1,
    pagination: false,
    depth: 1,
    overrideAccess: false,
  })

  const chapter = result.docs?.[0]
  if (!chapter) return null

  // Verify parent course is published+active (hierarchy invariant)
  const courseId = typeof chapter.course === 'string' ? chapter.course : chapter.course?.id

  if (!courseId) return null

  const courseResult = await payload.findByID({
    collection: 'courses',
    id: courseId,
    depth: 0,
    overrideAccess: false,
    disableErrors: true,
  })

  if (!courseResult || courseResult.status !== 'published' || !courseResult.isActive) {
    return null
  }

  return chapter
})

/**
 * Fetch chapters by grade level (filters by courseLabel)
 */
export const queryChaptersByGrade = cache(
  async ({ gradeLevel, locale }: { gradeLevel: string; locale?: ContentLocale }) => {
    const payload = await getPayload({ config: configPromise })

    const conditions: Where[] = [
      { courseLabel: { equals: gradeLevel } },
      { status: { equals: 'published' } },
      { isActive: { equals: true } },
    ]

    if (locale) {
      conditions.push({ locale: { equals: locale } })
    }

    // Find course for this grade
    const courseResult = await payload.find({
      collection: 'courses',
      where: { and: conditions },
      limit: 1,
      pagination: false,
      overrideAccess: false,
    })

    const course = courseResult.docs?.[0]
    if (!course) return []

    // Reuse existing function
    return queryChaptersByCourse({ courseId: course.id })
  },
)
