/**
 * Integration test: generate exercises endpoint
 *
 * Tests the endpoint's validation, auth checks, and data transformation.
 * LLM generation is mocked since it requires external API calls.
 *
 * The endpoint is exercised via Payload's local API to keep tests focused
 * on data behavior.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'

import { getDefaultTenantSlug } from '@/server/repos/tenant/get-default-tenant'
import { generateExercisesEndpoint } from '@/server/payload/endpoints/lessons/generate-exercises'

// Mock the exercise generation service to avoid LLM calls
vi.mock('@/infra/llm/services/exercise-generation-service', () => ({
  generateExercises: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        type: 'question_select',
        prompt: 'Test question 1',
        options: [
          { id: 'a', label: 'Option A', correct: true },
          { id: 'b', label: 'Option B', correct: false },
          { id: 'c', label: 'Option C', correct: false },
          { id: 'd', label: 'Option D', correct: false },
        ],
        hint: 'Hint 1',
        solution: 'Solution 1',
        fullSolution: 'Full solution 1',
      },
      {
        type: 'question_select',
        prompt: 'Test question 2',
        options: [
          { id: 'a', label: 'Option A', correct: false },
          { id: 'b', label: 'Option B', correct: true },
          { id: 'c', label: 'Option C', correct: false },
          { id: 'd', label: 'Option D', correct: false },
        ],
        hint: 'Hint 2',
        solution: 'Solution 2',
        fullSolution: 'Full solution 2',
      },
    ],
  }),
}))

vi.mock('@/infra/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}))

async function ensureDefaultTenant(payload: Payload): Promise<string> {
  const slug = getDefaultTenantSlug()
  const existing = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs[0]) return existing.docs[0].id
  const created = await payload.create({
    collection: 'tenants',
    data: { name: slug, slug, status: 'active' },
    overrideAccess: true,
  })
  return created.id
}

async function createTestLesson(
  payload: Payload,
  chapterId: string,
  tenantId: string,
  title: string,
) {
  return payload.create({
    collection: 'lessons',
    data: {
      title,
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
    overrideAccess: true,
  })
}

async function createTestChapter(
  payload: Payload,
  courseId: string,
  tenantId: string,
  title: string,
) {
  return payload.create({
    collection: 'chapters',
    data: {
      title,
      chapterLabel: `CH-${Date.now()}`,
      course: courseId,
      order: 0,
      status: 'published',
      isActive: true,
      tenant: tenantId,
      locale: 'he',
    },
    overrideAccess: true,
  })
}

async function createTestCourse(
  payload: Payload,
  categoryId: string,
  tenantId: string,
  title: string,
) {
  return payload.create({
    collection: 'courses',
    data: {
      courseLabel: `CR-${Date.now()}`,
      title,
      locale: 'he',
      categories: [categoryId],
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
}

async function createAdminUser(payload: Payload) {
  const ts = Date.now()
  // ensureRoleOnSignup hook strips role='admin' on create, so create without role
  // and update separately (same pattern as lesson-duplication-review-resolve tests).
  const user = await payload.create({
    collection: 'users',
    data: {
      email: `admin-${ts}@test.local`,
      password: 'TestPassword123!',
    } as never,
    overrideAccess: true,
  })
  await payload.update({
    collection: 'users',
    id: user.id,
    data: { role: 'admin' } as never,
    overrideAccess: true,
  })
  return { id: user.id }
}

describe('Generate exercises endpoint', () => {
  let payload: Payload
  let tenantId: string
  let categoryId: string
  let courseId: string
  let chapterId: string
  let adminUser: { id: string | number }
  let lessonId: string
  let req: { user: { id: string | number; role: string } }

  beforeAll(async () => {
    payload = await getPayload({ config })
    tenantId = await ensureDefaultTenant(payload)

    const ts = Date.now()
    const category = await payload.create({
      collection: 'categories',
      data: { title: `GenExCat ${ts}`, slug: `gen-ex-cat-${ts}`, locale: 'he' },
    })
    categoryId = category.id

    courseId = (await createTestCourse(payload, categoryId, tenantId, `GenEx Course ${ts}`)).id
    chapterId = (await createTestChapter(payload, courseId, tenantId, `GenEx Chapter ${ts}`)).id
    lessonId = (await createTestLesson(payload, chapterId, tenantId, `GenEx Lesson ${ts}`)).id

    adminUser = await createAdminUser(payload)
    req = { user: { id: adminUser.id, role: 'admin' } } as never
  }, 120000)

  afterAll(async () => {
    // Cleanup
    try {
      await payload.delete({ collection: 'lessons', id: lessonId, overrideAccess: true })
    } catch {
      // ignore
    }
    try {
      await payload.delete({ collection: 'chapters', id: chapterId, overrideAccess: true })
    } catch {
      // ignore
    }
    try {
      await payload.delete({ collection: 'courses', id: courseId, overrideAccess: true })
    } catch {
      // ignore
    }
    try {
      await payload.delete({ collection: 'categories', id: categoryId, overrideAccess: true })
    } catch {
      // ignore
    }
    try {
      await payload.delete({ collection: 'users', id: adminUser.id, overrideAccess: true })
    } catch {
      // ignore
    }
    await payload.db?.destroy?.()
  })

  it('returns 401 when no user is authenticated', async () => {
    const req = {
      payload,
      user: null,
      url: `http://localhost/api/lessons/${lessonId}/generate-exercises`,
      headers: new Headers(),
      json: async () => ({ prompt: 'Create exercises' }),
    } as unknown as PayloadRequest

    const res = await generateExercisesEndpoint(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Authentication required')
  })

  it('returns 403 when user is not admin', async () => {
    const nonAdminUser = await payload.create({
      collection: 'users',
      data: {
        email: `student-${Date.now()}@test.local`,
        password: 'TestPassword123!',
        role: 'student',
      } as never,
      overrideAccess: true,
    })

    const req = {
      payload,
      user: { id: nonAdminUser.id, role: 'student' } as PayloadRequest['user'],
      url: `http://localhost/api/lessons/${lessonId}/generate-exercises`,
      headers: new Headers(),
      json: async () => ({ prompt: 'Create exercises' }),
    } as unknown as PayloadRequest

    const res = await generateExercisesEndpoint(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Admin access required')

    await payload.delete({ collection: 'users', id: nonAdminUser.id, overrideAccess: true })
  })

  it('returns 400 when prompt is missing', async () => {
    const req = {
      payload,
      user: { id: adminUser.id, role: 'admin' } as PayloadRequest['user'],
      url: `http://localhost/api/lessons/${lessonId}/generate-exercises`,
      headers: new Headers(),
      json: async () => ({}),
    } as unknown as PayloadRequest

    const res = await generateExercisesEndpoint(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('prompt is required and must be non-empty')
  })

  it('returns 400 when prompt is empty string', async () => {
    const req = {
      payload,
      user: { id: adminUser.id, role: 'admin' } as PayloadRequest['user'],
      url: `http://localhost/api/lessons/${lessonId}/generate-exercises`,
      headers: new Headers(),
      json: async () => ({ prompt: '   ' }),
    } as unknown as PayloadRequest

    const res = await generateExercisesEndpoint(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('prompt is required and must be non-empty')
  })

  it('returns 400 when prompt exceeds 2000 characters', async () => {
    const req = {
      payload,
      user: { id: adminUser.id, role: 'admin' } as PayloadRequest['user'],
      url: `http://localhost/api/lessons/${lessonId}/generate-exercises`,
      headers: new Headers(),
      json: async () => ({ prompt: 'a'.repeat(2001) }),
    } as unknown as PayloadRequest

    const res = await generateExercisesEndpoint(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('prompt must be 2000 characters or less')
  })

  it('returns 400 when lesson id is missing from path', async () => {
    const req = {
      payload,
      user: { id: adminUser.id, role: 'admin' } as PayloadRequest['user'],
      url: 'http://localhost/api/lessons//generate-exercises',
      headers: new Headers(),
      json: async () => ({ prompt: 'Create exercises' }),
    } as unknown as PayloadRequest

    const res = await generateExercisesEndpoint(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Lesson id missing from path')
  })

  it('returns 404 when lesson does not exist', async () => {
    const fakeLessonId = '000000000000000000000000'
    const req = {
      payload,
      user: { id: adminUser.id, role: 'admin' } as PayloadRequest['user'],
      url: `http://localhost/api/lessons/${fakeLessonId}/generate-exercises`,
      headers: new Headers(),
      json: async () => ({ prompt: 'Create exercises' }),
    } as unknown as PayloadRequest

    const res = await generateExercisesEndpoint(req)
    expect(res.status).toBe(404)
  })

  it('returns 200 with exercise IDs on successful generation', async () => {
    const req = {
      payload,
      user: { id: adminUser.id, role: 'admin' } as PayloadRequest['user'],
      url: `http://localhost/api/lessons/${lessonId}/generate-exercises`,
      headers: new Headers(),
      json: async () => ({ prompt: 'Create some exercises', exerciseType: 'mcq' }),
    } as unknown as PayloadRequest

    const res = await generateExercisesEndpoint(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.count).toBe(2)
    expect(body.exerciseIds).toHaveLength(2)

    // Cleanup created exercises
    for (const exerciseId of body.exerciseIds) {
      await payload.delete({ collection: 'exercises', id: exerciseId, overrideAccess: true })
    }
  })
})
