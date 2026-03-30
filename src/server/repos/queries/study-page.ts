import { cache } from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Chapter, Lesson } from '@/payload-types'
import { DEFAULT_ACCESS_TYPE, DEFAULT_PAGE_ACCESS_TYPE } from '@/server/constants/access-types'
import { SystemParams } from '@/infra/config/system-params'
import type { ContentLocale } from '@/server/payload/fields/contentLocale'
import { queryChaptersByGrade } from './chapters'

export interface PrefetchedStudyData {
  chapters: Array<Chapter & { lessons: Lesson[] }>
  courseSlug: string
  courseId: string
  courseTitle: string
  courseLabel: string
  coursePageAccessType: string
  courseAccessType: string
  gatedDelayMs?: number
  gatedWarningMs?: number
}

/**
 * Server-side prefetch for study page data.
 * Mirrors /api/chapters/by-grade but runs as direct DB access (no HTTP round-trip).
 */
export const prefetchStudyData = cache(
  async (gradeLevel: string, locale?: ContentLocale): Promise<PrefetchedStudyData | null> => {
    try {
      const [chapters, [gatedDelayMs, gatedWarningMs]] = await Promise.all([
        queryChaptersByGrade({ gradeLevel, locale }),
        Promise.all([SystemParams.getGatedDelayMs(), SystemParams.getGatedWarningMs()]),
      ])

      const course = chapters[0]?.course
      const courseObj = typeof course === 'object' && course !== null ? course : null
      const courseSlug = courseObj && 'slug' in courseObj ? (courseObj.slug as string) : ''
      const courseId = courseObj && 'id' in courseObj ? (courseObj.id as string) : ''
      const courseTitle = courseObj && 'title' in courseObj ? (courseObj.title as string) : ''
      const courseLabel =
        courseObj && 'courseLabel' in courseObj ? (courseObj.courseLabel as string) : ''
      const coursePageAccessType =
        courseObj && 'pageAccessType' in courseObj
          ? (courseObj.pageAccessType ?? DEFAULT_PAGE_ACCESS_TYPE)
          : DEFAULT_PAGE_ACCESS_TYPE
      const courseAccessType =
        courseObj && 'accessType' in courseObj
          ? (courseObj.accessType ?? DEFAULT_ACCESS_TYPE)
          : DEFAULT_ACCESS_TYPE

      const chapterIds = chapters.map((chapter) => chapter.id)
      let lessons: Lesson[] = []

      if (chapterIds.length > 0) {
        const payload = await getPayload({ config: configPromise })
        const lessonsResult = await payload.find({
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
          depth: 2,
        })
        lessons = lessonsResult.docs
      }

      const lessonsByChapter: Record<string, Lesson[]> = {}
      lessons.forEach((lesson) => {
        const chapterId = typeof lesson.chapter === 'string' ? lesson.chapter : lesson.chapter?.id
        if (chapterId) {
          if (!lessonsByChapter[chapterId]) {
            lessonsByChapter[chapterId] = []
          }
          lessonsByChapter[chapterId].push(lesson)
        }
      })

      const chaptersWithLessons = chapters.map((chapter) => ({
        ...chapter,
        lessons: lessonsByChapter[chapter.id] || [],
      }))

      return {
        chapters: chaptersWithLessons,
        courseSlug,
        courseId,
        courseTitle,
        courseLabel,
        coursePageAccessType,
        courseAccessType,
        gatedDelayMs,
        gatedWarningMs,
      }
    } catch {
      return null
    }
  },
)
