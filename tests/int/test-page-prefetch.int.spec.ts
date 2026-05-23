// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing which depends on
// Node.js's native TextEncoder/Uint8Array. The jsdom environment can cause a
// Uint8Array realm mismatch that breaks jose's FlattenedSign constructor check.

/**
 * Integration tests: test page prefetchData lessonType consistency
 *
 * Bug #1864: Test page shows empty for course that has content in Practice
 * because Test page calls prefetchStudyData with lessonType='exam' while
 * Practice uses the default lessonType='practice'.
 *
 * This means courses that only have 'practice' lessons show empty on /test.
 * Fix: Test page should use 'practice' lessonType to match Practice page.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { prefetchStudyData } from '@/server/repos/queries/study-page'

let payload: Payload
let originalDatabaseUrl: string | undefined
let chapterId: string
let practiceLessonId: string
let examLessonId: string

const GRADE_LEVEL = 'grade-8-test-page-test'
const TENANT_SLUG = `test-page-tenant-${Date.now()}`

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
      title: 'Test Page Category',
      slug: `test-cat-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })

  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: GRADE_LEVEL,
      title: 'Test Page Course',
      slug: `test-page-course-${Date.now()}`,
      status: 'published',
      categories: [category.id],
    } as any,
    overrideAccess: true,
  })

  const chapter = await payload.create({
    collection: 'chapters',
    data: {
      course: course.id,
      title: 'Test Page Chapter',
      slug: `test-chapter-${Date.now()}`,
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
      slug: `practice-lesson-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'practice',
      locale: 'he',
    } as any,
    overrideAccess: true,
  })
  practiceLessonId = practiceLesson.id

  // Create an exam lesson
  const examLesson = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapterId,
      title: 'Exam Lesson',
      slug: `exam-lesson-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'exam',
      locale: 'he',
    } as any,
    overrideAccess: true,
  })
  examLessonId = examLesson.id
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

describe('prefetchStudyData — test page lessonType', () => {
  it('BUG #1864: test page should return practice lessons (same as Practice page)', async () => {
    // BUG: Test page calls prefetchStudyData(grade, locale, 'exam')
    //      Practice page calls prefetchStudyData(grade, locale) [default='practice']
    // This means courses with only practice lessons show empty on /test.
    //
    // FIX: Test page should call prefetchStudyData(grade, locale) [same as Practice].
    //
    // This test verifies that prefetchStudyData returns practice lessons
    // when called with the default lessonType (as both pages should do after fix).
    const result = await prefetchStudyData(GRADE_LEVEL, undefined)

    expect(result).not.toBeNull()
    expect(result!.chapters.length).toBeGreaterThan(0)

    const allLessonIds = result!.chapters.flatMap((ch) => (ch.lessons ?? []).map((l) => l.id))
    expect(allLessonIds).toContain(practiceLessonId)
    // Should NOT contain exam lesson when using default lessonType
    expect(allLessonIds).not.toContain(examLessonId)
  })

  it('lessonType=exam returns only exam lessons', async () => {
    // This is how Test page CURRENTLY calls prefetchStudyData (third arg = 'exam').
    // This returns only exam lessons, showing empty on courses that only have practice lessons.
    const result = await prefetchStudyData(GRADE_LEVEL, undefined, 'exam')

    expect(result).not.toBeNull()
    expect(result!.chapters.length).toBeGreaterThan(0)

    const allLessonIds = result!.chapters.flatMap((ch) => (ch.lessons ?? []).map((l) => l.id))
    expect(allLessonIds).toContain(examLessonId)
    expect(allLessonIds).not.toContain(practiceLessonId)

    // All returned lessons should be exam type
    for (const chapter of result!.chapters) {
      for (const lesson of chapter.lessons ?? []) {
        expect(lesson.type).toBe('exam')
      }
    }
  })
})
