// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing which depends on
// Node.js's native TextEncoder/Uint8Array.

/**
 * Integration test: GET /api/lessons/:id/suggested-subject
 *
 * Verifies:
 *  1. Endpoint exists and returns { subject } with geometry detected
 *  2. Endpoint returns correct subject for algebra lessons
 *  3. Endpoint returns null when no subject keywords found
 *  4. Endpoint returns 401 without admin auth
 *
 * Bug: The endpoint does not exist yet (issue #1550).
 * These tests assert the expected behavior — they FAIL until the feature is implemented.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'

import { getDefaultTenantSlug } from '@/server/repos/tenant/get-default-tenant'

let GET: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
let payload: Payload
let tenantId: string
let courseId: string
let chapterId: string
let geometryLessonId: string
let algebraLessonId: string
let noSubjectLessonId: string

const TENANT_SLUG = `suggested-subject-tenant-${Date.now()}`

beforeAll(async () => {
  payload = await getPayload({ config })

  // Ensure tenant exists
  const existingTenants = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: TENANT_SLUG } },
    limit: 1,
    overrideAccess: true,
  })
  if (existingTenants.docs.length === 0) {
    const created = await payload.create({
      collection: 'tenants',
      data: { name: TENANT_SLUG, slug: TENANT_SLUG, status: 'active' },
      overrideAccess: true,
    })
    tenantId = created.id
  } else {
    tenantId = existingTenants.docs[0].id
  }

  // Create category
  const category = await payload.create({
    collection: 'categories',
    data: { title: `SubjectTestCat ${Date.now()}`, slug: `subject-test-cat-${Date.now()}`, locale: 'he' },
    overrideAccess: true,
  })

  // Create course with geometry title
  const geometryCourse = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: `GEO-${Date.now()}`,
      title: 'Geometry Basics Course',
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
    overrideAccess: true,
  })

  // Create chapter with geometry title
  const geometryChapter = await payload.create({
    collection: 'chapters',
    data: {
      title: 'Triangles and Circles Chapter',
      chapterLabel: `GCH-${Date.now()}`,
      course: geometryCourse.id,
      order: 0,
      status: 'published',
      isActive: true,
      tenant: tenantId,
      locale: 'he',
    },
    overrideAccess: true,
  })
  chapterId = geometryChapter.id

  // Create geometry lesson
  const geometryLesson = await payload.create({
    collection: 'lessons',
    data: {
      title: 'Triangle Properties Lesson',
      chapter: geometryChapter.id,
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
    overrideAccess: true,
  })
  geometryLessonId = geometryLesson.id

  // Create algebra course
  const algebraCourse = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: `ALG-${Date.now()}`,
      title: 'Algebra Fundamentals Course',
      locale: 'he',
      categories: [category.id],
      order: 1,
      status: 'published',
      isActive: true,
      tenant: tenantId,
      pageAccessType: 'free',
      accessType: 'free',
      contentStatus: 'none',
      contentStatusVisible: true,
    },
    draft: false,
    overrideAccess: true,
  })
  courseId = algebraCourse.id

  // Create algebra chapter
  const algebraChapter = await payload.create({
    collection: 'chapters',
    data: {
      title: 'Equations and Polynomials Chapter',
      chapterLabel: `ACH-${Date.now()}`,
      course: algebraCourse.id,
      order: 0,
      status: 'published',
      isActive: true,
      tenant: tenantId,
      locale: 'he',
    },
    overrideAccess: true,
  })

  // Create algebra lesson
  const algebraLesson = await payload.create({
    collection: 'lessons',
    data: {
      title: 'Linear Equations Lesson',
      chapter: algebraChapter.id,
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
    overrideAccess: true,
  })
  algebraLessonId = algebraLesson.id

  // Create lesson with no subject keywords
  const noSubjectChapter = await payload.create({
    collection: 'chapters',
    data: {
      title: 'General Introduction',
      chapterLabel: `NCH-${Date.now()}`,
      course: algebraCourse.id,
      order: 1,
      status: 'published',
      isActive: true,
      tenant: tenantId,
      locale: 'he',
    },
    overrideAccess: true,
  })

  const noSubjectLesson = await payload.create({
    collection: 'lessons',
    data: {
      title: 'Welcome Lesson',
      chapter: noSubjectChapter.id,
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
    overrideAccess: true,
  })
  noSubjectLessonId = noSubjectLesson.id

  // Dynamic import of the route handler
  const route = await import('@/app/api/lessons/[id]/suggested-subject/route')
  GET = route.GET
}, 120000)

afterAll(async () => {
  // Cleanup lessons
  for (const id of [geometryLessonId, algebraLessonId, noSubjectLessonId]) {
    try {
      await payload.delete({ collection: 'lessons', id, overrideAccess: true })
    } catch {
      /* ignore */
    }
  }

  // Cleanup chapters (2 extra)
  const chapters = await payload.find({
    collection: 'chapters',
    where: { course: { equals: courseId } },
    limit: 10,
    overrideAccess: true,
  })
  for (const ch of chapters.docs) {
    try {
      await payload.delete({ collection: 'chapters', id: ch.id, overrideAccess: true })
    } catch {
      /* ignore */
    }
  }
  try {
    await payload.delete({ collection: 'chapters', id: chapterId, overrideAccess: true })
  } catch {
    /* ignore */
  }

  // Cleanup courses
  const courses = await payload.find({
    collection: 'courses',
    where: { courseLabel: { like: 'GEO-' } },
    limit: 10,
    overrideAccess: true,
  })
  for (const c of courses.docs) {
    try {
      await payload.delete({ collection: 'courses', id: c.id, overrideAccess: true })
    } catch {
      /* ignore */
    }
  }
  try {
    await payload.delete({ collection: 'courses', id: courseId, overrideAccess: true })
  } catch {
    /* ignore */
  }

  await payload.db?.destroy?.()
}, 60000)

