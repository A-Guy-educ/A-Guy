import { NextRequest, NextResponse } from 'next/server'
import { queryChaptersByGrade } from '@/lib/queries/chapters'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Lesson } from '@/payload-types'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const grade = searchParams.get('grade')

  if (!grade) {
    return NextResponse.json({ error: 'Grade parameter is required' }, { status: 400 })
  }

  try {
    const chapters = await queryChaptersByGrade({ gradeLevel: grade })
    const course = chapters[0]?.course
    const courseSlug =
      typeof course === 'object' && course !== null && 'slug' in course ? course.slug : ''

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

    return NextResponse.json({
      chapters: chaptersWithLessons,
      courseSlug,
    })
  } catch (error) {
    console.error('Error fetching chapters:', error)
    return NextResponse.json({ error: 'Failed to fetch chapters' }, { status: 500 })
  }
}
