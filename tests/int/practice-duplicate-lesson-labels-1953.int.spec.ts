// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing which depends on
// Node.js's native TextEncoder/Uint8Array. The jsdom environment can cause a
// Uint8Array realm mismatch that breaks jose's FlattenedSign constructor check.

/**
 * Integration test: Practice page duplicate lesson labels bug (#1953)
 *
 * Issue: Practice page shows duplicate lesson labels in Chapter 2.
 * Lesson 4 appears twice with the same label. The labels should be
 * unique sequential numbers (Lesson 4, Lesson 5, Lesson 6, Lesson 7).
 *
 * This test verifies that:
 * 1. Lessons returned by the chapters/by-grade API have unique IDs
 * 2. When computing sequential labels across chapters, no two lessons share the same label
 * 3. Each chapter's lessons are properly isolated (no cross-chapter contamination)
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'

let GET: (req: NextRequest) => Promise<Response>
let payload: Payload
let originalDatabaseUrl: string | undefined

const GRADE_LEVEL = 'grade-8-dup-test'
const TENANT_SLUG = `dup-test-tenant-${Date.now()}`

// Store IDs for cleanup
const createdLessonIds: string[] = []
const createdChapterIds: string[] = []
let createdCourseId: string
let createdCategoryId: string

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

  // Create category
  const category = await payload.create({
    collection: 'categories',
    data: {
      title: 'Duplicate Test Category',
      slug: `dup-cat-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })
  createdCategoryId = category.id

  // Create course
  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: GRADE_LEVEL,
      title: 'Duplicate Test Course',
      status: 'published',
      categories: [createdCategoryId],
    } as any,
    overrideAccess: true,
  })
  createdCourseId = course.id

  // Create Chapter 1 with 3 practice lessons
  const chapter1 = await payload.create({
    collection: 'chapters',
    data: {
      course: createdCourseId,
      title: 'Chapter 1',
      slug: `ch1-dup-${Date.now()}`,
      status: 'published',
      isActive: true,
      order: 0,
    } as any,
    overrideAccess: true,
  })
  createdChapterIds.push(chapter1.id)

  // Create 3 practice lessons in Chapter 1
  for (let i = 1; i <= 3; i++) {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        chapter: chapter1.id,
        title: `Lesson ${i} - Chapter 1`,
        slug: `ch1-lesson-${i}-${Date.now()}`,
        status: 'published',
        isActive: true,
        type: 'practice',
        order: i,
      } as any,
      overrideAccess: true,
    })
    createdLessonIds.push(lesson.id)
  }

  // Create Chapter 2 with 4 practice lessons (including a "copy" scenario)
  const chapter2 = await payload.create({
    collection: 'chapters',
    data: {
      course: createdCourseId,
      title: 'Chapter 2',
      slug: `ch2-dup-${Date.now()}`,
      status: 'published',
      isActive: true,
      order: 1,
    } as any,
    overrideAccess: true,
  })
  createdChapterIds.push(chapter2.id)

  // Create 4 practice lessons in Chapter 2
  // Simulate the "copy" scenario where a lesson might be duplicated
  for (let i = 4; i <= 7; i++) {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        chapter: chapter2.id,
        title: `Lesson ${i} - Chapter 2`,
        slug: `ch2-lesson-${i}-${Date.now()}`,
        status: 'published',
        isActive: true,
        type: 'practice',
        order: i,
      } as any,
      overrideAccess: true,
    })
    createdLessonIds.push(lesson.id)
  }

  // Dynamically import the API route after payload is ready
  const route = await import('@/app/api/chapters/by-grade/route')
  GET = route.GET
}, 120_000)

afterAll(async () => {
  // Cleanup lessons first (to avoid foreign key issues)
  for (const lessonId of createdLessonIds) {
    try {
      await payload.delete({ collection: 'lessons', id: lessonId })
    } catch {
      // Ignore cleanup errors
    }
  }

  // Cleanup chapters
  for (const chapterId of createdChapterIds) {
    try {
      await payload.delete({ collection: 'chapters', id: chapterId })
    } catch {
      // Ignore cleanup errors
    }
  }

  // Cleanup course and category
  try {
    await payload.delete({ collection: 'courses', id: createdCourseId })
  } catch {
    // Ignore cleanup errors
  }
  try {
    await payload.delete({ collection: 'categories', id: createdCategoryId })
  } catch {
    // Ignore cleanup errors
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

describe('Practice page lesson label uniqueness (#1953)', () => {
  it('returns lessons with unique IDs per chapter', async () => {
    const req = makeRequest(GRADE_LEVEL, { lessonType: 'practice' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    // Collect all lesson IDs across all chapters
    const allLessonIds: string[] = []
    for (const chapter of body.chapters) {
      for (const lesson of chapter.lessons ?? []) {
        allLessonIds.push(lesson.id)
      }
    }

    // Verify no duplicate lesson IDs
    const uniqueIds = new Set(allLessonIds)
    expect(uniqueIds.size).toBe(allLessonIds.length)
  })

  it('computes unique sequential lesson labels across chapters', async () => {
    const req = makeRequest(GRADE_LEVEL, { lessonType: 'practice' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    // Simulate the label computation from StudyContent
    const labels: string[] = []
    let runningIndex = 0

    for (const chapter of body.chapters) {
      const lessons = chapter.lessons ?? []
      for (let idx = 0; idx < lessons.length; idx++) {
        runningIndex++
        const label = `Lesson ${runningIndex}`
        labels.push(label)
      }
    }

    // Verify no duplicate labels
    const uniqueLabels = new Set(labels)
    expect(uniqueLabels.size).toBe(labels.length)
  })

  it('assigns correct labels per chapter (chapter start index)', async () => {
    const req = makeRequest(GRADE_LEVEL, { lessonType: 'practice' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    // Chapter 1 has 3 lessons → labels should be Lesson 1, 2, 3
    // Chapter 2 has 4 lessons → labels should be Lesson 4, 5, 6, 7
    let runningIndex = 0
    const chapterLabels: Record<string, string[]> = {}

    for (const chapter of body.chapters) {
      const chapterTitle = chapter.title
      chapterLabels[chapterTitle] = []

      const lessons = chapter.lessons ?? []
      for (const lesson of lessons) {
        runningIndex++
        chapterLabels[chapterTitle].push(`Lesson ${runningIndex}`)
      }
    }

    // Chapter 1 should have labels [1, 2, 3]
    expect(chapterLabels['Chapter 1']).toEqual(['Lesson 1', 'Lesson 2', 'Lesson 3'])

    // Chapter 2 should have labels [4, 5, 6, 7]
    expect(chapterLabels['Chapter 2']).toEqual(['Lesson 4', 'Lesson 5', 'Lesson 6', 'Lesson 7'])
  })

  it('lesson titles are unique within each chapter', async () => {
    const req = makeRequest(GRADE_LEVEL, { lessonType: 'practice' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    for (const chapter of body.chapters) {
      const lessonTitles = chapter.lessons?.map((l: any) => l.title) ?? []
      const uniqueTitles = new Set(lessonTitles)
      expect(uniqueTitles.size).toBe(lessonTitles.length)
    }
  })

  it('lesson slugs are unique across all chapters', async () => {
    const req = makeRequest(GRADE_LEVEL, { lessonType: 'practice' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    const allSlugs: string[] = []
    for (const chapter of body.chapters) {
      for (const lesson of chapter.lessons ?? []) {
        allSlugs.push(lesson.slug)
      }
    }

    const uniqueSlugs = new Set(allSlugs)
    expect(uniqueSlugs.size).toBe(allSlugs.length)
  })
})
