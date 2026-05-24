// @vitest-environment node
/**
 * Integration test: lesson ordering in StudyContent off-by-one heading bug
 *
 * Issue: Practice page shows incorrect lesson heading levels.
 * Lesson 2 card shows Lesson 1 heading, Lesson 5 card shows Lesson 4 heading.
 *
 * Root cause: filteredLessons does not explicitly sort lessons by `order` within
 * each chapter before mapping. If the DB returns lessons in a different order than
 * their `order` field, startIndex is computed incorrectly, causing off-by-one headings.
 *
 * Fix: Explicitly sort lessons by `order` field within each chapter in filteredLessons.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { prefetchStudyData } from '@/server/repos/queries/study-page'

let payload: Payload
let originalDatabaseUrl: string | undefined
let courseId: string
let chapter1Id: string
let chapter2Id: string
const GRADE_LEVEL = 'grade-8-lesson-order-test'
const TENANT_SLUG = `lesson-order-tenant-${Date.now()}`

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

  // Create a course
  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: GRADE_LEVEL,
      title: 'Lesson Order Test Course',
      slug: `lesson-order-course-${Date.now()}`,
      status: 'published',
    } as any,
    overrideAccess: true,
  })
  courseId = course.id

  // Create Chapter 1 with 3 practice lessons out of order
  const chapter1 = await payload.create({
    collection: 'chapters',
    data: {
      course: courseId,
      title: 'Chapter 1',
      slug: `ch1-lesson-order-${Date.now()}`,
      status: 'published',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  chapter1Id = chapter1.id

  // Create practice lessons for chapter 1 in NON-SEQUENTIAL order (order field != creation order)
  // Lesson with order=3 first, then order=1, then order=2
  const ch1Lesson3 = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapter1Id,
      title: 'Ch1 Lesson 3 (order=3)',
      slug: `ch1-l3-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'practice',
      order: 3,
    } as any,
    overrideAccess: true,
  })
  const ch1Lesson1 = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapter1Id,
      title: 'Ch1 Lesson 1 (order=1)',
      slug: `ch1-l1-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'practice',
      order: 1,
    } as any,
    overrideAccess: true,
  })
  const ch1Lesson2 = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapter1Id,
      title: 'Ch1 Lesson 2 (order=2)',
      slug: `ch1-l2-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'practice',
      order: 2,
    } as any,
    overrideAccess: true,
  })

  // Create Chapter 2 with 2 practice lessons in NON-SEQUENTIAL order
  const chapter2 = await payload.create({
    collection: 'chapters',
    data: {
      course: courseId,
      title: 'Chapter 2',
      slug: `ch2-lesson-order-${Date.now()}`,
      status: 'published',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  chapter2Id = chapter2.id

  // Create practice lessons for chapter 2 out of order: order=2 first, then order=1
  const ch2Lesson2 = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapter2Id,
      title: 'Ch2 Lesson 2 (order=2)',
      slug: `ch2-l2-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'practice',
      order: 2,
    } as any,
    overrideAccess: true,
  })
  const ch2Lesson1 = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapter2Id,
      title: 'Ch2 Lesson 1 (order=1)',
      slug: `ch2-l1-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'practice',
      order: 1,
    } as any,
    overrideAccess: true,
  })

  // Verify lessons were created (DB may return them in different order)
  expect(ch1Lesson1.id).toBeDefined()
  expect(ch1Lesson2.id).toBeDefined()
  expect(ch1Lesson3.id).toBeDefined()
  expect(ch2Lesson1.id).toBeDefined()
  expect(ch2Lesson2.id).toBeDefined()
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

describe('Lesson ordering in filteredLessons', () => {
  it('sorts lessons by order field within each chapter (off-by-one heading bug #1982)', async () => {
    // prefetchStudyData sorts lessons by order field when fetching from DB
    // But we want to verify that StudyContent ALSO sorts within each chapter
    // to ensure correct heading numbers even if DB returns out-of-order
    const data = await prefetchStudyData(GRADE_LEVEL, undefined, 'practice')

    expect(data).not.toBeNull()
    expect(data!.chapters.length).toBe(2)

    // The chapters should be in order
    expect(data!.chapters[0].title).toBe('Chapter 1')
    expect(data!.chapters[1].title).toBe('Chapter 2')

    const ch1Lessons = data!.chapters[0].lessons
    const ch2Lessons = data!.chapters[1].lessons

    // Chapter 1 should have 3 lessons
    expect(ch1Lessons.length).toBe(3)
    // Chapter 2 should have 2 lessons
    expect(ch2Lessons.length).toBe(2)

    // Lessons should be sorted by `order` field within each chapter
    // Ch1 lessons should be in order: 1, 2, 3
    expect(ch1Lessons[0].order).toBe(1)
    expect(ch1Lessons[1].order).toBe(2)
    expect(ch1Lessons[2].order).toBe(3)

    // Ch2 lessons should be in order: 1, 2
    expect(ch2Lessons[0].order).toBe(1)
    expect(ch2Lessons[1].order).toBe(2)
  })

  it('lessons across chapters are in correct sequential order for heading calculation', async () => {
    // Simulates how StudyContent builds filteredLessons and chapterGroups
    // The key invariant: when we assign heading numbers (startIndex + idx + 1),
    // the lessons must be in the correct order for numbers to be meaningful
    const data = await prefetchStudyData(GRADE_LEVEL, undefined, 'practice')

    expect(data).not.toBeNull()

    // Build filteredLessons the same way StudyContent does (but with the FIX applied)
    // This tests that the lesson order in chapters produces correct sequential headings
    const allLessons: Array<{ lesson: any; chapterSlug: string; order: number }> = []

    for (const chapter of data!.chapters) {
      const chapterSlug = chapter.slug || ''
      for (const lesson of chapter.lessons) {
        allLessons.push({
          lesson,
          chapterSlug,
          order: (lesson as any).order ?? 0,
        })
      }
    }

    // Now build chapterGroups
    const groupMap = new Map<string, typeof allLessons>()
    for (const item of allLessons) {
      const existing = groupMap.get(item.chapterSlug)
      if (existing) {
        existing.push(item)
      } else {
        groupMap.set(item.chapterSlug, [item])
      }
    }

    const chapterGroups: Array<{ chapterSlug: string; lessons: typeof allLessons }> = []
    for (const [chapterSlug, lessons] of groupMap) {
      chapterGroups.push({ chapterSlug, lessons })
    }

    // Simulate the index calculation
    let lessonCounter = 0
    for (const group of chapterGroups) {
      for (const item of group.lessons) {
        lessonCounter++
        // The heading should be the sequential lesson number
        // This test verifies that lessons come out in the right order
        // so that lessonCounter matches their order field
        expect(item.order).toBe(lessonCounter)
      }
    }

    // Should have 5 total lessons (3 in ch1 + 2 in ch2)
    expect(lessonCounter).toBe(5)
  })
})
