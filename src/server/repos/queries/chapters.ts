import { cache } from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export const queryChaptersByCourse = cache(async ({ courseId }: { courseId: string }) => {
  const payload = await getPayload({ config: configPromise })

  // First verify the course is published+active (hierarchy invariant)
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
        {
          course: {
            equals: courseId,
          },
        },
        {
          status: {
            equals: 'published',
          },
        },
        {
          isActive: {
            equals: true,
          },
        },
      ],
    },
    sort: 'order',
    limit: 1000,
    pagination: false,
    depth: 1,
    overrideAccess: false,
  })

  return result.docs
})

export const queryChapterBySlug = cache(async ({ slug }: { slug: string }) => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'chapters',
    where: {
      and: [
        {
          slug: {
            equals: slug,
          },
        },
        {
          status: {
            equals: 'published',
          },
        },
        {
          isActive: {
            equals: true,
          },
        },
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
  // chapter.course could be a string ID or populated object (due to depth: 1)
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
 *
 * Note: Locale filtering is NOT applied to the course query here.
 * Courses are found by courseLabel (grade) alone — locale filtering
 * is applied at the lesson level in prefetchStudyData. This prevents
 * the study page from showing empty state when the user's contentLocale
 * differs from the course's locale (e.g., user in 'en' locale viewing
 * a course with locale 'he').
 */
export const queryChaptersByGrade = cache(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async ({ gradeLevel }: { gradeLevel: string; locale?: string }) => {
    const payload = await getPayload({ config: configPromise })

    // Find course for this grade — no locale filter on courses.
    // The course is selected by courseLabel (grade level), not locale.
    // Sort by _id to ensure deterministic ordering (first-created course first).
    const courseResult = await payload.find({
      collection: 'courses',
      where: {
        and: [
          { courseLabel: { equals: gradeLevel } },
          { status: { equals: 'published' } },
          { isActive: { equals: true } },
        ],
      },
      sort: '_id',
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
