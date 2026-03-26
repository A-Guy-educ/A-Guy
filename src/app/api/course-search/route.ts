import '@/infra/config/server-init'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Course } from '@/payload-types'
import { hasEntitlement } from '@/server/services/entitlement_check'
import { buildExerciseUrl, buildLessonUrl } from '@/server/utils/course-url-builder'
import type { ContentBlock } from '@/server/payload/collections/Exercises/types'

const searchParamsSchema = z.object({
  q: z.string().min(2).max(200),
  courseSlug: z.string().min(1).optional(),
})

interface SearchResultLesson {
  id: string
  title: string
  type: string
  url: string
}

interface SearchResultExercise {
  id: string
  title: string
  lessonTitle: string
  url: string
}

interface SearchResultQuestion {
  id: string
  promptSnippet: string
  exerciseTitle: string
  url: string
}

function resolveId(field: string | { id: string } | null | undefined): string {
  if (!field) return ''
  return typeof field === 'string' ? field : field.id
}

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = searchParamsSchema.safeParse(params)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid parameters', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const { q: query, courseSlug } = parsed.data

  try {
    // If no courseSlug, search across all courses
    if (!courseSlug) {
      const { searchCourseContent } = await import('@/server/repos/queries/course-search')
      const results = await searchCourseContent({ query, limit: 20 })
      const lessons = results
        .filter((r) => r.type === 'lesson')
        .map((r) => ({ id: r.id, title: r.title, type: 'learning', url: r.url }))
      const exercises = results
        .filter((r) => r.type === 'exercise')
        .map((r) => ({ id: r.id, title: r.title, lessonTitle: r.subtitle, url: r.url }))
      return NextResponse.json({
        enrolled: true,
        results: { lessons, exercises, questions: [] },
        total: lessons.length + exercises.length,
      })
    }

    const payload = await getPayload({ config: configPromise })

    // 1. Resolve course
    const courseResult = await payload.find({
      collection: 'courses',
      where: {
        and: [
          { slug: { equals: courseSlug } },
          { status: { equals: 'published' } },
          { isActive: { equals: true } },
        ],
      },
      limit: 1,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    const course = courseResult.docs[0] as Course | undefined
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    // 2. Check enrollment for paid courses
    if (course.accessType === 'paid') {
      const { user } = await payload.auth({ headers: request.headers })

      if (!user) {
        return NextResponse.json({ enrolled: false, results: null, total: 0 })
      }

      const isAdmin = user.collection === 'users' && 'role' in user && user.role === 'admin'
      if (!isAdmin) {
        const entitled = await hasEntitlement({
          payload,
          userId: user.id,
          courseId: course.id,
        })

        if (!entitled) {
          return NextResponse.json({ enrolled: false, results: null, total: 0 })
        }
      }
    }

    // 3. Find all chapters for this course
    const chaptersResult = await payload.find({
      collection: 'chapters',
      where: {
        and: [
          { course: { equals: course.id } },
          { status: { equals: 'published' } },
          { isActive: { equals: true } },
        ],
      },
      limit: 1000,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    const chapters = chaptersResult.docs
    if (chapters.length === 0) {
      return NextResponse.json({
        enrolled: true,
        results: { lessons: [], exercises: [], questions: [] },
        total: 0,
      })
    }

    const chapterIds = chapters.map((ch) => ch.id)
    const chapterMap = new Map(chapters.map((ch) => [ch.id, ch]))

    // 4. Search lessons by title (substring match)
    const lessonsResult = await payload.find({
      collection: 'lessons',
      where: {
        and: [
          { chapter: { in: chapterIds } },
          { status: { equals: 'published' } },
          { isActive: { equals: true } },
          { title: { like: query } },
        ],
      },
      limit: 20,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    const lessonResults: SearchResultLesson[] = lessonsResult.docs.map((lesson) => {
      const chapterId = resolveId(lesson.chapter)
      const chapter = chapterMap.get(chapterId)
      return {
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
        url: buildLessonUrl(courseSlug, chapter?.slug ?? '', lesson.slug ?? ''),
      }
    })

    // 5. Fetch ALL lessons for this course (needed for exercise URL building)
    const allLessonsResult = await payload.find({
      collection: 'lessons',
      where: {
        and: [
          { chapter: { in: chapterIds } },
          { status: { equals: 'published' } },
          { isActive: { equals: true } },
        ],
      },
      limit: 1000,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    const allLessons = allLessonsResult.docs
    const lessonMap = new Map(allLessons.map((l) => [l.id, l]))
    const lessonIds = allLessons.map((l) => l.id)

    // 6. Search exercises by title
    let exerciseResults: SearchResultExercise[] = []
    const questionResults: SearchResultQuestion[] = []

    if (lessonIds.length > 0) {
      const exercisesResult = await payload.find({
        collection: 'exercises',
        where: {
          and: [{ lesson: { in: lessonIds } }, { title: { like: query } }],
        },
        limit: 20,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      })

      exerciseResults = exercisesResult.docs.map((exercise) => {
        const lessonId = resolveId(exercise.lesson)
        const lesson = lessonMap.get(lessonId)
        const chapterId = lesson ? resolveId(lesson.chapter) : ''
        const chapter = chapterMap.get(chapterId)
        return {
          id: exercise.id,
          title: exercise.title || 'Untitled Exercise',
          lessonTitle: lesson?.title ?? '',
          url: buildExerciseUrl(
            courseSlug,
            chapter?.slug ?? '',
            lesson?.slug ?? '',
            exercise.slug ?? '',
          ),
        }
      })

      // 7. Search questions inside exercise content
      const queryLower = query.toLowerCase()
      const exercisesForQuestions = await payload.find({
        collection: 'exercises',
        where: {
          lesson: { in: lessonIds },
        },
        limit: 500,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      })

      for (const exercise of exercisesForQuestions.docs) {
        const content = exercise.content as { blocks?: ContentBlock[] } | null
        if (!content?.blocks) continue

        for (const block of content.blocks) {
          if (!('prompt' in block) || !block.prompt?.value) continue

          const promptValue = block.prompt.value.toLowerCase()
          if (!promptValue.includes(queryLower)) continue

          const lessonId = resolveId(exercise.lesson)
          const lesson = lessonMap.get(lessonId)
          const chapterId = lesson ? resolveId(lesson.chapter) : ''
          const chapter = chapterMap.get(chapterId)

          questionResults.push({
            id: block.id,
            promptSnippet: block.prompt.value.slice(0, 100),
            exerciseTitle: exercise.title || 'Untitled Exercise',
            url: buildExerciseUrl(
              courseSlug,
              chapter?.slug ?? '',
              lesson?.slug ?? '',
              exercise.slug ?? '',
            ),
          })

          if (questionResults.length >= 10) break
        }

        if (questionResults.length >= 10) break
      }
    }

    const total = lessonResults.length + exerciseResults.length + questionResults.length

    return NextResponse.json({
      enrolled: true,
      results: {
        lessons: lessonResults,
        exercises: exerciseResults,
        questions: questionResults,
      },
      total,
    })
  } catch (error) {
    const { captureAndRespond } = await import('@/server/api/capture-and-respond')
    return captureAndRespond(error, { route: '/api/course-search' })
  }
}
