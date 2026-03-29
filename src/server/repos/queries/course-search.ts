import { cache } from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { buildExerciseUrl, buildLessonUrl } from '@/server/utils/course-url-builder'

interface SearchResult {
  id: string
  title: string
  subtitle: string
  url: string
  type: 'course' | 'lesson' | 'exercise'
}

/**
 * Search across all published courses, lessons, and exercises.
 * Used on the general /search page and the header dropdown (not scoped to a single course).
 */
export const searchCourseContent = cache(
  async ({ query, limit = 20 }: { query: string; limit?: number }): Promise<SearchResult[]> => {
    const payload = await getPayload({ config: configPromise })
    const results: SearchResult[] = []

    // 1. Search courses by title
    const coursesResult = await payload.find({
      collection: 'courses',
      where: {
        and: [
          { title: { like: query } },
          { status: { equals: 'published' } },
          { isActive: { equals: true } },
        ],
      },
      limit: 10,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    for (const course of coursesResult.docs) {
      if (!course.slug) continue
      results.push({
        id: course.id,
        title: course.title,
        subtitle: '',
        url: `/courses/${course.slug}`,
        type: 'course',
      })
    }

    // 2. Search lessons by title
    const lessonsResult = await payload.find({
      collection: 'lessons',
      where: {
        and: [
          { title: { like: query } },
          { status: { equals: 'published' } },
          { isActive: { equals: true } },
        ],
      },
      limit,
      pagination: false,
      depth: 2,
      overrideAccess: true,
    })

    for (const lesson of lessonsResult.docs) {
      const chapter = typeof lesson.chapter === 'object' && lesson.chapter ? lesson.chapter : null
      const course =
        chapter && typeof chapter.course === 'object' && chapter.course ? chapter.course : null

      if (!course?.slug || !chapter?.slug || !lesson.slug) continue

      results.push({
        id: lesson.id,
        title: lesson.title,
        subtitle: course.title ?? '',
        url: buildLessonUrl(course.slug, chapter.slug, lesson.slug),
        type: 'lesson',
      })
    }

    // 2. Search exercises by title
    const exercisesResult = await payload.find({
      collection: 'exercises',
      where: {
        title: { like: query },
      },
      limit,
      pagination: false,
      depth: 3,
      overrideAccess: true,
    })

    for (const exercise of exercisesResult.docs) {
      const lesson = typeof exercise.lesson === 'object' && exercise.lesson ? exercise.lesson : null
      const chapter =
        lesson && typeof lesson.chapter === 'object' && lesson.chapter ? lesson.chapter : null
      const course =
        chapter && typeof chapter.course === 'object' && chapter.course ? chapter.course : null

      if (!course?.slug || !chapter?.slug || !lesson?.slug || !exercise.slug) continue

      results.push({
        id: exercise.id,
        title: exercise.title || 'Untitled Exercise',
        subtitle: lesson.title ?? '',
        url: buildExerciseUrl(course.slug, chapter.slug, lesson.slug, exercise.slug),
        type: 'exercise',
      })
    }

    return results.slice(0, limit)
  },
)
