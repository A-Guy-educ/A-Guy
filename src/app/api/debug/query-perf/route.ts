import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

// Inline timer to avoid lint restriction on importing from repos/queries in route handlers
function createTimer() {
  const entries: Array<{ name: string; durationMs: number }> = []
  return {
    async time<T>(name: string, fn: () => Promise<T>): Promise<T> {
      const start = performance.now()
      const result = await fn()
      entries.push({ name, durationMs: Math.round(performance.now() - start) })
      return result
    },
    header(): string {
      return entries.map((e) => `${e.name};dur=${e.durationMs}`).join(', ')
    },
    entries() {
      return entries
    },
    totalMs(): number {
      return entries.reduce((sum, e) => sum + e.durationMs, 0)
    },
  }
}

/**
 * Debug endpoint to measure query performance for course page loads.
 * NOT for production use — disable or protect behind auth in prod.
 *
 * Usage:
 *   GET /api/debug/query-perf?courseSlug=course-8
 *   GET /api/debug/query-perf?courseSlug=course-8&lessonSlug=lesson-1
 *
 * Returns timing breakdown for each DB query.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_DEBUG_ENDPOINTS) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const courseSlug = searchParams.get('courseSlug')

  if (!courseSlug) {
    return NextResponse.json({ error: 'courseSlug query param required' }, { status: 400 })
  }

  const lessonSlug = searchParams.get('lessonSlug')
  const timer = createTimer()
  const payload = await timer.time('getPayload', () => getPayload({ config: configPromise }))

  // 1. Course query
  const course = await timer.time('queryCourse', () =>
    payload.find({
      collection: 'courses',
      where: {
        and: [
          { slug: { equals: courseSlug } },
          { status: { equals: 'published' } },
          { isActive: { equals: true } },
        ],
      },
      limit: 1,
      depth: 1,
    }),
  )

  const courseDoc = course.docs[0]
  if (!courseDoc) {
    return NextResponse.json(
      { error: 'Course not found', timings: timer.entries() },
      { status: 404 },
    )
  }

  // 2. Chapters query
  const chapters = await timer.time('queryChapters', () =>
    payload.find({
      collection: 'chapters',
      where: {
        and: [
          { course: { equals: courseDoc.id } },
          { status: { equals: 'published' } },
          { isActive: { equals: true } },
        ],
      },
      sort: 'order',
      limit: 1000,
      pagination: false,
      depth: 0,
    }),
  )

  const chapterIds = chapters.docs.map((c) => c.id)

  // 3. Lessons query
  const lessons = await timer.time('queryLessons', () =>
    payload.find({
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
    }),
  )

  // 4. Optional: lesson + exercises
  let exerciseTimings = null
  if (lessonSlug) {
    const lessonDoc = lessons.docs.find((l) => l.slug === lessonSlug)
    if (lessonDoc) {
      const exercises = await timer.time('queryExercises', () =>
        payload.find({
          collection: 'exercises',
          where: { lesson: { equals: lessonDoc.id } },
          sort: 'order',
          limit: 1000,
          pagination: false,
          depth: 0,
        }),
      )
      exerciseTimings = { count: exercises.docs.length }
    }
  }

  const entries = timer.entries()
  const totalMs = timer.totalMs()

  return NextResponse.json(
    {
      summary: {
        totalMs,
        courseTitle: courseDoc.title,
        chaptersCount: chapters.docs.length,
        lessonsCount: lessons.docs.length,
        ...(exerciseTimings ? { exercisesCount: exerciseTimings.count } : {}),
      },
      timings: entries,
      breakdown: entries.map((e) => `${e.name}: ${e.durationMs}ms`),
    },
    {
      headers: { 'Server-Timing': timer.header() },
    },
  )
}
