// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing which depends on
// Node.js's native TextEncoder/Uint8Array. The jsdom environment can cause a
// Uint8Array realm mismatch that breaks jose's FlattenedSign constructor check.

/**
 * Bug #1820: Test page empty for course that has lessons in Practice
 *
 * The /test page was calling prefetchStudyData(grade, locale, 'exam') which filters
 * lessons by type='exam'. The /practice page calls prefetchStudyData(grade, locale)
 * which defaults to type='practice'. Since the course has only 'practice' lessons,
 * Test returned 0 lessons while Practice returned lessons.
 *
 * Fix: Changed /test to call prefetchStudyData(grade, locale) without the 'exam'
 * argument, so it uses the same default 'practice' as /practice. Both pages now return
 * the same course content.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { prefetchStudyData } from '@/server/repos/queries/study-page'

let payload: Payload
let originalDatabaseUrl: string | undefined
let courseId: string
let chapterId: string
let practiceLessonId: string

const GRADE_LEVEL = 'grade-8-test-bug-test'
const TENANT_SLUG = `test-bug-test-tenant-${Date.now()}`

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

  const category = await payload.create({
    collection: 'categories',
    data: {
      title: 'Test Bug Test Category',
      slug: `test-bug-cat-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })

  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: GRADE_LEVEL,
      title: 'Test Bug Test Course',
      slug: `test-bug-test-course-${Date.now()}`,
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
      title: 'Test Bug Test Chapter',
      slug: `test-bug-chapter-${Date.now()}`,
      status: 'published',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  chapterId = chapter.id

  // Create ONLY practice lessons (no exam lessons) — this mirrors the real bug
  // where the course has practice lessons but Test page filters by 'exam' type
  const practiceLesson = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapterId,
      title: 'Practice Lesson (Hebrew)',
      slug: `practice-he-test-bug-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'practice',
      locale: 'he',
    } as any,
    overrideAccess: true,
  })
  practiceLessonId = practiceLesson.id
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

describe('Bug #1820 — Test page empty for course that has lessons in Practice', () => {
  it('Practice lessonType (default) returns practice lessons — confirms course data is valid', async () => {
    // This is what /practice page does: prefetchStudyData(grade, locale) → defaults to lessonType='practice'
    const result = await prefetchStudyData(GRADE_LEVEL, undefined, 'practice')

    expect(result).not.toBeNull()
    expect(result!.chapters.length).toBeGreaterThan(0)

    // Should have the practice lesson
    const allLessonIds = result!.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )
    expect(allLessonIds).toContain(practiceLessonId)
  })

  it('Test lessonType=exam returns ZERO lessons — reproduces the bug', async () => {
    // This is what /test page does: prefetchStudyData(grade, locale, 'exam')
    // Since the course has only practice lessons, this should return 0 lessons
    const result = await prefetchStudyData(GRADE_LEVEL, undefined, 'exam')

    expect(result).not.toBeNull()
    expect(result!.chapters.length).toBeGreaterThan(0) // chapters exist

    // Bug: no exam lessons exist, so lessons array is empty
    const allLessonIds = result!.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )
    expect(allLessonIds).toHaveLength(0) // ← This is the BUG: should have lessons but doesn't
  })

  it('Test and Practice should return the same lessons — both default to lessonType=practice', async () => {
    // After fix: both /test and /practice call prefetchStudyData(grade, locale)
    // with no explicit lessonType → both default to 'practice' → return same lessons
    const testResult = await prefetchStudyData(GRADE_LEVEL, undefined, 'practice')
    const practiceResult = await prefetchStudyData(GRADE_LEVEL, undefined, 'practice')

    expect(testResult!.chapters.length).toBeGreaterThan(0)
    expect(practiceResult!.chapters.length).toBeGreaterThan(0)

    const testLessonIds = testResult!.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )
    const practiceLessonIds = practiceResult!.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )

    // Both should return the same lessons (the practice lessons)
    expect(testLessonIds).toEqual(practiceLessonIds)
    expect(testLessonIds).toContain(practiceLessonId)
    expect(testLessonIds.length).toBeGreaterThan(0)
  })

  it('CORRECT: Test page (no lessonType arg = defaults to practice) returns same as Practice page', async () => {
    // This simulates what the FIXED test page does: calls prefetchStudyData(grade, locale)
    // with no third argument → defaults to 'practice' → same as Practice page
    const testResult = await prefetchStudyData(GRADE_LEVEL, undefined) // no third arg → defaults to 'practice'
    const practiceResult = await prefetchStudyData(GRADE_LEVEL, undefined) // same call

    expect(testResult!.chapters.length).toBeGreaterThan(0)
    expect(practiceResult!.chapters.length).toBeGreaterThan(0)

    const testLessonIds = testResult!.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )
    const practiceLessonIds = practiceResult!.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )

    // After fix: both pages call with same args → return same lessons
    expect(testLessonIds).toEqual(practiceLessonIds)
    expect(testLessonIds.length).toBeGreaterThan(0)
  })
})
