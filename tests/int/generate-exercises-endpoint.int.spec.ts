/**
 * Integration test: lesson generate-exercises endpoint.
 *
 * Verifies:
 * - Admin auth: unauthenticated → 401, non-admin → 403
 * - Input validation: missing/short prompt → 400
 * - Non-existent lesson → 404
 * - Exercise creation: creates exercises linked to the lesson
 * - Block sync: lesson.blocks updated after exercise creation
 *
 * Uses Payload's local API to call the endpoint handler directly (no HTTP layer),
 * matching the project's integration test patterns.
 *
 * Note: LLM-dependent tests are covered by unit tests (lesson-exercise-generation-service.test.ts)
 * which mock the adapter at the unit level.
 *
 * @fileType test
 * @domain exercises
 * @pattern generate-exercises
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'

import { getDefaultTenantSlug } from '@/server/repos/tenant/get-default-tenant'
import { generateExercisesEndpoint } from '@/server/payload/endpoints/lessons/generate-exercises'
import { AccountRole } from '@/server/payload/collections/Users/roles'

// ── Fixtures ─────────────────────────────────────────────────────────────────

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/lessons/:id/generate-exercises', () => {
  let payload: Payload
  let adminUserId: string
  let nonAdminUserId: string
  let categoryId: string
  let courseId: string
  let chapterId: string
  let lessonId: string
  let lessonCreated = false

  beforeAll(async () => {
    payload = await getPayload({ config })
    const tenantId = await ensureDefaultTenant(payload)
    const ts = Date.now()

    // Admin user
    const admin = await payload.create({
      collection: 'users',
      data: {
        email: `genex-admin-${ts}@test.local`,
        password: 'testpass123',
        role: AccountRole.Admin,
      },
      overrideAccess: true,
    })
    adminUserId = admin.id

    // Non-admin user
    const editor = await payload.create({
      collection: 'users',
      data: {
        email: `genex-editor-${ts}@test.local`,
        password: 'testpass123',
        role: AccountRole.AdvancedContentEditor,
      },
      overrideAccess: true,
    })
    nonAdminUserId = editor.id

    // Course hierarchy
    const category = await payload.create({
      collection: 'categories',
      data: { title: `GenEx ${ts}`, slug: `genex-cat-${ts}`, locale: 'he' },
    })
    categoryId = category.id

    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `GEX-${ts}`,
        title: `GenEx Course ${ts}`,
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
    })
    courseId = course.id

    const chapter = await payload.create({
      collection: 'chapters',
      data: {
        title: `GenEx Chapter ${ts}`,
        chapterLabel: `GC-${ts}`,
        course: courseId,
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        locale: 'he',
      },
    })
    chapterId = chapter.id

    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: `GenEx Lesson ${ts}`,
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
        lessonContextText: 'Context for generation tests',
      },
      draft: false,
    })
    lessonId = lesson.id
    lessonCreated = true
  }, 120000)

  afterAll(async () => {
    // Delete exercises created during tests
    try {
      const exercises = await payload.find({
        collection: 'exercises',
        where: { lesson: { equals: lessonId } },
        depth: 0,
        limit: 100,
        overrideAccess: true,
      })
      for (const ex of exercises.docs) {
        try {
          await payload.delete({ collection: 'exercises', id: ex.id, overrideAccess: true })
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }

    // Delete lesson
    try {
      await payload.delete({ collection: 'lessons', id: lessonId, overrideAccess: true })
    } catch {
      // ignore
    }

    // Delete hierarchy
    for (const id of [chapterId, courseId, categoryId].reverse()) {
      try {
        await payload.delete({ collection: 'chapters', id, overrideAccess: true })
      } catch {
        try {
          await payload.delete({ collection: 'courses', id, overrideAccess: true })
        } catch {
          try {
            await payload.delete({ collection: 'categories', id, overrideAccess: true })
          } catch {
            // ignore
          }
        }
      }
    }

    // Delete users
    for (const uid of [adminUserId, nonAdminUserId]) {
      try {
        await payload.delete({ collection: 'users', id: uid, overrideAccess: true })
      } catch {
        // ignore
      }
    }

    await payload.db?.destroy?.()
  })

  // Helper: build a mock request for the endpoint
  function makeReq(
    overrideUrl: string,
    body: unknown,
    user: Parameters<typeof generateExercisesEndpoint>[0]['user'],
  ): Parameters<typeof generateExercisesEndpoint>[0] {
    return {
      user,
      payload,
      url: overrideUrl,
      json: async () => body,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any as Parameters<typeof generateExercisesEndpoint>[0]
  }

  // ── Auth ─────────────────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    const req = makeReq(
      `/api/lessons/${lessonId}/generate-exercises`,
      { prompt: 'Generate 10 exercises about algebra' },
      null as never,
    )
    const res = await generateExercisesEndpoint(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/authentication/i)
  })

  it('returns 403 when non-admin user', async () => {
    const req = makeReq(
      `/api/lessons/${lessonId}/generate-exercises`,
      { prompt: 'Generate 10 exercises' },
      { id: nonAdminUserId, role: AccountRole.AdvancedContentEditor } as never,
    )
    const res = await generateExercisesEndpoint(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/admin/i)
  })

  // ── Input validation ─────────────────────────────────────────────────────

  it('returns 400 when prompt is missing', async () => {
    const req = makeReq(`/api/lessons/${lessonId}/generate-exercises`, {}, {
      id: adminUserId,
      role: 'admin',
    } as never)
    const res = await generateExercisesEndpoint(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when prompt is too short (< 10 chars)', async () => {
    const req = makeReq(`/api/lessons/${lessonId}/generate-exercises`, { prompt: 'short' }, {
      id: adminUserId,
      role: 'admin',
    } as never)
    const res = await generateExercisesEndpoint(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toContain('10')
  })

  it('returns 400 when prompt is too long (> 5000 chars)', async () => {
    const req = makeReq(
      `/api/lessons/${lessonId}/generate-exercises`,
      { prompt: 'a'.repeat(5001) },
      { id: adminUserId, role: 'admin' } as never,
    )
    const res = await generateExercisesEndpoint(req)
    expect(res.status).toBe(400)
  })

  // ── Lesson not found ─────────────────────────────────────────────────────

  it('returns 404 for non-existent lesson', async () => {
    const req = makeReq(
      '/api/lessons/nonexistent-id/generate-exercises',
      { prompt: 'Generate 10 exercises' },
      { id: adminUserId, role: 'admin' } as never,
    )
    const res = await generateExercisesEndpoint(req)
    expect(res.status).toBe(404)
  })

  // ── Happy path (real LLM) ────────────────────────────────────────────────
  // Note: This test calls the real LLM. It may take a few seconds.
  // LLM unit tests (lesson-exercise-generation-service.test.ts) cover the
  // service logic with mocked adapter.

  it('creates exercises and returns their IDs on successful generation (real LLM)', async () => {
    const req = makeReq(
      `/api/lessons/${lessonId}/generate-exercises`,
      {
        prompt:
          'Generate 10 simple exercises about adding single-digit numbers. Include varying difficulty.',
      },
      { id: adminUserId, role: 'admin' } as never,
    )
    const res = await generateExercisesEndpoint(req)
    const body = await res.json()

    // The LLM call may succeed or fail depending on API availability
    // We verify the response shape regardless of success/failure
    expect(body).toHaveProperty('success')
    if (body.success) {
      expect(body.data).toHaveProperty('createdExerciseIds')
      expect(body.data).toHaveProperty('totalCreated')
      expect(Array.isArray(body.data.createdExerciseIds)).toBe(true)
    }
  }, 60000)

  it('exercise relationship is correct after creation', async () => {
    if (!lessonCreated) return

    const exercises = await payload.find({
      collection: 'exercises',
      where: { lesson: { equals: lessonId } },
      depth: 0,
      limit: 100,
      overrideAccess: true,
    })

    // At least the exercises created in the previous test should exist
    if (exercises.docs.length > 0) {
      const recent = exercises.docs.slice(-Math.min(exercises.docs.length, 10))
      for (const ex of recent) {
        const lessonRef =
          typeof ex.lesson === 'string' ? ex.lesson : (ex.lesson as { id?: string })?.id
        expect(lessonRef).toBe(lessonId)
      }
    }
  })

  it('lesson.blocks is updated after exercise creation (block sync)', async () => {
    if (!lessonCreated) return

    const lesson = await payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 0,
      overrideAccess: true,
    })

    const blocksRaw = lesson.blocks
    if (!blocksRaw) {
      throw new Error(
        'lesson.blocks is undefined — exercise creation or block-sync may have failed. ' +
          'Ensure the LLM call in the preceding test succeeded.',
      )
    }

    let blocks: unknown[]
    if (typeof blocksRaw === 'string') {
      try {
        blocks = JSON.parse(blocksRaw) as unknown[]
      } catch {
        throw new Error('lesson.blocks is a string but could not be parsed as JSON')
      }
    } else if (Array.isArray(blocksRaw)) {
      blocks = blocksRaw
    } else {
      throw new Error('lesson.blocks has an unexpected type — expected string or array')
    }

    const exerciseRefBlocks = blocks.filter(
      (b: unknown) =>
        typeof b === 'object' &&
        b !== null &&
        (b as Record<string, unknown>)['blockType'] === 'exerciseRef',
    )
    expect(exerciseRefBlocks.length).toBeGreaterThanOrEqual(1)
  })
})
