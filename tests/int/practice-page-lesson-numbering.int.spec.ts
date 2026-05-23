// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing which depends on
// Node.js's native TextEncoder/Uint8Array.

/**
 * Integration test: Practice page lesson card heading numbering
 *
 * Issue #1896: Practice page lesson card heading does not match lesson number
 * When there are multiple chapters, the lesson card headings should increment
 * sequentially across chapters (e.g., Chapter 1 has lessons 1-3, Chapter 2 has lessons 4-6).
 *
 * This test verifies that the API returns the correct lesson order and grouping
 * for the practice page.
 */
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
const GRADE_LEVEL = `practice-lesson-num-grade-${Date.now()}`
const TENANT_SLUG = `pln-test-tenant-${Date.now()}`

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

  const tenantId = existingTenants.docs[0]?.id

  // Create a course with 2 chapters
  const category = await payload.create({
    collection: 'categories',
    data: {
      title: `Practice Lesson Numbering Category ${Date.now()}`,
      slug: `pln-cat-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })

  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: GRADE_LEVEL,
      title: 'Practice Lesson Numbering Course',
      status: 'published',
      categories: [category.id],
    } as any,
    overrideAccess: true,
  })
  courseId = course.id

  // Create Chapter 1 with 3 practice lessons
  const chapter1 = await payload.create({
    collection: 'chapters',
    data: {
      course: courseId,
      title: 'Chapter 1',
      slug: `pln-chapter-1-${Date.now()}`,
      chapterLabel: 'Ch-1',
      order: 0,
      status: 'published',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  chapter1Id = chapter1.id

  // Create 3 practice lessons in Chapter 1
  const ch1Lesson1 = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapter1Id,
      title: 'Chapter 1 - Lesson 1',
      slug: `pln-ch1-lesson-1-${Date.now()}`,
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
      title: 'Chapter 1 - Lesson 2',
      slug: `pln-ch1-lesson-2-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'practice',
      order: 2,
    } as any,
    overrideAccess: true,
  })

  const ch1Lesson3 = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapter1Id,
      title: 'Chapter 1 - Lesson 3',
      slug: `pln-ch1-lesson-3-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'practice',
      order: 3,
    } as any,
    overrideAccess: true,
  })

  // Create Chapter 2 with 3 practice lessons
  const chapter2 = await payload.create({
    collection: 'chapters',
    data: {
      course: courseId,
      title: 'Chapter 2',
      slug: `pln-chapter-2-${Date.now()}`,
      chapterLabel: 'Ch-2',
      order: 1,
      status: 'published',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  chapter2Id = chapter2.id

  // Create 3 practice lessons in Chapter 2
  const ch2Lesson1 = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapter2Id,
      title: 'Chapter 2 - Lesson 1',
      slug: `pln-ch2-lesson-1-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'practice',
      order: 1,
    } as any,
    overrideAccess: true,
  })

  const ch2Lesson2 = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapter2Id,
      title: 'Chapter 2 - Lesson 2',
      slug: `pln-ch2-lesson-2-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'practice',
      order: 2,
    } as any,
    overrideAccess: true,
  })

  const ch2Lesson3 = await payload.create({
    collection: 'lessons',
    data: {
      chapter: chapter2Id,
      title: 'Chapter 2 - Lesson 3',
      slug: `pln-ch2-lesson-3-${Date.now()}`,
      status: 'published',
      isActive: true,
      type: 'practice',
      order: 3,
    } as any,
    overrideAccess: true,
  })

  // Dynamic import after DATABASE_URL is set
  const route = await import('@/app/api/chapters/by-grade/route')
  GET = route.GET
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

describe('Practice page lesson numbering across chapters', () => {
  it('returns 6 practice lessons across 2 chapters', async () => {
    const req = makeRequest(GRADE_LEVEL, { lessonType: 'practice' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.chapters).toBeDefined()
    expect(body.chapters.length).toBe(2)

    // Collect all practice lesson IDs
    const allLessons = body.chapters.flatMap((ch: any) => ch.lessons ?? [])
    expect(allLessons.length).toBe(6)
  })

  it('groups lessons correctly by chapter - Chapter 1 has 3 lessons, Chapter 2 has 3 lessons', async () => {
    const req = makeRequest(GRADE_LEVEL, { lessonType: 'practice' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    const ch1 = body.chapters.find((ch: any) => ch.id === chapter1Id)
    const ch2 = body.chapters.find((ch: any) => ch.id === chapter2Id)

    expect(ch1).toBeDefined()
    expect(ch2).toBeDefined()
    expect(ch1.lessons.length).toBe(3)
    expect(ch2.lessons.length).toBe(3)
  })

  it('lessons within each chapter are ordered by their order field', async () => {
    const req = makeRequest(GRADE_LEVEL, { lessonType: 'practice' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    const ch1 = body.chapters.find((ch: any) => ch.id === chapter1Id)
    const ch2 = body.chapters.find((ch: any) => ch.id === chapter2Id)

    // Chapter 1 lessons should be ordered 1, 2, 3
    expect(ch1.lessons[0].order).toBe(1)
    expect(ch1.lessons[1].order).toBe(2)
    expect(ch1.lessons[2].order).toBe(3)

    // Chapter 2 lessons should be ordered 1, 2, 3
    expect(ch2.lessons[0].order).toBe(1)
    expect(ch2.lessons[1].order).toBe(2)
    expect(ch2.lessons[2].order).toBe(3)
  })

  it('chapters are returned in order (Chapter 1 before Chapter 2)', async () => {
    const req = makeRequest(GRADE_LEVEL, { lessonType: 'practice' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    // First chapter should be Chapter 1
    expect(body.chapters[0].id).toBe(chapter1Id)
    expect(body.chapters[0].title).toBe('Chapter 1')

    // Second chapter should be Chapter 2
    expect(body.chapters[1].id).toBe(chapter2Id)
    expect(body.chapters[1].title).toBe('Chapter 2')
  })

  it('lessons are grouped correctly with chapter metadata preserved', async () => {
    const req = makeRequest(GRADE_LEVEL, { lessonType: 'practice' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    const ch1 = body.chapters.find((ch: any) => ch.id === chapter1Id)
    const ch2 = body.chapters.find((ch: any) => ch.id === chapter2Id)

    // Each lesson's chapter field (which may be populated object) should reference the correct chapter
    for (const lesson of ch1.lessons) {
      const lessonChapterId =
        typeof lesson.chapter === 'string' ? lesson.chapter : lesson.chapter?.id
      expect(lessonChapterId).toBe(chapter1Id)
    }

    for (const lesson of ch2.lessons) {
      const lessonChapterId =
        typeof lesson.chapter === 'string' ? lesson.chapter : lesson.chapter?.id
      expect(lessonChapterId).toBe(chapter2Id)
    }
  })
})
