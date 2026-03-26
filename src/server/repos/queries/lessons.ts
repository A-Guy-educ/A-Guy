import { cache } from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { queryChaptersByCourse } from './chapters'

export const queryLessonsByChapter = cache(async ({ chapterId }: { chapterId: string }) => {
  const payload = await getPayload({ config: configPromise })

  // Verify chapter is published+active
  const chapterResult = await payload.findByID({
    collection: 'chapters',
    id: chapterId,
    depth: 0,
    overrideAccess: false,
    disableErrors: true,
  })

  if (!chapterResult || chapterResult.status !== 'published' || !chapterResult.isActive) {
    return []
  }

  // Verify parent course and fetch lessons in parallel — both depend only on chapter data
  const courseId =
    typeof chapterResult.course === 'string' ? chapterResult.course : chapterResult.course?.id

  if (!courseId) return []

  const [courseResult, lessonsResult] = await Promise.all([
    payload.findByID({
      collection: 'courses',
      id: courseId,
      depth: 0,
      overrideAccess: false,
      disableErrors: true,
    }),
    payload.find({
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
          // Exclude "Soon" content that is not visible to students
          {
            or: [
              { contentStatus: { not_equals: 'soon' } },
              { contentStatusVisible: { equals: true } },
            ],
          },
        ],
      },
      sort: 'order',
      limit: 1000,
      pagination: false,
      depth: 1,
      overrideAccess: false,
    }),
  ])

  if (!courseResult || courseResult.status !== 'published' || !courseResult.isActive) {
    return []
  }

  return lessonsResult.docs
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
        // Exclude "Soon" content that is not visible to students
        {
          or: [
            { contentStatus: { not_equals: 'soon' } },
            { contentStatusVisible: { equals: true } },
          ],
        },
      ],
    },
    limit: 1,
    pagination: false,
    depth: 1,
    overrideAccess: false,
  })

  const lesson = result.docs?.[0]
  if (!lesson) return null

  // Verify parent chapter is published+active
  // lesson.chapter is populated (depth: 1), so check directly when possible
  const chapterObj =
    typeof lesson.chapter === 'object' && lesson.chapter !== null ? lesson.chapter : null
  const chapterId = chapterObj?.id ?? (typeof lesson.chapter === 'string' ? lesson.chapter : null)

  if (!chapterId) return null

  // If chapter is populated, validate inline and skip the extra DB call
  if (chapterObj && 'status' in chapterObj) {
    if (chapterObj.status !== 'published' || !chapterObj.isActive) return null

    const courseId =
      typeof chapterObj.course === 'string' ? chapterObj.course : chapterObj.course?.id
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

    return lesson
  }

  // Fallback: chapter not populated, fetch it
  const chapterResult = await payload.findByID({
    collection: 'chapters',
    id: chapterId,
    depth: 0,
    overrideAccess: false,
    disableErrors: true,
  })

  if (!chapterResult || chapterResult.status !== 'published' || !chapterResult.isActive) {
    return null
  }

  const courseId =
    typeof chapterResult.course === 'string' ? chapterResult.course : chapterResult.course?.id

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
    disableErrors: true,
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
        // Exclude "Soon" content that is not visible to students
        {
          or: [
            { contentStatus: { not_equals: 'soon' } },
            { contentStatusVisible: { equals: true } },
          ],
        },
      ],
    },
    sort: 'order',
    limit: 1000,
    pagination: false,
    depth: 1,
    overrideAccess: false,
  })

  // Sort lessons by chapter order (primary) then by lesson order (secondary)
  // This ensures lessons are grouped by chapter and ordered correctly within each chapter
  // chapters is already sorted by chapter.order (from queryChaptersByCourse)
  const chapterOrderMap = new Map(chapters.map((ch, idx) => [ch.id, idx]))

  const sortedDocs = [...result.docs].sort((a, b) => {
    const chapterIdA = typeof a.chapter === 'string' ? a.chapter : a.chapter?.id
    const chapterIdB = typeof b.chapter === 'string' ? b.chapter : b.chapter?.id

    const chapterOrderA = chapterOrderMap.get(chapterIdA ?? '') ?? Infinity
    const chapterOrderB = chapterOrderMap.get(chapterIdB ?? '') ?? Infinity

    // Primary sort: by chapter order
    if (chapterOrderA !== chapterOrderB) {
      return chapterOrderA - chapterOrderB
    }

    // Secondary sort: by lesson order within the same chapter
    // Treat undefined order as Infinity so lessons with defined order come first
    const orderA = a.order !== undefined ? a.order : Infinity
    const orderB = b.order !== undefined ? b.order : Infinity
    return orderA - orderB
  })

  return sortedDocs
})
