/**
 * Integration test: lesson export endpoint.
 *
 * Verifies:
 * 1. Lesson + ordered exercises are exported as JSON
 * 2. Exercises appear in the same order as the blocks array
 * 3. Missing exercise references are listed in meta.missingExerciseRefs
 * 4. Non-exercise blocks are counted in meta.skippedNonExerciseBlocks
 * 5. 401 for unauthenticated, 403 for non-admin, 404 for missing lesson
 * 6. Empty exercises[] for lesson with no exercises
 *
 * The endpoint is exercised via Payload's local API to keep the test
 * focused on data behavior, matching the project's other integration tests.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'

import { getDefaultTenantSlug } from '@/server/repos/tenant/get-default-tenant'
import { exportLessonEndpoint } from '@/server/payload/endpoints/lessons/export'

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

describe('Lesson export endpoint', () => {
  let payload: Payload
  let tenantId: string
  let categoryId: string
  let courseId: string
  let chapterId: string
  let lessonId: string
  const exerciseIds: string[] = []
  const cleanupIds: string[] = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    tenantId = await ensureDefaultTenant(payload)
    const ts = Date.now()

    // Setup: category → course → chapter → lesson → 3 ordered exercises
    const category = await payload.create({
      collection: 'categories',
      data: { title: `ExpCat ${ts}`, slug: `exp-cat-${ts}`, locale: 'he' },
    })
    categoryId = category.id

    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `EXP-${ts}`,
        title: `Export Course ${ts}`,
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
        title: `Export Chapter ${ts}`,
        chapterLabel: `ECH-${ts}`,
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
        title: `Export Lesson ${ts}`,
        slug: `export-lesson-${ts}`,
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
    lessonId = lesson.id
    cleanupIds.push(lessonId)

    // Create 3 exercises in order
    for (let i = 0; i < 3; i++) {
      const ex = await payload.create({
        collection: 'exercises',
        data: { title: `Export Exercise ${i} ${ts}`, lesson: lessonId, origin: 'manual' },
        draft: true,
      })
      exerciseIds.push(ex.id)
      cleanupIds.push(ex.id)
    }

    // Set lesson.blocks to ordered JSON with exercise refs + one contentPageRef + one missing
    const blocks = [
      { id: 'b1', blockType: 'exerciseRef', exercise: exerciseIds[0] },
      { id: 'b2', blockType: 'contentPageRef', contentPage: 'fake-content-page-id' },
      { id: 'b3', blockType: 'exerciseRef', exercise: exerciseIds[1] },
      { id: 'b4', blockType: 'exerciseRef', exercise: exerciseIds[2] },
      { id: 'b5', blockType: 'exerciseRef', exercise: 'non-existent-exercise-id' },
    ]
    await payload.update({
      collection: 'lessons',
      id: lessonId,
      data: { blocks: JSON.stringify(blocks) },
      overrideAccess: true,
    })
  }, 120000)

  afterAll(async () => {
    for (const id of cleanupIds) {
      try {
        await payload.delete({ collection: 'lessons', id, overrideAccess: true })
      } catch {
        // ignore
      }
      try {
        await payload.delete({ collection: 'exercises', id, overrideAccess: true })
      } catch {
        // ignore
      }
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
    await payload.db?.destroy?.()
  })

  it('exports lesson with exercises in blocks order, skipping missing and non-exercise blocks', async () => {
    const mockReq = {
      user: { id: 'admin', role: 'admin' },
      payload,
      url: `http://localhost/lessons/${lessonId}/export`,
      headers: new Headers(),
    } as unknown as Parameters<typeof exportLessonEndpoint>[0]
    const res = await exportLessonEndpoint(mockReq)
    expect(res.status).toBe(200)

    const body = await (res as Response).json()
    expect(body.lesson.id).toBe(lessonId)
    expect(body.exercises).toHaveLength(3)
    expect(body.exercises[0].id).toBe(exerciseIds[0])
    expect(body.exercises[1].id).toBe(exerciseIds[1])
    expect(body.exercises[2].id).toBe(exerciseIds[2])
    expect(body.meta.missingExerciseRefs).toContain('non-existent-exercise-id')
    expect(body.meta.skippedNonExerciseBlocks).toBe(1)
    expect(body.meta.exerciseCount).toBe(3)

    // No managed fields on exercises
    expect(body.exercises[0]).not.toHaveProperty('createdAt')
    expect(body.exercises[0]).not.toHaveProperty('updatedAt')
    expect(body.exercises[0]).not.toHaveProperty('_id')
  })

  it('returns 404 for non-existent lesson', async () => {
    const mockReq = {
      user: { id: 'admin', role: 'admin' },
      payload,
      url: 'http://localhost/lessons/fake-id/export',
      headers: new Headers(),
    } as unknown as Parameters<typeof exportLessonEndpoint>[0]
    const res = await exportLessonEndpoint(mockReq)
    expect(res.status).toBe(404)
  })

  it('returns 401 for unauthenticated requests', async () => {
    const mockReq = {
      user: null,
      payload,
      url: `http://localhost/lessons/${lessonId}/export`,
      headers: new Headers(),
    } as unknown as Parameters<typeof exportLessonEndpoint>[0]
    const res = await exportLessonEndpoint(mockReq)
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const mockReq = {
      user: { id: 'user', role: 'student' },
      payload,
      url: `http://localhost/lessons/${lessonId}/export`,
      headers: new Headers(),
    } as unknown as Parameters<typeof exportLessonEndpoint>[0]
    const res = await exportLessonEndpoint(mockReq)
    expect(res.status).toBe(403)
  })

  it('exports lesson with zero exercises cleanly', async () => {
    const emptyLesson = await payload.create({
      collection: 'lessons',
      data: {
        title: `Empty Export Lesson ${Date.now()}`,
        slug: `empty-export-${Date.now()}`,
        chapter: chapterId,
        type: 'learning',
        order: 99,
        status: 'draft',
        isActive: true,
        tenant: tenantId,
        locale: 'he',
        accessType: 'inherit',
        contentStatus: 'none',
        contentStatusVisible: true,
        blocks: '[]',
      },
      overrideAccess: true,
    })
    cleanupIds.push(emptyLesson.id)

    const mockReq = {
      user: { id: 'admin', role: 'admin' },
      payload,
      url: `http://localhost/lessons/${emptyLesson.id}/export`,
      headers: new Headers(),
    } as unknown as Parameters<typeof exportLessonEndpoint>[0]
    const res = await exportLessonEndpoint(mockReq)
    expect(res.status).toBe(200)
    const body = await (res as Response).json()
    expect(body.exercises).toHaveLength(0)
    expect(body.meta.exerciseCount).toBe(0)
    expect(body.meta.missingExerciseRefs).toHaveLength(0)
    expect(body.meta.skippedNonExerciseBlocks).toBe(0)
  })
})
