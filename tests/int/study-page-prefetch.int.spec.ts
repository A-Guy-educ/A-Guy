// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing which depends on
// Node.js's native TextEncoder/Uint8Array. The jsdom environment can cause a
// Uint8Array realm mismatch that breaks jose's FlattenedSign constructor check.

/**
 * Integration tests: study page prefetchData lessonType consistency
 *
 * Bug #1863: Study page shows empty while Practice shows content because
 * Study page calls prefetchStudyData with lessonType='learning' while Practice
 * uses the default lessonType='practice'.
 *
 * This means courses that only have 'practice' lessons show empty on /study.
 * Fix: Study page should use 'practice' lessonType to match Practice page.
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
let learningLessonId: string

const GRADE_LEVEL = 'grade-8-study-test'
const TENANT_SLUG = `study-test-tenant-${Date.now()}`

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
      title: 'Study Test Category',
      slug: `study-cat-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })

  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: GRADE_LEVEL,
      title: 'Study Test Course',
      slug: `study-test-course-${Date.now()}`,
      status: 'published',
      categories: [category.id],
    } as any,
    overrideAccess: true,
  })

  const chapter = await payload.create({
    collection: 'chapters',
    data: {
      course: course.id,
      title: 'Study Test Chapter',
      slug: `study-chapter-${Date.now()}`,
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

  // Create a learning lesson
  const learningLesson = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapterId,
      title: 'Learning Lesson',
      slug: `learning-lesson-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'learning',
      locale: 'he',
    } as any,
    overrideAccess: true,
  })
  learningLessonId = learningLesson.id
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

describe('prefetchStudyData — lessonType consistency', () => {
  it('default lessonType returns practice lessons (matches Practice page)', async () => {
    // The default lessonType is 'practice' — same as what Practice page uses.
    // Study page SHOULD also use this default after the fix.
    const result = await prefetchStudyData(GRADE_LEVEL, undefined)

    expect(result).not.toBeNull()
    expect(result!.chapters.length).toBeGreaterThan(0)

    const allLessonIds = result!.chapters.flatMap((ch) => (ch.lessons ?? []).map((l) => l.id))
    expect(allLessonIds).toContain(practiceLessonId)
    expect(allLessonIds).not.toContain(learningLessonId)

    // All returned lessons should be practice type (the default)
    for (const chapter of result!.chapters) {
      for (const lesson of chapter.lessons ?? []) {
        expect(lesson.type).toBe('practice')
      }
    }
  })

  it('lessonType=learning returns only learning lessons (Study page OLD buggy behavior)', async () => {
    // This is how Study page USED to call prefetchStudyData (third arg = 'learning').
    // This is the BUG — it returns only learning lessons, showing empty on courses
    // that only have practice lessons.
    const result = await prefetchStudyData(GRADE_LEVEL, undefined, 'learning')

    expect(result).not.toBeNull()
    expect(result!.chapters.length).toBeGreaterThan(0)

    const allLessonIds = result!.chapters.flatMap((ch) => (ch.lessons ?? []).map((l) => l.id))
    expect(allLessonIds).toContain(learningLessonId)
    expect(allLessonIds).not.toContain(practiceLessonId)

    // All returned lessons should be learning type
    for (const chapter of result!.chapters) {
      for (const lesson of chapter.lessons ?? []) {
        expect(lesson.type).toBe('learning')
      }
    }
  })

  it('BUG #1863: Study page should return practice lessons (same as Practice page)', async () => {
    // BUG: Study page calls prefetchStudyData(grade, locale, 'learning')
    //      Practice page calls prefetchStudyData(grade, locale) [default='practice']
    // This means courses with only practice lessons show empty on /study.
    //
    // FIX: Study page now calls prefetchStudyData(grade, locale) [same as Practice].
    //
    // This test verifies that prefetchStudyData returns practice lessons
    // when called with the default lessonType (as both pages do after fix).
    const result = await prefetchStudyData(GRADE_LEVEL, undefined)

    expect(result).not.toBeNull()
    expect(result!.chapters.length).toBeGreaterThan(0)

    const allLessonIds = result!.chapters.flatMap((ch) => (ch.lessons ?? []).map((l) => l.id))
    expect(allLessonIds).toContain(practiceLessonId)
    expect(allLessonIds).not.toContain(learningLessonId)
  })
})
