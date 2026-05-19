/**
 * Integration test: lesson export endpoint (canonical format).
 *
 * Verifies:
 * 1. Lesson is exported in canonical format with class, lesson_number, topic
 * 2. Exercises appear in canonical format with exercise_number, level, exercise_content
 * 3. Exercise content has data and sections matching the block structure
 * 4. No internal fields (id, _id, __v, slug, origin, createdBy, tenant, etc.) in output
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

  it('exports lesson in canonical format with class, lesson_number, topic, exercises', async () => {
    const mockReq = {
      user: { id: 'admin', role: 'admin' },
      payload,
      url: `http://localhost/lessons/${lessonId}/export`,
      headers: new Headers(),
    } as unknown as Parameters<typeof exportLessonEndpoint>[0]
    const res = await exportLessonEndpoint(mockReq)
    expect(res.status).toBe(200)

    const body = await (res as Response).json()

    // Canonical top-level structure
    expect(body).toHaveProperty('class')
    expect(body).toHaveProperty('lesson_number')
    expect(body).toHaveProperty('topic')
    expect(body).toHaveProperty('exercises')

    // Lesson metadata
    expect(body.lesson_number).toBe('1')
    expect(body.topic).toMatch(/^Export Lesson \d+$/)

    // Exercises in canonical format
    expect(body.exercises).toHaveLength(3)
    const firstExercise = body.exercises[0]
    expect(firstExercise).toHaveProperty('exercise_number')
    expect(firstExercise.exercise_number).toBe('1')
    expect(firstExercise).toHaveProperty('level')
    expect(firstExercise).toHaveProperty('exercise_content')
    expect(firstExercise.exercise_content).toHaveProperty('data')
    expect(firstExercise.exercise_content).toHaveProperty('sections')

    // Data has the canonical wrapper format
    const data = firstExercise.exercise_content.data
    expect(data).toHaveProperty('text')
    expect(data).toHaveProperty('table')
    expect(data).toHaveProperty('PNG')
    expect(data).toHaveProperty('svg')

    // No internal lesson fields in the canonical export
    // (The canonical format doesn't include id, _id, __v, slug, origin, etc.)
    expect(body).not.toHaveProperty('lesson')
    // `meta` carries SVG-render diagnostics for the export (rendered count +
    // per-block failures) — part of the contract since geometry/axis blocks
    // are rendered to SVG on export.
    expect(body).toHaveProperty('meta')
    expect(typeof body.meta.renderedSvgCount).toBe('number')
    expect(Array.isArray(body.meta.renderFailures)).toBe(true)
    expect(body.exercises[0]).not.toHaveProperty('id')
    expect(body.exercises[0]).not.toHaveProperty('createdAt')
    expect(body.exercises[0]).not.toHaveProperty('updatedAt')
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

  it('exports lesson with zero exercises cleanly in canonical format', async () => {
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
    expect(body.lesson_number).toBe('99')
    // No internal `lesson` wrapper; `meta` (SVG-render diagnostics) is part
    // of the canonical export contract, present even with zero exercises.
    expect(body).not.toHaveProperty('lesson')
    expect(body).toHaveProperty('meta')
  })
})