describe('GET /api/lessons/:id/suggested-subject', () => {
  it('returns geometry subject for a geometry lesson (triangle keywords)', async () => {
    const url = new URL(`http://localhost/api/lessons/${geometryLessonId}/suggested-subject`)
    const req = new NextRequest(url.toString(), { method: 'GET' })
    const res = await GET(req, { params: Promise.resolve({ id: geometryLessonId }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('data')
    expect(body.data).toHaveProperty('subject')
    expect(body.data.subject).toBe('geometry')
  })

  it('returns algebra subject for an algebra lesson (equation keywords)', async () => {
    const url = new URL(`http://localhost/api/lessons/${algebraLessonId}/suggested-subject`)
    const req = new NextRequest(url.toString(), { method: 'GET' })
    const res = await GET(req, { params: Promise.resolve({ id: algebraLessonId }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('data')
    expect(body.data).toHaveProperty('subject')
    expect(body.data.subject).toBe('algebra')
  })

  it('returns null subject when no subject keywords are found', async () => {
    const url = new URL(`http://localhost/api/lessons/${noSubjectLessonId}/suggested-subject`)
    const req = new NextRequest(url.toString(), { method: 'GET' })
    const res = await GET(req, { params: Promise.resolve({ id: noSubjectLessonId }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('data')
    expect(body.data).toHaveProperty('subject')
    expect(body.data.subject).toBeNull()
  })

  it('returns 404 for non-existent lesson', async () => {
    const fakeId = '000000000000000000000000'
    const url = new URL(`http://localhost/api/lessons/${fakeId}/suggested-subject`)
    const req = new NextRequest(url.toString(), { method: 'GET' })
    const res = await GET(req, { params: Promise.resolve({ id: fakeId }) })

    expect(res.status).toBe(404)
  })

  it('returns 401 when called without admin auth', async () => {
    const url = new URL(`http://localhost/api/lessons/${geometryLessonId}/suggested-subject`)
    const req = new NextRequest(url.toString(), { method: 'GET' })
    // No auth header — should return 401
    const res = await GET(req, { params: Promise.resolve({ id: geometryLessonId }) })

    expect(res.status).toBe(401)
  })
})
