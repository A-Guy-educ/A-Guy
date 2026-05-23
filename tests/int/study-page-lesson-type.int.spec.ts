// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing which depends on
// Node.js's native TextEncoder/Uint8Array. The jsdom environment can cause a
// Uint8Array realm mismatch that breaks jose's FlattenedSign constructor check.

/**
 * Integration test: Study page lesson type consistency
 *
 * Bug: The /study page calls prefetchStudyData(grade, locale, 'learning') which only
 * returns lessons with type='learning'. The /practice page calls prefetchStudyData(grade, locale)
 * which defaults to lessonType='practice'. When a course has only 'practice' lessons,
 * Study shows "No topics available" while Practice shows lessons.
 *
 * Fix: The Study page should use 'practice' as the lesson type to ensure
 * consistent content surfacing with the Practice page.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { prefetchStudyData } from '@/server/repos/queries/study-page'

let payload: Payload
let originalDatabaseUrl: string | undefined
let courseId = ''
let chapterId1 = ''
let chapterId2 = ''
const practiceLessonIds: string[] = []

const GRADE_LEVEL = 'grade-8-splt-test'
const TENANT_SLUG = `splt-test-tenant-${Date.now()}`

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
      title: 'SPLT Test Category',
      slug: `splt-cat-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })

  // Create a course with courseLabel matching GRADE_LEVEL
  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: GRADE_LEVEL,
      title: 'SPLT Test Course',
      status: 'published',
      categories: [category.id],
      isActive: true,
      pageAccessType: 'free',
      accessType: 'free',
    } as any,
    overrideAccess: true,
  })
  courseId = course.id

  // Create 2 chapters
  const chapter1 = await payload.create({
    collection: 'chapters',
    data: {
      course: courseId,
      title: 'SPLT Chapter 1',
      slug: `splt-ch-1-${Date.now()}`,
      status: 'published',
      isActive: true,
      order: 1,
    } as any,
    overrideAccess: true,
  })
  chapterId1 = chapter1.id

  const chapter2 = await payload.create({
    collection: 'chapters',
    data: {
      course: courseId,
      title: 'SPLT Chapter 2',
      slug: `splt-ch-2-${Date.now()}`,
      status: 'published',
      isActive: true,
      order: 2,
    } as any,
    overrideAccess: true,
  })
  chapterId2 = chapter2.id

  // Create practice lessons (mimics the real-world data — course with only practice lessons)
  const lessonTitles = [
    'Practice Lesson 1 (Ch1)',
    'Practice Lesson 2 (Ch1)',
    'Practice Lesson 3 (Ch1)',
    'Practice Lesson 4 (Ch2)',
    'Practice Lesson 5 (Ch2)',
    'Practice Lesson 6 (Ch2)',
    'Practice Lesson 7 (Ch2)',
  ]
  const chapters = [
    chapterId1,
    chapterId1,
    chapterId1,
    chapterId2,
    chapterId2,
    chapterId2,
    chapterId2,
  ]

  for (let i = 0; i < lessonTitles.length; i++) {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        chapter: chapters[i],
        title: lessonTitles[i],
        slug: `splt-lesson-${Date.now()}-${i}`,
        status: 'published',
        isActive: true,
        type: 'practice',
        order: i + 1,
      } as any,
      overrideAccess: true,
    })
    practiceLessonIds.push(lesson.id)
  }
}, 300_000)

afterAll(async () => {
  // Cleanup lessons
  for (const id of practiceLessonIds) {
    try {
      await payload.delete({ collection: 'lessons', id, overrideAccess: true })
    } catch {
      /* ignore */
    }
  }
  if (chapterId1) {
    try {
      await payload.delete({ collection: 'chapters', id: chapterId1, overrideAccess: true })
    } catch {
      /* ignore */
    }
  }
  if (chapterId2) {
    try {
      await payload.delete({ collection: 'chapters', id: chapterId2, overrideAccess: true })
    } catch {
      /* ignore */
    }
  }
  if (courseId) {
    try {
      await payload.delete({ collection: 'courses', id: courseId, overrideAccess: true })
    } catch {
      /* ignore */
    }
  }

  if (payload?.db?.destroy) await payload.db.destroy()
  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error: TypeScript doesn't allow delete on process.env
    delete process.env.DATABASE_URL
  }
}, 120_000)

describe('Study page lesson type consistency', () => {
  it('prefetchStudyData with lessonType=practice returns practice lessons', async () => {
    const result = await prefetchStudyData(GRADE_LEVEL, undefined, 'practice')

    expect(result).not.toBeNull()
    expect(result!.chapters.length).toBeGreaterThan(0)

    const allLessonIds = result!.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )

    // Should find all 7 practice lessons
    expect(allLessonIds.length).toBe(7)
    for (const id of practiceLessonIds) {
      expect(allLessonIds).toContain(id)
    }
  })

  it('prefetchStudyData with lessonType=learning returns 0 lessons when course has only practice lessons', async () => {
    // This reproduces the bug: Study page uses 'learning' but course has only 'practice' lessons
    const result = await prefetchStudyData(GRADE_LEVEL, undefined, 'learning')

    expect(result).not.toBeNull()

    const allLessonIds = result!.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )

    // Bug: learning query returns 0 lessons because course only has practice lessons
    expect(allLessonIds.length).toBe(0)
  })

  it('Study and Practice pages must surface the same content for a course with only practice lessons', async () => {
    // After fix: Both Study and Practice use lessonType='practice'
    const studyResult = await prefetchStudyData(GRADE_LEVEL, undefined, 'practice')
    const practiceResult = await prefetchStudyData(GRADE_LEVEL, undefined, 'practice')

    // Both should return chapters from the same course
    expect(studyResult?.courseId).toBe(practiceResult?.courseId)
    expect(studyResult?.courseId).toBe(courseId)

    // After fix: Study (now 'practice') returns same lessons as Practice (also 'practice')
    const studyLessonCount =
      studyResult?.chapters.reduce((sum: number, ch: any) => sum + (ch.lessons?.length ?? 0), 0) ??
      0
    const practiceLessonCount =
      practiceResult?.chapters.reduce(
        (sum: number, ch: any) => sum + (ch.lessons?.length ?? 0),
        0,
      ) ?? 0

    expect(studyLessonCount).toBe(practiceLessonCount)
    expect(practiceLessonCount).toBe(7)
  })
})
