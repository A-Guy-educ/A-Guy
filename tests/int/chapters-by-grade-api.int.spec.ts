// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing which depends on
// Node.js's native TextEncoder/Uint8Array. The jsdom environment can cause a
// Uint8Array realm mismatch that breaks jose's FlattenedSign constructor check.

/**
 * Integration tests: /api/chapters/by-grade lesson type and locale filtering
 * Covers: GET /api/chapters/by-grade — lessonType parameter, locale filtering
 *
 * Tests:
 * 1. lessonType=practice returns only practice lessons
 * 2. lessonType=learning returns only learning lessons
 * 3. Default (no lessonType) returns practice lessons
 * 4. locale filtering works for lessons
 * 5. Mixed lesson types filtered correctly
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
let examLessonId: string
let heLessonId: string
let enLessonId: string
let enLessonOnEnChapterId: string
let enChapterId: string
let enCourseId: string

const GRADE_LEVEL = 'grade-8-cbg-test'
const TENANT_SLUG = `cbg-test-tenant-${Date.now()}`

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL

  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Ensure the default tenant exists
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

  // Create a course with chapters and lessons of different types
  const category = await payload.create({
    collection: 'categories',
    data: {
      title: 'CBG Test Category',
      slug: `cbg-cat-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })

  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: GRADE_LEVEL,
      title: 'CBG Test Course',
      status: 'published',
      categories: [category.id],
    } as any,
    overrideAccess: true,
  })
  courseId = course.id

  const chapter = await payload.create({
    collection: 'chapters',
    data: {
      course: courseId,
      title: 'CBG Test Chapter',
      slug: `cbg-chapter-${Date.now()}`,
      status: 'published',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  chapterId = chapter.id

  // Create lessons of different types (all in Hebrew locale by default)
  const practiceLesson = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapterId,
      title: 'Practice Lesson (Hebrew)',
      slug: `practice-he-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'practice',
      locale: 'he',
    } as any,
    overrideAccess: true,
  })
  practiceLessonId = practiceLesson.id

  const learningLesson = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapterId,
      title: 'Learning Lesson (Hebrew)',
      slug: `learning-he-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'learning',
      locale: 'he',
    } as any,
    overrideAccess: true,
  })
  learningLessonId = learningLesson.id

  const examLesson = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapterId,
      title: 'Exam Lesson (Hebrew)',
      slug: `exam-he-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'exam',
      locale: 'he',
    } as any,
    overrideAccess: true,
  })
  examLessonId = examLesson.id

  // Create an English practice lesson
  const enLesson = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapterId,
      title: 'Practice Lesson (English)',
      slug: `practice-en-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'practice',
      locale: 'en',
    } as any,
    overrideAccess: true,
  })
  enLessonId = enLesson.id

  // Create an English course for English locale tests
  const enCourse = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: GRADE_LEVEL,
      title: 'CBG Test Course (English)',
      status: 'published',
      categories: [category.id],
      locale: 'en',
    } as any,
    overrideAccess: true,
  })
  enCourseId = enCourse.id

  // Create an English chapter for English locale tests
  const enChapter = await payload.create({
    collection: 'chapters',
    data: {
      course: enCourseId,
      title: 'CBG Test Chapter (English)',
      slug: `cbg-chapter-en-${Date.now()}`,
      status: 'published',
      isActive: true,
      locale: 'en',
    } as any,
    overrideAccess: true,
  })
  enChapterId = enChapter.id

  // Create an English lesson on the English chapter
  const enLessonOnEnChapter = await payload.create({
    collection: 'lessons',
    data: {
      chapter: enChapterId,
      title: 'Practice Lesson (English on English Chapter)',
      slug: `practice-en-en-ch-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'practice',
      locale: 'en',
    } as any,
    overrideAccess: true,
  })
  enLessonOnEnChapterId = enLessonOnEnChapter.id

  // Dynamic import after DATABASE_URL is set
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

describe('GET /api/chapters/by-grade — lessonType filtering', () => {
  it('returns only practice lessons when lessonType=practice', async () => {
    const req = makeRequest(GRADE_LEVEL, { lessonType: 'practice', locale: 'he' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.chapters).toBeDefined()
    expect(Array.isArray(body.chapters)).toBe(true)

    // All lessons returned should be practice lessons
    for (const chapter of body.chapters) {
      for (const lesson of chapter.lessons ?? []) {
        expect(lesson.type).toBe('practice')
      }
    }

    // Should include the Hebrew practice lesson
    const allLessonIds = body.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )
    expect(allLessonIds).toContain(practiceLessonId)
    // Should NOT include learning or exam lessons
    expect(allLessonIds).not.toContain(learningLessonId)
    expect(allLessonIds).not.toContain(examLessonId)
  })

  it('returns only learning lessons when lessonType=learning', async () => {
    const req = makeRequest(GRADE_LEVEL, { lessonType: 'learning', locale: 'he' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    for (const chapter of body.chapters) {
      for (const lesson of chapter.lessons ?? []) {
        expect(lesson.type).toBe('learning')
      }
    }

    const allLessonIds = body.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )
    expect(allLessonIds).toContain(learningLessonId)
    expect(allLessonIds).not.toContain(practiceLessonId)
    expect(allLessonIds).not.toContain(examLessonId)
  })

  it('returns only exam lessons when lessonType=exam', async () => {
    const req = makeRequest(GRADE_LEVEL, { lessonType: 'exam', locale: 'he' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    for (const chapter of body.chapters) {
      for (const lesson of chapter.lessons ?? []) {
        expect(lesson.type).toBe('exam')
      }
    }

    const allLessonIds = body.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )
    expect(allLessonIds).toContain(examLessonId)
    expect(allLessonIds).not.toContain(practiceLessonId)
    expect(allLessonIds).not.toContain(learningLessonId)
  })

  it('defaults to practice lessons when no lessonType is specified', async () => {
    const req = makeRequest(GRADE_LEVEL)
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    // All lessons returned should be practice lessons (the default)
    for (const chapter of body.chapters) {
      for (const lesson of chapter.lessons ?? []) {
        expect(lesson.type).toBe('practice')
      }
    }
  })

  it('gracefully handles invalid lessonType by defaulting to practice', async () => {
    const req = makeRequest(GRADE_LEVEL, { lessonType: 'invalid' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    // Should default to practice lessons
    for (const chapter of body.chapters) {
      for (const lesson of chapter.lessons ?? []) {
        expect(lesson.type).toBe('practice')
      }
    }
  })
})

describe('GET /api/chapters/by-grade — locale filtering', () => {
  it('returns only Hebrew lessons when locale=he', async () => {
    const req = makeRequest(GRADE_LEVEL, { locale: 'he', lessonType: 'practice' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    // Should include the Hebrew practice lesson
    const allLessonIds = body.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )
    expect(allLessonIds).toContain(practiceLessonId)
    // Should NOT include the English practice lesson
    expect(allLessonIds).not.toContain(enLessonId)
  })

  it('returns only English lessons when locale=en', async () => {
    const req = makeRequest(GRADE_LEVEL, { locale: 'en', lessonType: 'practice' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    // Should include the English practice lesson on the English chapter
    const allLessonIds = body.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )
    expect(allLessonIds).toContain(enLessonOnEnChapterId)
    // Should NOT include the Hebrew practice lesson
    expect(allLessonIds).not.toContain(practiceLessonId)
  })
})

describe('GET /api/chapters/by-grade — combined filters', () => {
  it('applies both lessonType and locale filters together', async () => {
    const req = makeRequest(GRADE_LEVEL, { locale: 'en', lessonType: 'practice' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    // All returned lessons should be both practice AND English
    for (const chapter of body.chapters) {
      for (const lesson of chapter.lessons ?? []) {
        expect(lesson.type).toBe('practice')
        expect(lesson.locale).toBe('en')
      }
    }
  })
})
