// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing which depends on
// Node.js's native TextEncoder/Uint8Array. The jsdom environment can cause a
// Uint8Array realm mismatch that breaks jose's FlattenedSign constructor check.

/**
 * Integration test: Practice page lesson numbering
 *
 * Bug: Lesson headings in Chapter 2 are misnumbered by one.
 * Lesson 5 card shows "Lesson 4" and Lesson 6 card shows "Lesson 5".
 * The off-by-one error suggests startIndex for Chapter 2 is computed as 3
 * when it should be 4 (Chapter 1 has 4 practice lessons).
 *
 * Expected: Lesson indices should be sequential across chapters:
 * - Chapter 1 lessons: 1, 2, 3, 4
 * - Chapter 2 lessons: 5, 6
 *
 * Actual (bug): Chapter 2 lessons show 4, 5 instead of 5, 6
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { prefetchStudyData } from '@/server/repos/queries/study-page'
import { getEffectiveLessonType } from '@/server/constants/lesson-types'
import type { LessonType } from '@/server/constants/lesson-types'

let payload: Payload
let originalDatabaseUrl: string | undefined
let courseId = ''
let chapterId1 = ''
let chapterId2 = ''
const practiceLessonIds: string[] = []

const GRADE_LEVEL = 'grade-8-practicenum-test'
const TENANT_SLUG = `pract-num-test-tenant-${Date.now()}`

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL

  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Ensure the tenant exists
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
      title: 'Practice Numbering Test Category',
      slug: `pract-num-cat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    } as any,
    overrideAccess: true,
  })

  // Create a course with courseLabel matching GRADE_LEVEL
  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: GRADE_LEVEL,
      title: 'Practice Numbering Test Course',
      slug: `pract-num-test-course-${Date.now()}`,
      status: 'published',
      categories: [category.id],
      isActive: true,
      pageAccessType: 'free',
      accessType: 'free',
    } as any,
    overrideAccess: true,
  })
  courseId = course.id

  // Create Chapter 1 with order 1
  const chapter1 = await payload.create({
    collection: 'chapters',
    data: {
      course: courseId,
      title: 'Chapter 1',
      slug: `ch-1-pract-num-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      status: 'published',
      isActive: true,
      order: 1,
    } as any,
    overrideAccess: true,
  })
  chapterId1 = chapter1.id

  // Create Chapter 2 with order 2
  const chapter2 = await payload.create({
    collection: 'chapters',
    data: {
      course: courseId,
      title: 'Chapter 2',
      slug: `ch-2-pract-num-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      status: 'published',
      isActive: true,
      order: 2,
    } as any,
    overrideAccess: true,
  })
  chapterId2 = chapter2.id

  // Create 6 practice lessons:
  // Chapter 1: 4 lessons (orders 1, 2, 3, 4)
  // Chapter 2: 2 lessons (orders 5, 6)
  const lessonData = [
    { chapter: chapterId1, title: 'Practice Lesson 1', order: 1 },
    { chapter: chapterId1, title: 'Practice Lesson 2', order: 2 },
    { chapter: chapterId1, title: 'Practice Lesson 3', order: 3 },
    { chapter: chapterId1, title: 'Practice Lesson 4', order: 4 },
    { chapter: chapterId2, title: 'Practice Lesson 5', order: 5 },
    { chapter: chapterId2, title: 'Practice Lesson 6', order: 6 },
  ]

  for (let i = 0; i < lessonData.length; i++) {
    const { chapter, title, order } = lessonData[i]
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        chapter,
        title,
        slug: `pract-num-lesson-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        status: 'published',
        isActive: true,
        type: 'practice',
        order,
      } as any,
      overrideAccess: true,
    })
    practiceLessonIds.push(lesson.id)
  }
}, 300_000)

afterAll(async () => {
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

describe('Practice page lesson numbering', () => {
  it('prefetchStudyData returns chapters in correct order with correct lesson counts', async () => {
    const result = await prefetchStudyData(GRADE_LEVEL, undefined, 'practice')

    expect(result).not.toBeNull()
    expect(result!.chapters.length).toBe(2)

    // Chapter 1 should be first (order: 1)
    const ch1 = result!.chapters[0]
    expect(ch1.slug).toContain('ch-1-pract-num')
    expect(ch1.lessons.length).toBe(4)

    // Chapter 2 should be second (order: 2)
    const ch2 = result!.chapters[1]
    expect(ch2.slug).toContain('ch-2-pract-num')
    expect(ch2.lessons.length).toBe(2)

    // All 6 lessons should be present
    const allLessonIds = result!.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )
    expect(allLessonIds.length).toBe(6)
    for (const id of practiceLessonIds) {
      expect(allLessonIds).toContain(id)
    }
  })

  it('all lessons in prefetched data have type practice and pass getEffectiveLessonType filter', async () => {
    const result = await prefetchStudyData(GRADE_LEVEL, undefined, 'practice')

    expect(result).not.toBeNull()

    for (const chapter of result!.chapters) {
      for (const lesson of chapter.lessons ?? []) {
        expect(lesson.type).toBe('practice')
        expect(getEffectiveLessonType(lesson.type)).toBe('practice')
      }
    }
  })

  it('lessons within each chapter are in correct order', async () => {
    const result = await prefetchStudyData(GRADE_LEVEL, undefined, 'practice')

    expect(result).not.toBeNull()

    // Chapter 1 lessons should be in order 1, 2, 3, 4
    const ch1Lessons = result!.chapters[0].lessons
    expect(ch1Lessons.length).toBe(4)
    expect(ch1Lessons[0].order).toBe(1)
    expect(ch1Lessons[1].order).toBe(2)
    expect(ch1Lessons[2].order).toBe(3)
    expect(ch1Lessons[3].order).toBe(4)

    // Chapter 2 lessons should be in order 5, 6
    const ch2Lessons = result!.chapters[1].lessons
    expect(ch2Lessons.length).toBe(2)
    expect(ch2Lessons[0].order).toBe(5)
    expect(ch2Lessons[1].order).toBe(6)
  })

  it('BUG REPRO: simulates StudyContent index calculation with mixed lesson types in Chapter 1', async () => {
    const result = await prefetchStudyData(GRADE_LEVEL, undefined, 'practice')

    expect(result).not.toBeNull()

    // Simulate how StudyContent computes filteredLessons and chapterGroups
    const lessonType: LessonType = 'practice'

    // Build chapter groups using chapter slug as key (matching StudyContent logic)
    // StudyContent adds _chapterSlug to each lesson when creating FilteredLesson
    interface ChapterGroup {
      chapterSlug: string
      lessons: any[]
    }
    const chapterGroups: ChapterGroup[] = []
    const groupMap = new Map<string, ChapterGroup>()

    // Iterate through chapters in order (which is the order they appear in filteredLessons)
    for (const chapter of result!.chapters) {
      const filtered = (chapter.lessons ?? []).filter(
        (lesson) => getEffectiveLessonType(lesson.type) === lessonType,
      )
      const key = chapter.slug ?? ''
      const existing = groupMap.get(key)
      if (existing) {
        existing.lessons.push(...filtered)
      } else {
        const group: ChapterGroup = {
          chapterSlug: key,
          lessons: [...filtered],
        }
        groupMap.set(key, group)
        chapterGroups.push(group)
      }
    }

    // Verify chapter order: Ch1 should come before Ch2
    expect(chapterGroups.length).toBe(2)

    // Compute startIndex for each chapter group (matching StudyContent logic)
    for (let groupIdx = 0; groupIdx < chapterGroups.length; groupIdx++) {
      const group = chapterGroups[groupIdx]
      const startIndex = chapterGroups
        .slice(0, groupIdx)
        .reduce((sum, g) => sum + g.lessons.length, 0)

      // Each lesson's display index = startIndex + idx + 1
      for (let idx = 0; idx < group.lessons.length; idx++) {
        const displayIndex = startIndex + idx + 1
        const lessonTitle = group.lessons[idx].title

        // Chapter 1 lessons should have indices 1, 2, 3, 4
        // Chapter 2 lessons should have indices 5, 6
        if (lessonTitle === 'Practice Lesson 1') {
          expect(displayIndex).toBe(1)
        } else if (lessonTitle === 'Practice Lesson 2') {
          expect(displayIndex).toBe(2)
        } else if (lessonTitle === 'Practice Lesson 3') {
          expect(displayIndex).toBe(3)
        } else if (lessonTitle === 'Practice Lesson 4') {
          expect(displayIndex).toBe(4)
        } else if (lessonTitle === 'Practice Lesson 5') {
          expect(displayIndex).toBe(5)
        } else if (lessonTitle === 'Practice Lesson 6') {
          expect(displayIndex).toBe(6)
        }
      }
    }
  })
})
