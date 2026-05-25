// @vitest-environment node
/**
 * Integration test: contradictory empty state between /study and /practice
 *
 * Reproduces issue #1993: When the server-side prefetch fails (no grade cookie),
 * the client-side StudyContent falls back to calling /api/chapters/by-grade.
 * The bug: this API call does NOT pass the lessonType parameter, so the API
 * defaults to 'practice' lessons. StudyContent then filters for 'learning' lessons
 * (because /study prefetched with lessonType='learning'), producing an empty result
 * and showing "No topics available" — even when the course has practice lessons.
 *
 * The fix: the client-side fetch URL must include ?lessonType=<type> so the API
 * returns the correct lesson type, making both routes consistent.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'

let GET: (req: NextRequest) => Promise<Response>

let payload: Payload
let originalDatabaseUrl: string | undefined
let courseId: string
let chapterId: string
let practiceLessonId: string
let learningLessonId: string

const GRADE_LEVEL = 'grade-8-empty-state-test'
const TENANT_SLUG = `empty-state-test-tenant-${Date.now()}`

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL

  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Ensure tenant
  const existingTenants = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: TENANT_SLUG } },
    limit: 1,
    overrideAccess: true,
  })
  if (existingTenants.docs.length === 0) {
    await payload.create({
      collection: 'tenants',
      data: { name: TENANT_SLUG, slug: TENANT_SLUG, status: 'active' },
      overrideAccess: true,
    })
  }

  // Create category
  const category = await payload.create({
    collection: 'categories',
    data: {
      title: 'Empty State Test Category',
      slug: `empty-state-cat-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })

  // Create course
  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: GRADE_LEVEL,
      title: 'Empty State Test Course',
      status: 'published',
      categories: [category.id],
    } as any,
    overrideAccess: true,
  })
  courseId = course.id

  // Create chapter
  const chapter = await payload.create({
    collection: 'chapters',
    data: {
      course: courseId,
      title: 'Empty State Test Chapter',
      slug: `empty-state-chapter-${Date.now()}`,
      status: 'published',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  chapterId = chapter.id

  // Create a practice lesson
  const practiceLesson = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapterId,
      title: 'Practice Lesson',
      slug: `practice-empty-state-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'practice',
      locale: 'he',
    } as any,
    overrideAccess: true,
  })
  practiceLessonId = practiceLesson.id

  // Create a learning lesson
  const learningLesson = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapterId,
      title: 'Learning Lesson',
      slug: `learning-empty-state-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'learning',
      locale: 'he',
    } as any,
    overrideAccess: true,
  })
  learningLessonId = learningLesson.id

  // Dynamic import route after DATABASE_URL is set
  const route = await import('@/app/api/chapters/by-grade/route')
  GET = route.GET
}, 120_000)

afterAll(async () => {
  if (payload?.db?.destroy) await payload.db.destroy()
  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error: TypeScript doesn't allow delete on process.env
    delete process.env.DATABASE_URL
  }
}, 120_000)

function makeRequest(grade: string, params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/chapters/by-grade')
  url.searchParams.set('grade', grade)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url.toString(), {
    method: 'GET',
  })
}

describe('GET /api/chapters/by-grade — lessonType parameter consistency', () => {
  it('BUG REPRO (#1993): when lessonType is NOT in the URL, API defaults to practice lessons', async () => {
    // Simulate the BUG: StudyContent client-side fetch calls /api/chapters/by-grade
    // WITHOUT ?lessonType=<type> when the prefetch fails.
    // This means the API defaults to 'practice' lessons — but StudyContent
    // then filters for 'learning' lessons (from /study prefetch), resulting in
    // an empty result and "No topics available" message.
    const req = makeRequest(GRADE_LEVEL) // NO lessonType parameter
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    // API defaults to 'practice' lessons when no lessonType is specified
    const allLessonIds = body.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )
    expect(allLessonIds).toContain(practiceLessonId)
    // Should NOT contain learning lessons (API defaulted to 'practice')
    expect(allLessonIds).not.toContain(learningLessonId)
  })

  it('returns learning lessons when lessonType=learning is explicitly passed', async () => {
    // This is the CORRECT behavior: the client-side fetch should pass
    // ?lessonType=learning for /study pages
    const req = makeRequest(GRADE_LEVEL, { lessonType: 'learning' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    const allLessonIds = body.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )
    expect(allLessonIds).toContain(learningLessonId)
    expect(allLessonIds).not.toContain(practiceLessonId)
  })

  it('returns practice lessons when lessonType=practice is explicitly passed', async () => {
    const req = makeRequest(GRADE_LEVEL, { lessonType: 'practice' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    const allLessonIds = body.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )
    expect(allLessonIds).toContain(practiceLessonId)
    expect(allLessonIds).not.toContain(learningLessonId)
  })

  it('BUG REPRO (#1993): StudyContent filters for learning but gets practice lessons from API', async () => {
    // Simulate what happens in the buggy code path:
    // 1. /study prefetches with lessonType='learning' (server-side)
    // 2. Prefetch fails → null
    // 3. Client-side fetch calls /api/chapters/by-grade WITHOUT ?lessonType
    // 4. API returns practice lessons (the bug: wrong type!)
    // 5. StudyContent filters: getEffectiveLessonType(lesson.type) === 'learning'
    // 6. Result: empty (no topics available) ← THE BUG
    const req = makeRequest(GRADE_LEVEL) // Simulates buggy client-side fetch (no lessonType)
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    // API returned practice lessons (default)
    const practiceLessonIds = body.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).filter((l: any) => l.type === 'practice').map((l: any) => l.id),
    )
    expect(practiceLessonIds).toContain(practiceLessonId)

    // StudyContent would filter for lesson.type === 'learning'
    // Since API returned 'practice' lessons, filtered result is EMPTY
    const learningLessonIds = body.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).filter((l: any) => l.type === 'learning').map((l: any) => l.id),
    )
    expect(learningLessonIds).not.toContain(learningLessonId) // learning lesson not returned
  })
})
