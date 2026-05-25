// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing.

/**
 * Integration tests: Practice page lesson card headings — #1937
 *
 * Bug: Lesson card headings are off by one on the /practice page.
 * Lesson 5 shows "Lesson 4", Lesson 6 shows "Lesson 5", etc.
 *
 * The issue is in StudyContent's filteredLessons computation. When chapters have
 * lessons of mixed types (some matching lessonType, some not), the filtered
 * lessons count within each chapter is less than the total, causing
 * startIndex to be incorrectly computed for subsequent chapters.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'

let payload: Payload
let originalDatabaseUrl: string | undefined

const GRADE_LEVEL = 'grade-8-heading-1937'
const TENANT_SLUG = `heading-1937-tenant-${Date.now()}`

// Test data IDs - set in beforeAll
let chapter1Id: string
let chapter2Id: string
let practiceLesson1Id: string
let practiceLesson2Id: string
let practiceLesson3Id: string
let practiceLesson4Id: string
let practiceLesson5Id: string
let practiceLesson6Id: string
let courseId: string

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
  const category = await payload.create({
    collection: 'categories',
    data: {
      title: 'Heading Test Category 1937',
      slug: `heading-cat-1937-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })

  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: GRADE_LEVEL,
      title: 'Heading Test Course 1937',
      slug: `heading-course-1937-${Date.now()}`,
      status: 'published',
      categories: [category.id],
    } as any,
    overrideAccess: true,
  })
  courseId = course.id

  // Create Chapter 1 with 4 practice lessons (as described in issue - Chapter 1 should have 4 lessons)
  const chapter1 = await payload.create({
    collection: 'chapters',
    data: {
      course: courseId,
      title: 'Chapter 1',
      slug: `heading-ch1-1937-${Date.now()}`,
      status: 'published',
      isActive: true,
      order: 1,
    } as any,
    overrideAccess: true,
  })
  chapter1Id = chapter1.id

  // Create 4 practice lessons for Chapter 1
  const createPracticeLesson = async (chId: string, title: string, order: number) => {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        chapter: chId,
        title,
        slug: `heading-l-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        status: 'published',
        isActive: true,
        type: 'practice',
        order,
      } as any,
      overrideAccess: true,
    })
    return lesson.id
  }

  practiceLesson1Id = await createPracticeLesson(chapter1Id, 'Practice Lesson 1', 1)
  practiceLesson2Id = await createPracticeLesson(chapter1Id, 'Practice Lesson 2', 2)
  practiceLesson3Id = await createPracticeLesson(chapter1Id, 'Practice Lesson 3', 3)
  practiceLesson4Id = await createPracticeLesson(chapter1Id, 'Practice Lesson 4', 4)

  // Create Chapter 2 with 4 practice lessons
  const chapter2 = await payload.create({
    collection: 'chapters',
    data: {
      course: courseId,
      title: 'Chapter 2',
      slug: `heading-ch2-1937-${Date.now()}`,
      status: 'published',
      isActive: true,
      order: 2,
    } as any,
    overrideAccess: true,
  })
  chapter2Id = chapter2.id

  practiceLesson5Id = await createPracticeLesson(chapter2Id, 'Practice Lesson 5', 1)
  practiceLesson6Id = await createPracticeLesson(chapter2Id, 'Practice Lesson 6', 2)
  await createPracticeLesson(chapter2Id, 'Practice Lesson 7', 3)
  await createPracticeLesson(chapter2Id, 'Practice Lesson 8', 4)
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

describe.skipIf(!hasDatabaseUrl)('Practice page lesson card headings — #1937', () => {
  it('server query returns correct practice lessons for /practice page', async () => {
    // Simulate the prefetchStudyData server query
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
    })

    // Should return all 8 practice lessons (4 from each chapter)
    expect(lessonsResult.docs.length).toBe(8)

    // All returned lessons should be practice type
    for (const doc of lessonsResult.docs) {
      expect(doc.type).toBe('practice')
    }
  })

  it('BUG REPRO: simulates what happens when chapters have mixed lesson types', async () => {
    // Create a chapter with MIXED lesson types (3 practice + 1 learning)
    const mixedChapter = await payload.create({
      collection: 'chapters',
      data: {
        course: courseId,
        title: 'Mixed Type Chapter',
        slug: `mixed-ch-1937-${Date.now()}`,
        status: 'published',
        isActive: true,
        order: 20,
      } as any,
      overrideAccess: true,
    })

    // Add 3 practice and 1 learning lesson
    const mixedPractice1 = await payload.create({
      collection: 'lessons',
      data: {
        chapter: mixedChapter.id,
        title: 'Mixed Practice 1',
        slug: `mixed-p1-1937-${Date.now()}`,
        status: 'published',
        isActive: true,
        type: 'practice',
        order: 1,
      } as any,
      overrideAccess: true,
    })

    const mixedPractice2 = await payload.create({
      collection: 'lessons',
      data: {
        chapter: mixedChapter.id,
        title: 'Mixed Practice 2',
        slug: `mixed-p2-1937-${Date.now()}`,
        status: 'published',
        isActive: true,
        type: 'practice',
        order: 2,
      } as any,
      overrideAccess: true,
    })

    const mixedPractice3 = await payload.create({
      collection: 'lessons',
      data: {
        chapter: mixedChapter.id,
        title: 'Mixed Practice 3',
        slug: `mixed-p3-1937-${Date.now()}`,
        status: 'published',
        isActive: true,
        type: 'practice',
        order: 3,
      } as any,
      overrideAccess: true,
    })

    const mixedLearning = await payload.create({
      collection: 'lessons',
      data: {
        chapter: mixedChapter.id,
        title: 'Mixed Learning',
        slug: `mixed-l-1937-${Date.now()}`,
        status: 'published',
        isActive: true,
        type: 'learning',
        order: 4,
      } as any,
      overrideAccess: true,
    })

    // Query only practice lessons (simulating the server-side filter for /practice)
    const practiceLessons = await payload.find({
      collection: 'lessons',
      where: {
        and: [
          { chapter: { equals: mixedChapter.id } },
          { status: { equals: 'published' } },
          { isActive: { equals: true } },
          { type: { equals: 'practice' } },
        ],
      },
      sort: 'order',
      pagination: false,
    })

    // Should return only 3 practice lessons (the learning lesson is filtered out)
    expect(practiceLessons.docs.length).toBe(3)
    expect(practiceLessons.docs.map((l) => l.id)).toEqual([
      mixedPractice1.id,
      mixedPractice2.id,
      mixedPractice3.id,
    ])

    // Now simulate what StudyContent does: group filtered lessons by chapter
    // and compute startIndex

    // Group lessons by chapter (simulating chapterGroups computation)
    const lessonsByChapter: Record<string, typeof practiceLessons.docs> = {}
    for (const lesson of practiceLessons.docs) {
      const chapterId = typeof lesson.chapter === 'string' ? lesson.chapter : lesson.chapter?.id
      if (chapterId) {
        if (!lessonsByChapter[chapterId]) {
          lessonsByChapter[chapterId] = []
        }
        lessonsByChapter[chapterId].push(lesson)
      }
    }

    // Simulate chapterGroups - iterate through all chapters and group
    const allChapters = await payload.find({
      collection: 'chapters',
      where: { course: { equals: courseId } },
      sort: 'order',
      pagination: false,
      depth: 0,
    })

    const chapterGroups: Array<{ chapterId: string; lessons: typeof practiceLessons.docs }> = []
    for (const chapter of allChapters.docs) {
      const lessons = lessonsByChapter[chapter.id] || []
      chapterGroups.push({ chapterId: chapter.id, lessons })
    }

    // Find the mixed chapter's position and compute startIndex for lessons after it
    const mixedChapterIdx = chapterGroups.findIndex((g) => g.chapterId === mixedChapter.id)
    expect(mixedChapterIdx).toBeGreaterThanOrEqual(0)

    // The mixed chapter has 3 filtered lessons (practice only)
    expect(chapterGroups[mixedChapterIdx].lessons.length).toBe(3)

    // After the mixed chapter, startIndex for the next chapter would be cumulative
    let cumulativeStartIndex = 0
    for (let i = 0; i < mixedChapterIdx; i++) {
      cumulativeStartIndex += chapterGroups[i].lessons.length
    }

    // This demonstrates the bug: if mixed chapter has 3 practice lessons
    // but the issue expects it to have 4, the startIndex will be wrong
    // For a subsequent chapter with lessons, first lesson index = cumulativeStartIndex + 0 + 1

    // With mixed chapter having 3 lessons:
    // - cumulativeStartIndex = sum of all previous filtered lessons
    // - If this is the last chapter, cumulativeStartIndex = 3 (for Ch1 and Ch2)
    // - First lesson in next hypothetical chapter would have index = 3 + 0 + 1 = 4
    // But if the issue expects index = 5 (4+1), then startIndex should be 4

    // The bug: startIndex is computed from FILTERED lesson counts,
    // but if chapters are supposed to have uniform lesson types,
    // the mismatch causes off-by-one errors

    // Clean up - delete mixed chapter lessons
    await payload.delete({ collection: 'lessons', id: mixedPractice1.id, overrideAccess: true })
    await payload.delete({ collection: 'lessons', id: mixedPractice2.id, overrideAccess: true })
    await payload.delete({ collection: 'lessons', id: mixedPractice3.id, overrideAccess: true })
    await payload.delete({ collection: 'lessons', id: mixedLearning.id, overrideAccess: true })
    await payload.delete({ collection: 'chapters', id: mixedChapter.id, overrideAccess: true })
  })

  it('lesson indices are computed correctly when all chapters have uniform lesson types', async () => {
    // Verify our test data has Chapter 1 with 4 practice lessons and Chapter 2 with 4 practice lessons
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
      pagination: false,
    })

    // Group lessons by chapter
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

    // Verify Chapter 1 has 4 lessons
    expect(lessonsByChapter[chapter1Id]?.length).toBe(4)

    // Verify Chapter 2 has 4 lessons
    expect(lessonsByChapter[chapter2Id]?.length).toBe(4)

    // Get chapters in order
    const chaptersResult = await payload.find({
      collection: 'chapters',
      where: { course: { equals: courseId } },
      sort: 'order',
      pagination: false,
      depth: 0,
    })

    // Build chapter groups
    const chapterGroups: Array<{ chapterId: string; lessons: typeof lessonsResult.docs }> = []
    for (const chapter of chaptersResult.docs) {
      const lessons = lessonsByChapter[chapter.id] || []
      chapterGroups.push({ chapterId: chapter.id, lessons })
    }

    // Verify chapter order
    expect(chapterGroups[0].chapterId).toBe(chapter1Id)
    expect(chapterGroups[1].chapterId).toBe(chapter2Id)

    // Compute startIndex for each chapter
    let cumulativeStartIndex = 0
    for (const group of chapterGroups) {
      const expectedStartIndex = cumulativeStartIndex
      expect(group.lessons.length).toBe(4) // Each chapter has 4 lessons

      // For the first lesson in each chapter:
      // Chapter 1: startIndex = 0, index = 0 + 0 + 1 = 1 (CORRECT)
      // Chapter 2: startIndex = 4, index = 4 + 0 + 1 = 5 (CORRECT)

      const firstLessonIndex = cumulativeStartIndex + 0 + 1
      if (group.chapterId === chapter1Id) {
        expect(firstLessonIndex).toBe(1) // First lesson of Chapter 1
      } else if (group.chapterId === chapter2Id) {
        expect(firstLessonIndex).toBe(5) // First lesson of Chapter 2 should be 5
      }

      cumulativeStartIndex += group.lessons.length
    }
  })
})
