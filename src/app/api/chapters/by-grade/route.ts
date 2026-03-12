import '@/infra/config/server-init'

import { NextRequest, NextResponse } from 'next/server'
import { queryChaptersByGrade } from '@/server/repos/queries/chapters'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Lesson } from '@/payload-types'
import { DEFAULT_PAGE_ACCESS_TYPE } from '@/server/constants/access-types'
import { SystemParams } from '@/infra/config/system-params'
import { isValidContentLocale } from '@/server/payload/fields/contentLocale'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const grade = searchParams.get('grade')
  const localeParam = searchParams.get('locale')

  if (!grade) {
    return NextResponse.json({ error: 'Grade parameter is required' }, { status: 400 })
  }

  const locale = localeParam && isValidContentLocale(localeParam) ? localeParam : undefined

  try {
    const chapters = await queryChaptersByGrade({ gradeLevel: grade, locale })
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

    // Fetch lessons + system params in parallel (independent of each other)
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
      gatedDelayMs,
      gatedWarningMs,
    })
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
    return response
  } catch (error) {
    const { captureAndRespond } = await import('@/server/api/capture-and-respond')
    return captureAndRespond(error, { route: '/api/chapters/by-grade' })
  }
}
