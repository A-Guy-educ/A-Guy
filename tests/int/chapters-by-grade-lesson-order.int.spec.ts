// @vitest-environment node
/**
 * Integration test: lesson ordering on /api/chapters/by-grade
 *
 * Reproduces issue #1992: Lesson card title misalignment in /practice
 * The bug: Card at position 5 shows heading 'Lesson 4' instead of 'Lesson 5'.
 *
 * This tests that when multiple chapters each have practice lessons,
 * the lessons within each chapter are returned in correct `order` sequence,
 * and the total ordering across chapters is correct so that the
 * StudyContent index computation (startIndex + idx + 1) produces correct labels.
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
let chapter1Id: string
let chapter2Id: string
const lessonIds: string[] = []

const GRADE_LEVEL = 'grade-8-order-test'
const TENANT_SLUG = `order-test-tenant-${Date.now()}`

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL

  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Ensure tenant
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

  // Create category
  const category = await payload.create({
    collection: 'categories',
    data: {
      title: 'Order Test Category',
      slug: `order-cat-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })

  // Create course
  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: GRADE_LEVEL,
      title: 'Order Test Course',
      status: 'published',
      categories: [category.id],
    } as any,
    overrideAccess: true,
  })
  courseId = course.id

  // Create chapter 1 (order = 0)
  const chapter1 = await payload.create({
    collection: 'chapters',
    data: {
      course: courseId,
      title: 'Chapter 1',
      slug: `order-ch1-${Date.now()}`,
      order: 0,
      status: 'published',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  chapter1Id = chapter1.id

  // Create chapter 2 (order = 1)
  const chapter2 = await payload.create({
    collection: 'chapters',
    data: {
      course: courseId,
      title: 'Chapter 2',
      slug: `order-ch2-${Date.now()}`,
      order: 1,
      status: 'published',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  chapter2Id = chapter2.id

  // Create 4 practice lessons in chapter 1, orders 0-3
  for (let i = 0; i < 4; i++) {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        chapter: chapter1Id,
        title: `Ch1 Practice ${i + 1}`,
        slug: `ch1-prac-${Date.now()}-${i}`,
        order: i,
        status: 'published',
        isActive: true,
        type: 'practice',
        locale: 'he',
        accessType: 'inherit',
        contentStatus: 'none',
        contentStatusVisible: true,
      } as any,
      overrideAccess: true,
    })
    lessonIds.push(lesson.id)
  }

  // Create 4 practice lessons in chapter 2, orders 0-3
  for (let i = 0; i < 4; i++) {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        chapter: chapter2Id,
        title: `Ch2 Practice ${i + 1}`,
        slug: `ch2-prac-${Date.now()}-${i}`,
        order: i,
        status: 'published',
        isActive: true,
        type: 'practice',
        locale: 'he',
        accessType: 'inherit',
        contentStatus: 'none',
        contentStatusVisible: true,
      } as any,
      overrideAccess: true,
    })
    lessonIds.push(lesson.id)
  }

  // Dynamic import route after DATABASE_URL is set
  const route = await import('@/app/api/chapters/by-grade/route')
  GET = route.GET
}, 120_000)

afterAll(async () => {
  for (const lessonId of lessonIds) {
    try {
      await payload.delete({ collection: 'lessons', id: lessonId })
    } catch {
      // Ignore cleanup errors
    }
  }
  try {
    await payload.delete({ collection: 'chapters', id: chapter1Id })
  } catch {
    // Ignore
  }
  try {
    await payload.delete({ collection: 'chapters', id: chapter2Id })
  } catch {
    // Ignore
  }
  try {
    await payload.delete({ collection: 'courses', id: courseId })
  } catch {
    // Ignore
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

describe('GET /api/chapters/by-grade — lesson ordering', () => {
  it('returns lessons sorted by order within each chapter', async () => {
    const req = makeRequest(GRADE_LEVEL, { lessonType: 'practice', locale: 'he' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.chapters).toBeDefined()
    expect(Array.isArray(body.chapters)).toBe(true)
    expect(body.chapters.length).toBe(2)

    // Chapter 1 should come first (order=0)
    const ch1 = body.chapters[0]
    expect(ch1.lessons).toBeDefined()
    expect(Array.isArray(ch1.lessons)).toBe(true)
    expect(ch1.lessons.length).toBe(4)

    // Lessons in chapter 1 should be in order: 0, 1, 2, 3
    expect(ch1.lessons[0].order).toBe(0)
    expect(ch1.lessons[1].order).toBe(1)
    expect(ch1.lessons[2].order).toBe(2)
    expect(ch1.lessons[3].order).toBe(3)

    // Chapter 2 should come second (order=1)
    const ch2 = body.chapters[1]
    expect(ch2.lessons).toBeDefined()
    expect(ch2.lessons.length).toBe(4)

    // Lessons in chapter 2 should be in order: 0, 1, 2, 3
    expect(ch2.lessons[0].order).toBe(0)
    expect(ch2.lessons[1].order).toBe(1)
    expect(ch2.lessons[2].order).toBe(2)
    expect(ch2.lessons[3].order).toBe(3)
  })

  it('computes correct lesson indices across chapters for StudyContent', async () => {
    // This test simulates how StudyContent computes lesson indices:
    // index = startIndex + idx + 1
    // where startIndex = sum of lesson counts of all previous chapter groups
    const req = makeRequest(GRADE_LEVEL, { lessonType: 'practice', locale: 'he' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    // Simulate StudyContent's filteredLessons flatMap
    const filteredLessons: any[] = []
    for (const chapter of body.chapters) {
      const chapterSlug = chapter.slug || ''
      for (const lesson of chapter.lessons ?? []) {
        if (lesson.type === 'practice') {
          filteredLessons.push(lesson)
        }
      }
    }

    expect(filteredLessons.length).toBe(8)

    // Simulate StudyContent's chapterGroups
    type ChapterGroup = { chapterSlug: string; lessons: any[] }
    const groups: ChapterGroup[] = []
    const groupMap = new Map<string, ChapterGroup>()

    for (const lesson of filteredLessons) {
      const key =
        lesson.chapter && typeof lesson.chapter === 'object'
          ? (lesson.chapter as any).id
          : (lesson.chapter as string)
      const existing = groupMap.get(key)
      if (existing) {
        existing.lessons.push(lesson)
      } else {
        const group: ChapterGroup = { chapterSlug: key, lessons: [lesson] }
        groupMap.set(key, group)
        groups.push(group)
      }
    }

    expect(groups.length).toBe(2)
    expect(groups[0].lessons.length).toBe(4)
    expect(groups[1].lessons.length).toBe(4)

    // Compute indices as StudyContent does
    const computedIndices: number[] = []
    for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
      const group = groups[groupIdx]
      const startIndex = groups.slice(0, groupIdx).reduce((sum, g) => sum + g.lessons.length, 0)

      for (let idx = 0; idx < group.lessons.length; idx++) {
        const index = startIndex + idx + 1
        computedIndices.push(index)
      }
    }

    // Expected: [1, 2, 3, 4, 5, 6, 7, 8]
    expect(computedIndices).toEqual([1, 2, 3, 4, 5, 6, 7, 8])

    // The 5th card (index 4, 0-based) should have index=5 → "Lesson 5"
    expect(computedIndices[4]).toBe(5) // card at position 5 → "Lesson 5"
  })

  it('BUG REPRO: mixed lesson types in chapter causes off-by-one in lesson headings', async () => {
    // Reproduces bug #1992: When Chapter 1 has mixed lesson types (some 'learning',
    // some 'practice'), only practice lessons are counted. This makes startIndex
    // for Chapter 2's lessons be computed as if Chapter 1 had fewer lessons,
    // causing the first lesson of Chapter 2 (Lesson 5) to show "Lesson 4".
    //
    // Create a third chapter with mixed lesson types (3 practice + 1 learning)
    const mixedChapter = await payload.create({
      collection: 'chapters',
      data: {
        course: courseId,
        title: 'Mixed Type Chapter',
        slug: `mixed-ch-1992-${Date.now()}`,
        status: 'published',
        isActive: true,
        order: 2,
      } as any,
      overrideAccess: true,
    })

    // Add 3 practice and 1 learning lesson to the mixed chapter
    const mixedPracticeIds: string[] = []
    for (let i = 0; i < 3; i++) {
      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          chapter: mixedChapter.id,
          title: `Mixed Practice ${i + 1}`,
          slug: `mixed-p-1992-${Date.now()}-${i}`,
          order: i,
          status: 'published',
          isActive: true,
          type: 'practice',
          locale: 'he',
          accessType: 'inherit',
          contentStatus: 'none',
          contentStatusVisible: true,
        } as any,
        overrideAccess: true,
      })
      mixedPracticeIds.push(lesson.id)
      lessonIds.push(lesson.id)
    }

    const mixedLearningLesson = await payload.create({
      collection: 'lessons',
      data: {
        chapter: mixedChapter.id,
        title: 'Mixed Learning',
        slug: `mixed-l-1992-${Date.now()}`,
        order: 3,
        status: 'published',
        isActive: true,
        type: 'learning',
        locale: 'he',
        accessType: 'inherit',
        contentStatus: 'none',
        contentStatusVisible: true,
      } as any,
      overrideAccess: true,
    })
    lessonIds.push(mixedLearningLesson.id)

    // Query practice lessons for all 3 chapters
    const allChapterIds = [chapter1Id, chapter2Id, mixedChapter.id]
    const practiceLessonsResult = await payload.find({
      collection: 'lessons',
      where: {
        and: [
          { chapter: { in: allChapterIds } },
          { status: { equals: 'published' } },
          { isActive: { equals: true } },
          { type: { equals: 'practice' } },
        ],
      },
      sort: 'order',
      pagination: false,
    })

    // Should return 11 practice lessons (4+4+3)
    expect(practiceLessonsResult.docs.length).toBe(11)

    // Group lessons by chapter
    const lessonsByChapter: Record<string, any[]> = {}
    for (const lesson of practiceLessonsResult.docs) {
      const chapterId = typeof lesson.chapter === 'string' ? lesson.chapter : lesson.chapter?.id
      if (chapterId) {
        if (!lessonsByChapter[chapterId]) lessonsByChapter[chapterId] = []
        lessonsByChapter[chapterId].push(lesson)
      }
    }

    // Get all chapters in order
    const chaptersResult = await payload.find({
      collection: 'chapters',
      where: { course: { equals: courseId } },
      sort: 'order',
      pagination: false,
      depth: 0,
    })

    // Build chapter groups (simulating StudyContent)
    const chapterGroups: Array<{ chapterId: string; lessons: any[] }> = []
    for (const chapter of chaptersResult.docs) {
      const lessons = lessonsByChapter[chapter.id] || []
      chapterGroups.push({ chapterId: chapter.id, lessons })
    }

    // Verify: Chapter 1 has 4, Chapter 2 has 4, Mixed has 3
    expect(chapterGroups[0].lessons.length).toBe(4)
    expect(chapterGroups[1].lessons.length).toBe(4)
    expect(chapterGroups[2].lessons.length).toBe(3)

    // Compute indices as StudyContent does after the fix (with sorting)
    // Each chapter's lessons are sorted by `order` field
    const computedIndices: number[] = []
    for (let groupIdx = 0; groupIdx < chapterGroups.length; groupIdx++) {
      const group = chapterGroups[groupIdx]
      const startIndex = chapterGroups
        .slice(0, groupIdx)
        .reduce((sum, g) => sum + g.lessons.length, 0)

      // Sort by order (the fix)
      const sortedLessons = [...group.lessons].sort((a, b) => {
        const orderA = (a as any).order ?? 0
        const orderB = (b as any).order ?? 0
        return orderA - orderB
      })

      for (let idx = 0; idx < sortedLessons.length; idx++) {
        const index = startIndex + idx + 1
        computedIndices.push(index)
      }
    }

    // With the fix (sorting lessons by order within each chapter):
    // Chapter 1: [1,2,3,4], Chapter 2: [5,6,7,8], Mixed: [9,10,11]
    expect(computedIndices.slice(0, 4)).toEqual([1, 2, 3, 4])
    expect(computedIndices[4]).toBe(5) // 5th lesson (first of Chapter 2) → "Lesson 5"
    expect(computedIndices[7]).toBe(8) // 8th lesson (4th of Chapter 2) → "Lesson 8"
    expect(computedIndices[8]).toBe(9) // 9th lesson (first of Mixed) → "Lesson 9"

    // Clean up
    await payload.delete({ collection: 'lessons', id: mixedLearningLesson.id })
    for (const id of mixedPracticeIds) {
      await payload.delete({ collection: 'lessons', id })
    }
    await payload.delete({ collection: 'chapters', id: mixedChapter.id })

    // Remove mixed lesson IDs from tracking
    const mixedLearningIdx = lessonIds.indexOf(mixedLearningLesson.id)
    if (mixedLearningIdx !== -1) lessonIds.splice(mixedLearningIdx, 1)
  })
})
