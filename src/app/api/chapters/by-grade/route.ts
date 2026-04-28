import '@/infra/config/server-init'

import { NextRequest, NextResponse } from 'next/server'
import { queryChaptersByGrade } from '@/server/repos/queries/chapters'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Lesson } from '@/payload-types'
import { DEFAULT_ACCESS_TYPE, DEFAULT_PAGE_ACCESS_TYPE } from '@/server/constants/access-types'
import { SystemParams } from '@/infra/config/system-params'
import { isValidContentLocale, localeWhereClause } from '@/server/payload/fields/contentLocale'
import type { ContentLocale } from '@/server/payload/fields/contentLocale'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const grade = searchParams.get('grade')
  const localeParam = searchParams.get('locale')

  if (!grade) {
    return NextResponse.json({ error: 'Grade parameter is required' }, { status: 400 })
  }

  const locale =
    localeParam && isValidContentLocale(localeParam) ? (localeParam as ContentLocale) : undefined

  const lessonTypeParam = searchParams.get('lessonType')
  const VALID_LESSON_TYPES = ['learning', 'practice', 'exam'] as const
  const lessonType =
    lessonTypeParam &&
    VALID_LESSON_TYPES.includes(lessonTypeParam as (typeof VALID_LESSON_TYPES)[number])
      ? (lessonTypeParam as 'learning' | 'practice' | 'exam')
      : 'practice'

  try {
    // Fetch chapters and system params in parallel — they're independent
    const [chapters, [gatedDelayMs, gatedWarningMs]] = await Promise.all([
      queryChaptersByGrade({ gradeLevel: grade, locale }),
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

    // Fetch all lessons for all chapters (batch query for efficiency)
    const chapterIds = chapters.map((chapter) => chapter.id)
    let lessons: Lesson[] = []

    if (chapterIds.length > 0) {
      const payload = await getPayload({ config: configPromise })
      const lessonsResult = await payload.find({
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
            {
              type: {
                equals: lessonType,
              },
            },
            ...(locale ? [localeWhereClause(locale)] : []),
          ],
        },
        sort: 'order',
        limit: 1000,
        pagination: false,
        depth: 2,
      })
      lessons = lessonsResult.docs
    }

    // Group lessons by chapter
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

    // Attach lessons to chapters
    const chaptersWithLessons = chapters.map((chapter) => ({
      ...chapter,
      lessons: lessonsByChapter[chapter.id] || [],
    }))

    const response = NextResponse.json({
      chapters: chaptersWithLessons,
      courseSlug,
      courseId,
      courseTitle,
      courseLabel,
      coursePageAccessType,
      courseAccessType,
      gatedDelayMs,
      gatedWarningMs,
    })

    // Cache for 60s on CDN, serve stale up to 5min while revalidating
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')

    return response
  } catch (error) {
    const { captureAndRespond } = await import('@/server/api/capture-and-respond')
    return captureAndRespond(error, { route: '/api/chapters/by-grade' })
  }
}
