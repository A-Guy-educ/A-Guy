// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing which depends on
// Node.js's native TextEncoder/Uint8Array.

/**
 * Integration test: Study page falls back to practice lessons when no learning lessons exist
 *
 * Issue #1893: Study page shows no topics for a course with available content in Practice
 * The Study page should show practice lessons when no dedicated learning lessons exist,
 * rather than showing an empty state.
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
let chapterId: string
let practiceLessonId: string
let learningLessonId: string
const GRADE_LEVEL = `study-fallback-grade-${Date.now()}`

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Create default tenant
  const existingTenants = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: 'default' } },
    limit: 1,
    overrideAccess: true,
  })
  const tenantId =
    existingTenants.docs[0]?.id ??
    (
      await payload.create({
        collection: 'tenants',
        data: { name: 'Default Tenant', slug: 'default', status: 'active' },
        overrideAccess: true,
      })
    ).id

  // Create course with chapter and ONLY practice lessons (no learning lessons)
  const category = await payload.create({
    collection: 'categories',
    data: {
      title: `Study Fallback Category ${Date.now()}`,
      slug: `study-fallback-cat-${Date.now()}`,
      locale: 'he',
    },
  })

  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: GRADE_LEVEL,
      title: `Study Fallback Course ${Date.now()}`,
      locale: 'he',
      categories: [category.id],
      order: 0,
      status: 'published',
      isActive: true,
      tenant: tenantId,
      pageAccessType: 'free',
      accessType: 'free',
      contentStatus: 'none',
      contentStatusVisible: true,
    },
    draft: false,
  })
  courseId = course.id

  const chapter = await payload.create({
    collection: 'chapters',
    data: {
      title: `Study Fallback Chapter ${Date.now()}`,
      chapterLabel: 'Ch-1',
      course: courseId,
      order: 0,
      status: 'published',
      isActive: true,
      tenant: tenantId,
      locale: 'he',
    },
  })
  chapterId = chapter.id

  // Create a practice lesson on the primary chapter
  const practiceLesson = await payload.create({
    collection: 'lessons',
    data: {
      title: 'Practice Only Lesson',
      slug: `practice-only-lesson-${Date.now()}`,
      chapter: chapterId,
      type: 'practice',
      order: 1,
      status: 'published',
      isActive: true,
      tenant: tenantId,
      locale: 'he',
      accessType: 'inherit',
      contentStatus: 'none',
      contentStatusVisible: true,
    },
    draft: false,
  })
  practiceLessonId = practiceLesson.id

  // Create a learning lesson on a DIFFERENT chapter (so the primary course chapter has no learning lessons)
  const otherChapter = await payload.create({
    collection: 'chapters',
    data: {
      title: `Other Chapter ${Date.now()}`,
      chapterLabel: 'Ch-2',
      course: courseId,
      order: 1,
      status: 'published',
      isActive: true,
      tenant: tenantId,
      locale: 'he',
    },
  })

  const learningLesson = await payload.create({
    collection: 'lessons',
    data: {
      title: 'Learning Lesson (different chapter)',
      slug: `learning-lesson-other-ch-${Date.now()}`,
      chapter: otherChapter.id,
      type: 'learning',
      order: 1,
      status: 'published',
      isActive: true,
      tenant: tenantId,
      locale: 'he',
      accessType: 'inherit',
      contentStatus: 'none',
      contentStatusVisible: true,
    },
    draft: false,
  })
  learningLessonId = learningLesson.id

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
}, 60_000)

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

describe('Study page learning fallback', () => {
  it('returns practice lessons when learning lessons are absent for the course', async () => {
    // This reproduces the bug: Study page passes lessonType='learning'
    // but the course (Translate Test EN) only has practice lessons.
    // The function should fall back to practice lessons instead of returning empty chapters.
    const req = makeRequest(GRADE_LEVEL, { lessonType: 'learning' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.chapters).toBeDefined()
    expect(body.chapters.length).toBeGreaterThan(0)

    // The primary chapter should have lessons (practice lessons as fallback)
    const primaryChapter = body.chapters.find((ch: any) => ch.id === chapterId)
    expect(primaryChapter).toBeDefined()
    expect(primaryChapter.lessons.length).toBeGreaterThan(0)

    // The fallback lessons should be practice type
    const allLessonIds = body.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )
    expect(allLessonIds).toContain(practiceLessonId)
  })

  it('returns learning lessons when they exist (no fallback needed)', async () => {
    // When learning lessons DO exist for the course, they should be returned
    const req = makeRequest(GRADE_LEVEL, { lessonType: 'learning' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    // At least one chapter should have learning lessons
    const chaptersWithLearning = body.chapters.filter((ch: any) =>
      (ch.lessons ?? []).some((l: any) => l.type === 'learning'),
    )
    expect(chaptersWithLearning.length).toBeGreaterThan(0)

    const allLessonIds = body.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )
    expect(allLessonIds).toContain(learningLessonId)
  })

  it('returns practice lessons when lessonType=practice', async () => {
    // Practice page uses default lessonType='practice' - should work normally
    const req = makeRequest(GRADE_LEVEL, { lessonType: 'practice' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.chapters.length).toBeGreaterThan(0)

    // Practice lessons should be returned
    const allLessonIds = body.chapters.flatMap((ch: any) =>
      (ch.lessons ?? []).map((l: any) => l.id),
    )
    expect(allLessonIds).toContain(practiceLessonId)
  })
})
