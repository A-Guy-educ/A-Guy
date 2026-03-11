import { cache } from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { queryChaptersByCourse } from './chapters'

const QUERY_CACHE_TTL = 60 // seconds

const _queryLessonsByChapter = async (chapterId: string) => {
  const payload = await getPayload({ config: configPromise })

  // Verify the chapter is published+active and its course is published+active
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

  // Verify parent chapter's course is published+active (hierarchy invariant)
  const courseId =
    typeof chapterResult.course === 'string' ? chapterResult.course : chapterResult.course?.id

  if (!courseId) return []

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
    collection: 'lessons',
    where: {
      and: [
        { chapter: { equals: chapterId } },
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

export const queryLessonsByChapter = async ({ chapterId }: { chapterId: string }) => {
  const cached = unstable_cache(_queryLessonsByChapter, ['lessons-by-chapter', chapterId], {
    revalidate: QUERY_CACHE_TTL,
    tags: ['lessons'],
  })
  return cached(chapterId)
}

/**
 * Fetch lessons for a chapter WITHOUT re-validating the parent hierarchy.
 * Use ONLY from pages that have already verified the chapter and course are published+active.
 * Saves 2 DB queries per call vs queryLessonsByChapter.
 */
const _queryLessonsByChapterDirectly = async (chapterId: string) => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'lessons',
    where: {
      and: [
        { chapter: { equals: chapterId } },
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

export const queryLessonsByChapterDirectly = async ({ chapterId }: { chapterId: string }) => {
  const cached = unstable_cache(
    _queryLessonsByChapterDirectly,
    ['lessons-by-chapter-direct', chapterId],
    { revalidate: QUERY_CACHE_TTL, tags: ['lessons'] },
  )
  return cached(chapterId)
}

export const queryLessonBySlug = cache(async ({ slug }: { slug: string }) => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'lessons',
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

  const lesson = result.docs?.[0]
  if (!lesson) return null

  // Verify parent chapter is published+active
  const chapterId = typeof lesson.chapter === 'string' ? lesson.chapter : lesson.chapter?.id

  if (!chapterId) return null

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

  // Verify grandparent course is published+active (hierarchy invariant)
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
 * Fetch a lesson by slug WITHOUT hierarchy validation.
 * Use ONLY from pages that separately verify the course + chapter hierarchy.
 * Saves 2 DB queries (chapter + course validation) vs queryLessonBySlug.
 */
export const queryLessonBySlugDirectly = cache(async ({ slug }: { slug: string }) => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'lessons',
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

  return result.docs?.[0] || null
})

/**
 * Get all lessons for a course, organized by chapters
 */
const _queryLessonsByCourse = async (courseId: string) => {
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

  const chapters = await queryChaptersByCourse({ courseId })

  const chapterIds = chapters.map((chapter) => chapter.id)

  if (chapterIds.length === 0) {
    return []
  }

  const result = await payload.find({
    collection: 'lessons',
    where: {
      and: [
        { chapter: { in: chapterIds } },
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

export const queryLessonsByCourse = async ({ courseId }: { courseId: string }) => {
  const cached = unstable_cache(_queryLessonsByCourse, ['lessons-by-course', courseId], {
    revalidate: QUERY_CACHE_TTL,
    tags: ['lessons'],
  })
  return cached(courseId)
}

/**
 * Fetch all lessons for a course WITHOUT re-validating the parent course.
 * Use ONLY from pages that have already verified the course is published+active.
 * Uses queryChaptersByCourseDirectly internally.
 */
const _queryLessonsByCourseDirectly = async (courseId: string) => {
  const { queryChaptersByCourseDirectly } = await import('./chapters')
  const chapters = await queryChaptersByCourseDirectly({ courseId })

  const chapterIds = chapters.map((chapter) => chapter.id)

  if (chapterIds.length === 0) {
    return []
  }

  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'lessons',
    where: {
      and: [
        { chapter: { in: chapterIds } },
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

export const queryLessonsByCourseDirectly = async ({ courseId }: { courseId: string }) => {
  const cached = unstable_cache(
    _queryLessonsByCourseDirectly,
    ['lessons-by-course-direct', courseId],
    { revalidate: QUERY_CACHE_TTL, tags: ['lessons'] },
  )
  return cached(courseId)
}
