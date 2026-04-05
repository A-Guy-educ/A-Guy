/**
 * @fileType api-route
 * @domain courses
 * @pattern course-syllabus
 * @ai-summary Returns full syllabus (chapters + lessons) for a course
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { queryChaptersByCourse } from '@/server/repos/queries/chapters'
import { queryLessonsByChapter } from '@/server/repos/queries/lessons'
import { buildLessonUrl } from '@/server/utils/course-url-builder'

const QuerySchema = z.object({
  courseId: z.string().min(1),
})

export async function GET(request: NextRequest) {
  try {
    const courseIdParam = request.nextUrl.searchParams.get('courseId')
    const parsed = QuerySchema.safeParse({ courseId: courseIdParam })

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'courseId is required' }, { status: 400 })
    }

    const { courseId } = parsed.data

    const chapters = await queryChaptersByCourse({ courseId })

    // Build syllabus with all nested data
    const syllabus = await Promise.all(
      chapters.map(async (chapter) => {
        // chapter.course is populated at depth: 1, giving us courseSlug directly
        const courseSlug =
          typeof chapter.course === 'object' && chapter.course !== null
            ? ((chapter.course as { slug?: string }).slug ?? '')
            : ''

        const lessons = await queryLessonsByChapter({ chapterId: chapter.id })

        return {
          chapterId: chapter.id,
          chapterLabel: chapter.chapterLabel ?? '',
          chapterTitle: chapter.title ?? '',
          chapterSlug: chapter.slug ?? '',
          lessons: lessons.map((lesson) => ({
            lessonId: lesson.id,
            lessonTitle: lesson.title ?? '',
            lessonSlug: lesson.slug ?? '',
            lessonOrder: lesson.order ?? 0,
            lessonType: lesson.type ?? 'learning',
            lessonUrl: buildLessonUrl(courseSlug, chapter.slug ?? '', lesson.slug ?? ''),
          })),
        }
      }),
    )

    return NextResponse.json({ success: true, data: syllabus })
  } catch (error) {
    console.error('[/api/course-syllabus]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
