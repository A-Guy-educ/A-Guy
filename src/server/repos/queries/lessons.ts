import { cache } from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { queryChaptersByCourse } from './chapters'

export const queryLessonsByChapter = cache(async ({ chapterId }: { chapterId: string }) => {
  const payload = await getPayload({ config: configPromise })

  // First verify the chapter is published+active and its course is published+active
  const chapterResult = await payload.findByID({
    collection: 'chapters',
    id: chapterId,
    depth: 0,
    overrideAccess: false,
  })

  if (!chapterResult || chapterResult.status !== 'published' || !chapterResult.isActive) {
    return []
  }

  // Verify parent chapter's course is published+active (hierarchy invariant)
  // chapterResult.course is an ID when using depth: 0
  const courseId =
    typeof chapterResult.course === 'string' ? chapterResult.course : chapterResult.course?.id

  if (!courseId) return []

  const courseResult = await payload.findByID({
    collection: 'courses',
    id: courseId,
    depth: 0,
    overrideAccess: false,
  })

  if (!courseResult || courseResult.status !== 'published' || !courseResult.isActive) {
    return []
  }

  const result = await payload.find({
    collection: 'lessons',
    where: {
      and: [
        {
          chapter: {
            equals: chapterId,
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

export const queryLessonBySlug = cache(async ({ slug }: { slug: string }) => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'lessons',
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

  const lesson = result.docs?.[0]
  console.log('[queryLessonBySlug DEBUG] slug:', slug, 'found:', !!lesson)
  if (!lesson) return null

  // Verify parent chapter is published+active
  const chapterId = typeof lesson.chapter === 'string' ? lesson.chapter : lesson.chapter?.id
  console.log('[queryLessonBySlug DEBUG] chapterId:', chapterId)

  if (!chapterId) return null

  const chapterResult = await payload.findByID({
    collection: 'chapters',
    id: chapterId,
    depth: 0,
    overrideAccess: false,
  })

  console.log(
    '[queryLessonBySlug DEBUG] chapterResult:',
    chapterResult?.id,
    'status:',
    chapterResult?.status,
    'isActive:',
    chapterResult?.isActive,
  )
  if (!chapterResult || chapterResult.status !== 'published' || !chapterResult.isActive) {
    return null
  }

  // Verify grandparent course is published+active (hierarchy invariant)
  const courseId =
    typeof chapterResult.course === 'string' ? chapterResult.course : chapterResult.course?.id

  console.log('[queryLessonBySlug DEBUG] courseId:', courseId)

  if (!courseId) return null

  const courseResult = await payload.findByID({
    collection: 'courses',
    id: courseId,
    depth: 0,
    overrideAccess: false,
  })

  console.log(
    '[queryLessonBySlug DEBUG] courseResult:',
    courseResult?.id,
    'status:',
    courseResult?.status,
    'isActive:',
    courseResult?.isActive,
  )

  if (!courseResult || courseResult.status !== 'published' || !courseResult.isActive) {
    return null
  }

  console.log('[queryLessonBySlug DEBUG] returning lesson:', lesson.id)
  return lesson
})

/**
 * Get all lessons for a course, organized by chapters
 * This is a helper function to maintain backward compatibility while transitioning to chapter-based hierarchy
 */
export const queryLessonsByCourse = cache(async ({ courseId }: { courseId: string }) => {
  const payload = await getPayload({ config: configPromise })

  // First verify the course is published+active (hierarchy invariant)
  const courseResult = await payload.findByID({
    collection: 'courses',
    id: courseId,
    depth: 0,
    overrideAccess: false,
  })

  if (!courseResult || courseResult.status !== 'published' || !courseResult.isActive) {
    return []
  }

  const chapters = await queryChaptersByCourse({ courseId })

  // Get all lessons for all chapters in this course
  const chapterIds = chapters.map((chapter) => chapter.id)

  if (chapterIds.length === 0) {
    return []
  }

  const result = await payload.find({
    collection: 'lessons',
    where: {
      and: [
        {
          chapter: {
            in: chapterIds,
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
