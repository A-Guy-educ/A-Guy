import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Chapter, Lesson } from '@/payload-types'
import { DEFAULT_PAGE_ACCESS_TYPE } from '@/server/constants/access-types'
import { SystemParams } from '@/infra/config/system-params'
import type { ContentLocale } from '@/server/payload/fields/contentLocale'
import { queryChaptersByGrade } from './chapters'

export interface ChapterWithLessons extends Chapter {
  lessons: Lesson[]
}

export interface StudyData {
  chapters: ChapterWithLessons[]
  courseSlug: string
  courseId: string
  courseTitle: string
  courseLabel: string
  coursePageAccessType: string
  gatedDelayMs: number
  gatedWarningMs: number
}

/**
 * Fetch all data needed by the /study page for a given grade.
 * Used by both the server component (direct call) and the API route (backward compat).
 */
export async function fetchStudyData({
  gradeLevel,
  locale,
}: {
  gradeLevel: string
  locale?: ContentLocale
}): Promise<StudyData | null> {
  const chapters = await queryChaptersByGrade({ gradeLevel, locale })
  if (chapters.length === 0) return null

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

  // Fetch lessons + system params in parallel
  const chapterIds = chapters.map((chapter) => chapter.id)

  const fetchLessons = async () => {
    if (chapterIds.length === 0) return []
    const payload = await getPayload({ config: configPromise })
    const lessonsResult = await payload.find({
      collection: 'lessons',
      where: {
        and: [
          { chapter: { in: chapterIds } },
          { status: { equals: 'published' } },
          { isActive: { equals: true } },
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
      depth: 0,
      select: {
        title: true,
        slug: true,
        chapter: true,
        order: true,
        type: true,
      },
    })
    return lessonsResult.docs as Lesson[]
  }

  const [lessons, gatedDelayMs, gatedWarningMs] = await Promise.all([
    fetchLessons(),
    SystemParams.getGatedDelayMs(),
    SystemParams.getGatedWarningMs(),
  ])

  // Group lessons by chapter
  const lessonsByChapter: Record<string, Lesson[]> = {}
  for (const lesson of lessons) {
    const chapterId = typeof lesson.chapter === 'string' ? lesson.chapter : lesson.chapter?.id
    if (chapterId) {
      if (!lessonsByChapter[chapterId]) {
        lessonsByChapter[chapterId] = []
      }
      lessonsByChapter[chapterId].push(lesson)
    }
  }

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
    gatedDelayMs,
    gatedWarningMs,
  }
}
