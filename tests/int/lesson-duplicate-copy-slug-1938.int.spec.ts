// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing.

/**
 * Integration tests: Duplicate lesson with "- Copy" slug appearing in Practice page — #1938
 *
 * Bug: A duplicate lesson with "- Copy" in its slug appears in the Practice page
 * under Chapter 2, causing confusion in the lesson list.
 *
 * Expected: Lessons with "- Copy" (or similar duplication suffixes) in their slug
 * should NOT appear in practice/exam/learning page queries — they are incomplete
 * duplicates that should not be served to students.
 *
 * The fix: Filter out lessons where the slug matches patterns like " - Copy", "-copy",
 * "-copy-#", etc. from the lesson queries used by the study/practice pages.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'

let payload: Payload
let originalDatabaseUrl: string | undefined

const GRADE_LEVEL = 'grade-8-duplicate-1938'
const TENANT_SLUG = `duplicate-1938-tenant-${Date.now()}`

// Test data IDs
let courseId: string
let chapter1Id: string
let chapter2Id: string
let lesson4Id: string
let lesson5Id: string
let duplicateLessonId: string
let duplicateSlug: string

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Ensure tenant exists
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
  const category = await payload.create({
    collection: 'categories',
    data: {
      title: 'Duplicate Test Category 1938',
      slug: `duplicate-cat-1938-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })

  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: GRADE_LEVEL,
      title: 'Duplicate Test Course 1938',
      slug: `duplicate-course-1938-${Date.now()}`,
      status: 'published',
      categories: [category.id],
    } as any,
    overrideAccess: true,
  })
  courseId = course.id

  // Create Chapter 1 with practice lessons
  const chapter1 = await payload.create({
    collection: 'chapters',
    data: {
      course: courseId,
      title: 'Chapter 1',
      slug: `dup-ch1-1938-${Date.now()}`,
      status: 'published',
      isActive: true,
      order: 1,
    } as any,
    overrideAccess: true,
  })
  chapter1Id = chapter1.id

  // Create lessons for Chapter 1
  await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapter1Id,
      title: 'Practice Lesson 1',
      slug: `dup-l1-1938-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'practice',
      order: 1,
    } as any,
    overrideAccess: true,
  })
  await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapter1Id,
      title: 'Practice Lesson 2',
      slug: `dup-l2-1938-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'practice',
      order: 2,
    } as any,
    overrideAccess: true,
  })
  await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapter1Id,
      title: 'Practice Lesson 3',
      slug: `dup-l3-1938-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'practice',
      order: 3,
    } as any,
    overrideAccess: true,
  })

  // Create Chapter 2 with practice lessons
  const chapter2 = await payload.create({
    collection: 'chapters',
    data: {
      course: courseId,
      title: 'Chapter 2',
      slug: `dup-ch2-1938-${Date.now()}`,
      status: 'published',
      isActive: true,
      order: 2,
    } as any,
    overrideAccess: true,
  })
  chapter2Id = chapter2.id

  // Create Lesson 4 in Chapter 2
  const lesson4Ch2 = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapter2Id,
      title: 'Practice Lesson 4 Ch2',
      slug: `translate-local-lesson-4-en-1938`,
      status: 'published',
      isActive: true,
      type: 'practice',
      order: 1,
    } as any,
    overrideAccess: true,
  })
  lesson4Id = lesson4Ch2.id

  // Create Lesson 5 in Chapter 2
  const lesson5Ch2 = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapter2Id,
      title: 'Practice Lesson 5 Ch2',
      slug: `translate-local-lesson-5-en-1938`,
      status: 'published',
      isActive: true,
      type: 'practice',
      order: 2,
    } as any,
    overrideAccess: true,
  })
  lesson5Id = lesson5Ch2.id

  // BUG REPRO: Create a DUPLICATE lesson with "-copy" suffix in the SAME chapter
  // The beforeChange hook normalizes spaces to hyphens, so we create with
  // title "Lesson 4 - Copy" which will have slug normalized to something like
  // "practice-lesson-4-ch2---copy" (with hyphens from spaces).
  // We set slug explicitly to include "-copy" pattern after normalization.
  const duplicateLesson = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapter2Id,
      title: 'Practice Lesson 4 Ch2 - Copy',
      slug: `translate-local-lesson-4-en-1938-copy`,
      status: 'published',
      isActive: true,
      type: 'practice',
      order: 3,
    } as any,
    overrideAccess: true,
  })
  duplicateLessonId = duplicateLesson.id
  duplicateSlug = duplicateLesson.slug ?? ''
}, 180_000)

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

const hasDatabaseUrl = !!process.env.DATABASE_URL

describe.skipIf(!hasDatabaseUrl)('Duplicate lesson with -copy slug — #1938', () => {
  it('BUG REPRO: current query returns duplicate lesson with "-copy" slug', async () => {
    // Simulate the current (buggy) query from prefetchStudyData
    const chapterIds = [chapter1Id, chapter2Id]

    const lessonsResult = await payload.find({
      collection: 'lessons',
      where: {
        and: [
          { chapter: { in: chapterIds } },
          { status: { equals: 'published' } },
          { isActive: { equals: true } },
          { type: { equals: 'practice' } },
        ],
      },
      sort: 'order',
      limit: 1000,
      pagination: false,
      depth: 0,
    })

    // BUG: The duplicate IS included in the results because the query
    // doesn't filter by slug patterns
    const duplicateLesson = lessonsResult.docs.find((l) => l.slug && l.slug.includes('-copy'))

    // The duplicate should be found in the results (this is the bug)
    expect(duplicateLesson).toBeDefined()
    expect(duplicateLesson?.slug).toContain('-copy')

    // Total should be 6: 3 from Chapter 1 + 3 from Chapter 2 (including duplicate)
    expect(lessonsResult.docs.length).toBe(6)
  })

  it('FIX VERIFY: query with slug not_like filter excludes duplicate lessons', async () => {
    // After the fix, lessons with "-copy" (or similar duplication suffixes)
    // should be excluded from practice page queries using not_like

    const chapterIds = [chapter1Id, chapter2Id]

    // The fixed query uses not_like to filter out any slug containing "-copy"
    const lessonsResult = await payload.find({
      collection: 'lessons',
      where: {
        and: [
          { chapter: { in: chapterIds } },
          { status: { equals: 'published' } },
          { isActive: { equals: true } },
          { type: { equals: 'practice' } },
          // Filter out duplication artifacts using not_like (the fix)
          { slug: { not_like: '-copy' } },
        ],
      },
      sort: 'order',
      limit: 1000,
      pagination: false,
      depth: 0,
    })

    // The duplicate should NOT be in the results after fix
    const duplicateLesson = lessonsResult.docs.find((l) => l.slug && l.slug.includes('-copy'))
    expect(duplicateLesson).toBeUndefined()

    // After fix: 3 from Chapter 1 + 2 from Chapter 2 = 5 (excluding duplicate)
    expect(lessonsResult.docs.length).toBe(5)
  })

  it('shows correct lesson counts per chapter after filtering duplicates', async () => {
    // Group lessons by chapter after filtering
    const chapterIds = [chapter1Id, chapter2Id]

    const lessonsResult = await payload.find({
      collection: 'lessons',
      where: {
        and: [
          { chapter: { in: chapterIds } },
          { status: { equals: 'published' } },
          { isActive: { equals: true } },
          { type: { equals: 'practice' } },
          // Exclude the specific duplicate slug
          { slug: { not_equals: duplicateSlug } },
        ],
      },
      sort: 'order',
      limit: 1000,
      pagination: false,
      depth: 0,
    })

    // Group by chapter
    const lessonsByChapter: Record<string, typeof lessonsResult.docs> = {}
    for (const lesson of lessonsResult.docs) {
      const chapterId = typeof lesson.chapter === 'string' ? lesson.chapter : lesson.chapter?.id
      if (chapterId) {
        if (!lessonsByChapter[chapterId]) {
          lessonsByChapter[chapterId] = []
        }
        lessonsByChapter[chapterId].push(lesson)
      }
    }

    // Chapter 1 should have 3 lessons
    expect(lessonsByChapter[chapter1Id]?.length).toBe(3)

    // Chapter 2 should have 2 lessons (after excluding duplicate)
    expect(lessonsByChapter[chapter2Id]?.length).toBe(2)
  })
})
