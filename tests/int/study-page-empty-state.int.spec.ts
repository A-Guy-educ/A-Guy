// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing which depends on
// Node.js's native TextEncoder/Uint8Array. The jsdom environment can cause a
// Uint8Array realm mismatch that breaks jose's FlattenedSign constructor check.

/**
 * Integration tests: Study page empty state bug
 * Bug: Course study page shows empty state despite enrolled course existing.
 *
 * Root cause: queryChaptersByGrade applies localeWhereClause to the COURSE query.
 * When the user's contentLocale differs from the course's locale, the course
 * is not found, causing the study page to show "No topics available".
 *
 * The course should be found by courseLabel (grade), regardless of locale.
 * Locale filtering should only apply to lessons (done separately in prefetchStudyData).
 *
 * Covers: GET /api/chapters/by-grade — course locale mismatch scenario
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
let heCourseId: string
let heChapterId: string
let heLearningLessonId: string
let hePracticeLessonId: string

const GRADE_LEVEL = 'grade-study-empty-test'
const TENANT_SLUG = `study-empty-test-tenant-${Date.now()}`

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

  // Create a category
  const category = await payload.create({
    collection: 'categories',
    data: {
      title: 'Study Empty Test Category',
      slug: `study-empty-cat-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })

  // Create a Hebrew course (locale: 'he') — simulates "Translate Test (EN)"
  // which might have been created with default Hebrew locale
  const heCourse = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: GRADE_LEVEL,
      title: 'Study Empty Test Course (Hebrew)',
      status: 'published',
      categories: [category.id],
      locale: 'he', // Hebrew locale — user is in English locale
    } as any,
    overrideAccess: true,
  })
  heCourseId = heCourse.id

  // Create a chapter for the Hebrew course
  const heChapter = await payload.create({
    collection: 'chapters',
    data: {
      course: heCourseId,
      title: 'Study Empty Test Chapter',
      slug: `study-empty-chapter-${Date.now()}`,
      status: 'published',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  heChapterId = heChapter.id

  // Create a learning lesson
  const heLearningLesson = await payload.create({
    collection: 'lessons',
    data: {
      chapter: heChapterId,
      title: 'Learning Lesson (Hebrew)',
      slug: `study-empty-learning-he-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'learning',
      locale: 'he',
    } as any,
    overrideAccess: true,
  })
  heLearningLessonId = heLearningLesson.id

  // Create a practice lesson
  const hePracticeLesson = await payload.create({
    collection: 'lessons',
    data: {
      chapter: heChapterId,
      title: 'Practice Lesson (Hebrew)',
      slug: `study-empty-practice-he-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'practice',
      locale: 'he',
    } as any,
    overrideAccess: true,
  })
  hePracticeLessonId = hePracticeLesson.id

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

describe('GET /api/chapters/by-grade — course locale mismatch (bug #1800)', () => {
  /**
   * Bug scenario:
   * - User selects a course (sets grade cookie to course's courseLabel)
   * - Course has locale: 'he' (Hebrew content)
   * - User's contentLocale = 'en' (English interface)
   * - Study page shows empty state because queryChaptersByGrade can't find
   *   the course (locale filter excludes it)
   *
   * Expected: course should be found by courseLabel (grade), regardless of
   * course locale. Lessons should still be filtered by locale.
   */

  it('finds course by grade even when course locale differs from content locale', async () => {
    // User has contentLocale = 'en' but course has locale = 'he'
    const req = makeRequest(GRADE_LEVEL, { locale: 'en', lessonType: 'learning' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    // The course SHOULD be found (by courseLabel/grade)
    // even though its locale ('he') differs from requested locale ('en')
    expect(body.chapters).toBeDefined()
    expect(Array.isArray(body.chapters)).toBe(true)
    expect(body.chapters.length).toBeGreaterThan(0)

    // Course info should be populated
    expect(body.courseId).toBe(heCourseId)
    expect(body.courseSlug).toBeDefined()
  })

  it('returns lessons filtered by locale when contentLocale matches lesson locale', async () => {
    // Request Hebrew locale — should return Hebrew lessons
    const req = makeRequest(GRADE_LEVEL, { locale: 'he', lessonType: 'learning' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.chapters).toBeDefined()
    expect(body.chapters.length).toBeGreaterThan(0)

    // Should return Hebrew learning lessons
    const allLessonIds = body.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )
    expect(allLessonIds).toContain(heLearningLessonId)
    expect(allLessonIds).not.toContain(hePracticeLessonId)
  })

  it('returns empty lessons array when course locale differs from content locale and no locale fallback lessons exist', async () => {
    // User is in English locale, course has Hebrew lessons, no English lessons exist
    // Course should be found, but lessons array will be empty (locale filter on lessons)
    const req = makeRequest(GRADE_LEVEL, { locale: 'en', lessonType: 'learning' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    // Course must be found (bug fix validates this)
    expect(body.chapters).toBeDefined()
    expect(body.chapters.length).toBeGreaterThan(0)
    expect(body.courseId).toBe(heCourseId)

    // Lessons filtered by locale — no English lessons exist, so empty
    const allLessonIds = body.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )
    expect(allLessonIds).not.toContain(heLearningLessonId)
  })

  it('returns practice lessons when lessonType=practice with matching locale', async () => {
    const req = makeRequest(GRADE_LEVEL, { locale: 'he', lessonType: 'practice' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.chapters).toBeDefined()
    expect(body.chapters.length).toBeGreaterThan(0)

    const allLessonIds = body.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )
    expect(allLessonIds).toContain(hePracticeLessonId)
    expect(allLessonIds).not.toContain(heLearningLessonId)
  })
})
