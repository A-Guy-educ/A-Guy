import { NextRequest, NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'
import configPromise from '@payload-config'
import type { Lesson } from '@/payload-types'
import { logger } from '@/utilities/logger'
import {
  RequestTiming,
  getFilterShapeKeys,
  timeDbOperation,
} from '@/utilities/perf/request-timing'

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const timing = new RequestTiming({ requestId, endpoint: '/api/chapters/by-grade', logger })
  timing.markPoint('handler_entry')

  const searchParams = request.nextUrl.searchParams
  const grade = searchParams.get('grade')

  if (!grade) {
    const { result: response } = timing.timeSync('serialization', () =>
      NextResponse.json({ error: 'Grade parameter is required' }, { status: 400 }),
    )
    timing.markPoint('handler_exit')
    timing.logIfSlow()
    return response
  }

  try {
    const { result: payload } = await timing.time('db_connect', () =>
      getPayload({ config: configPromise }),
    )

    const courseWhere: Where = {
      and: [
        { courseLabel: { equals: grade } },
        { status: { equals: 'published' } },
        { isActive: { equals: true } },
      ],
    }

    const courseResult = await timeDbOperation(
      timing,
      {
        stage: 'db_query:courses_by_grade',
        collection: 'courses',
        filterKeys: getFilterShapeKeys(courseWhere),
        limit: 1,
        sort: undefined,
        logger,
        requestId,
        endpoint: '/api/chapters/by-grade',
      },
      () =>
        payload.find({
          collection: 'courses',
          where: courseWhere,
          limit: 1,
          pagination: false,
        }),
    )

    const course = courseResult.docs?.[0]
    if (!course) {
      const { result: response } = timing.timeSync('serialization', () =>
        NextResponse.json({ chapters: [], courseSlug: '' }),
      )
      timing.markPoint('handler_exit')
      timing.logIfSlow()
      return response
    }

    const chaptersWhere: Where = {
      and: [
        {
          course: {
            equals: course.id,
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
    }

    const chaptersResult = await timeDbOperation(
      timing,
      {
        stage: 'db_query:chapters_by_course',
        collection: 'chapters',
        filterKeys: getFilterShapeKeys(chaptersWhere),
        limit: 1000,
        sort: 'order',
        logger,
        requestId,
        endpoint: '/api/chapters/by-grade',
      },
      () =>
        payload.find({
          collection: 'chapters',
          where: chaptersWhere,
          sort: 'order',
          limit: 1000,
          pagination: false,
          depth: 2,
        }),
    )

    const chapters = chaptersResult.docs
    const courseSlug = typeof course.slug === 'string' ? course.slug : ''

    // Fetch all lessons for all chapters (batch query for efficiency)
    const chapterIds = chapters.map((chapter) => chapter.id)
    let lessons: Lesson[] = []

    if (chapterIds.length > 0) {
      const lessonsWhere: Where = {
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
      }

      const lessonsResult = await timeDbOperation(
        timing,
        {
          stage: 'db_query:lessons_by_chapter_ids',
          collection: 'lessons',
          filterKeys: getFilterShapeKeys(lessonsWhere),
          limit: 1000,
          sort: 'order',
          logger,
          requestId,
          endpoint: '/api/chapters/by-grade',
        },
        () =>
          payload.find({
            collection: 'lessons',
            where: lessonsWhere,
            sort: 'order',
            limit: 1000,
            pagination: false,
            depth: 2,
          }),
      )
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

    const { result: response } = timing.timeSync('serialization', () =>
      NextResponse.json({
        chapters: chaptersWithLessons,
        courseSlug,
      }),
    )
    timing.markPoint('handler_exit')
    timing.logIfSlow()
    return response
  } catch (error) {
    console.error('Error fetching chapters:', error)
    const { result: response } = timing.timeSync('serialization', () =>
      NextResponse.json({ error: 'Failed to fetch chapters' }, { status: 500 }),
    )
    timing.markPoint('handler_exit')
    timing.logIfSlow()
    return response
  }
}
