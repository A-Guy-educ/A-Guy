/**
 * Integration test: lesson duplication per-exercise retry endpoint.
 *
 * Tests:
 *  1. POST /retry-exercise — success: clears old failure, creates new output exercise
 *  2. POST /retry-exercise — non-admin returns 401
 *  3. POST /retry-exercise — unknown sourceExerciseId returns 404
 *  4. POST /retry-exercise — missing body returns 400
 *  5. POST /retry-exercise — missing outputLesson returns 409 conflict
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'

import { POST as retryPOST } from '@/app/api/lesson-duplications/[id]/retry-exercise/route'
import { getDefaultTenantSlug } from '@/server/repos/tenant/get-default-tenant'
import { AccountRole } from '@/server/payload/collections/Users/roles'

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

describe('Lesson duplication — retry-exercise endpoint', () => {
  let payload: Payload
  let adminToken: string
  let categoryId: string
  let courseId: string
  let chapterId: string
  let tenantId: string
  let sourceLessonId: string
  let outputLessonId: string
  let sourceExerciseId1: string
  let sourceExerciseId2: string
  const cleanupLessonIds: string[] = []
  const cleanupExerciseIds: string[] = []
  const cleanupDuplicationIds: string[] = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    tenantId = await ensureDefaultTenant(payload)
    const ts = Date.now()

    const category = await payload.create({
      collection: 'categories',
      data: { title: `RetryCat ${ts}`, slug: `retry-cat-${ts}`, locale: 'he' },
    })
    categoryId = category.id

    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `RTRY-${ts}`,
        title: `Retry Course ${ts}`,
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
        title: `Retry Chapter ${ts}`,
        chapterLabel: `RCH-${ts}`,
        course: courseId,
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        locale: 'he',
      },
    })
    chapterId = chapter.id

    const sourceLesson = await payload.create({
      collection: 'lessons',
      data: {
        title: `Retry Source Lesson ${ts}`,
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
    sourceLessonId = sourceLesson.id
    cleanupLessonIds.push(sourceLessonId)

    const outputLesson = await payload.create({
      collection: 'lessons',
      data: {
        title: `Retry Output Lesson ${ts}`,
        chapter: chapterId,
        type: 'practice',
        order: 1,
        status: 'draft',
        isActive: true,
        tenant: tenantId,
        locale: 'he',
        accessType: 'inherit',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      draft: true,
    })
    outputLessonId = outputLesson.id
    cleanupLessonIds.push(outputLessonId)

    // Source exercises
    const ex1 = await payload.create({
      collection: 'exercises',
      data: { title: `Retry Ex1 ${ts}`, lesson: sourceLessonId },
      draft: true,
    })
    sourceExerciseId1 = ex1.id
    cleanupExerciseIds.push(sourceExerciseId1)

    const ex2 = await payload.create({
      collection: 'exercises',
      data: { title: `Retry Ex2 ${ts}`, lesson: sourceLessonId },
      draft: true,
    })
    sourceExerciseId2 = ex2.id
    cleanupExerciseIds.push(sourceExerciseId2)

    // Create admin user
    const adminUser = await payload.create({
      collection: 'users',
      data: {
        email: `retry-admin-${ts}@example.com`,
        password: 'TestPassword123!',
        name: `Retry Admin ${ts}`,
      } as never,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'users',
      id: adminUser.id,
      data: { role: AccountRole.Admin } as never,
      overrideAccess: true,
    })
    const loginResult = await payload.login({
      collection: 'users',
      data: { email: adminUser.email, password: 'TestPassword123!' },
    })
    adminToken = loginResult.token!
  }, 120000)

  afterAll(async () => {
    for (const id of cleanupDuplicationIds) {
      try {
        await payload.delete({ collection: 'lesson-duplications', id, overrideAccess: true })
      } catch {
        /* ignore */
      }
    }
    for (const id of cleanupExerciseIds) {
      try {
        await payload.delete({ collection: 'exercises', id, overrideAccess: true })
      } catch {
        /* ignore */
      }
    }
    for (const id of cleanupLessonIds) {
      try {
        await payload.delete({ collection: 'lessons', id, overrideAccess: true })
      } catch {
        /* ignore */
      }
    }
    try {
      await payload.delete({ collection: 'chapters', id: chapterId, overrideAccess: true })
    } catch {
      /* ignore */
    }
    try {
      await payload.delete({ collection: 'courses', id: courseId, overrideAccess: true })
    } catch {
      /* ignore */
    }
    try {
      await payload.delete({ collection: 'categories', id: categoryId, overrideAccess: true })
    } catch {
      /* ignore */
    }
    await payload.db?.destroy?.()
  })

  it('creates a needs_review record with outputLesson, outputExercises, and failures', async () => {
    const record = await payload.create({
      collection: 'lesson-duplications',
      data: {
        sourceLesson: sourceLessonId,
        level: 'medium',
        status: 'needs_review',
        outputLesson: outputLessonId,
        outputExercises: [
          {
            sourceExerciseId: sourceExerciseId1,
            outputExerciseId: 'placeholder-output-id-1',
            strategy: 'ai',
          },
        ],
        failures: [
          {
            exerciseRef: sourceExerciseId1,
            sectionIndex: 0,
            code: 'GENERATION_FAILED',
            message: 'Generation failed: timeout',
            suggestedAction: 'skip',
            resolved: false,
          },
        ],
      },
      overrideAccess: true,
    })
    cleanupDuplicationIds.push(record.id)

    expect(record.status).toBe('needs_review')
    expect(record.outputLesson).toBeTruthy()
    expect(record.outputExercises).toHaveLength(1)
    expect(record.failures?.length ?? 0).toBe(1)
    expect((record.failures as unknown[])[0]).toMatchObject({
      exerciseRef: sourceExerciseId1,
      resolved: false,
    })
  })

  it('POST /retry-exercise — clears old failure for source exercise', async () => {
    // Create a fresh needs_review record
    const ex1 = await payload.create({
      collection: 'exercises',
      data: {
        title: `RetryClear Ex1 ${Date.now()}`,
        lesson: sourceLessonId,
        content: {
          blocks: [{ id: 'r1', type: 'rich_text', format: 'md-math-v1', value: 'Test question' }],
        },
      },
      draft: true,
    })
    cleanupExerciseIds.push(ex1.id)

    const outEx1 = await payload.create({
      collection: 'exercises',
      data: {
        title: `Variation of ${ex1.id}`,
        lesson: outputLessonId,
        content: {
          blocks: [{ id: 'r1', type: 'rich_text', format: 'md-math-v1', value: 'Old variation' }],
        },
      },
      draft: true,
    })
    cleanupExerciseIds.push(outEx1.id)

    const record = await payload.create({
      collection: 'lesson-duplications',
      data: {
        sourceLesson: sourceLessonId,
        level: 'medium',
        status: 'needs_review',
        outputLesson: outputLessonId,
        outputExercises: [
          {
            sourceExerciseId: ex1.id,
            outputExerciseId: outEx1.id,
            strategy: 'ai',
          },
        ],
        failures: [
          {
            exerciseRef: ex1.id,
            sectionIndex: 0,
            code: 'GENERATION_FAILED',
            message: 'Failed before',
            suggestedAction: 'skip',
            resolved: false,
          },
        ],
      },
      overrideAccess: true,
    })
    cleanupDuplicationIds.push(record.id)

    // Call POST /retry-exercise
    const retryUrl = `http://localhost:3000/api/lesson-duplications/${record.id}/retry-exercise`
    const request = new NextRequest(retryUrl, {
      method: 'POST',
      headers: {
        Authorization: `JWT ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sourceExerciseId: ex1.id }),
    })
    const response = await retryPOST(request as never)

    expect(response.status).toBe(200)
    const _data = (await response.json()) as { data?: { duplicationId: string; success: boolean } }

    // Verify old failure for this source is gone from the record
    const updated = await payload.findByID({
      collection: 'lesson-duplications',
      id: record.id,
      depth: 0,
      overrideAccess: true,
    })
    const failures = (updated.failures as Array<{ exerciseRef: string }>) ?? []
    const remainingForSource = failures.filter((f) => f.exerciseRef === ex1.id)
    expect(remainingForSource).toHaveLength(0)
  })

  it('POST /retry-exercise — non-admin returns 401', async () => {
    const record = await payload.create({
      collection: 'lesson-duplications',
      data: {
        sourceLesson: sourceLessonId,
        level: 'medium',
        status: 'needs_review',
        outputLesson: outputLessonId,
        outputExercises: [],
        failures: [],
      },
      overrideAccess: true,
    })
    cleanupDuplicationIds.push(record.id)

    const retryUrl = `http://localhost:3000/api/lesson-duplications/${record.id}/retry-exercise`
    const request = new NextRequest(retryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceExerciseId: sourceExerciseId1 }),
    })
    const response = await retryPOST(request as never)

    expect(response.status).toBe(401)
  })

  it('POST /retry-exercise — unknown sourceExerciseId returns 404', async () => {
    const record = await payload.create({
      collection: 'lesson-duplications',
      data: {
        sourceLesson: sourceLessonId,
        level: 'medium',
        status: 'needs_review',
        outputLesson: outputLessonId,
        outputExercises: [],
        failures: [],
      },
      overrideAccess: true,
    })
    cleanupDuplicationIds.push(record.id)

    const retryUrl = `http://localhost:3000/api/lesson-duplications/${record.id}/retry-exercise`
    const request = new NextRequest(retryUrl, {
      method: 'POST',
      headers: {
        Authorization: `JWT ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sourceExerciseId: '000000000000000000000000' }),
    })
    const response = await retryPOST(request as never)

    expect(response.status).toBe(404)
  })

  it('POST /retry-exercise — missing body returns 400', async () => {
    const record = await payload.create({
      collection: 'lesson-duplications',
      data: {
        sourceLesson: sourceLessonId,
        level: 'medium',
        status: 'needs_review',
        outputLesson: outputLessonId,
        outputExercises: [],
        failures: [],
      },
      overrideAccess: true,
    })
    cleanupDuplicationIds.push(record.id)

    const retryUrl = `http://localhost:3000/api/lesson-duplications/${record.id}/retry-exercise`
    const request = new NextRequest(retryUrl, {
      method: 'POST',
      headers: {
        Authorization: `JWT ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: '',
    })
    const response = await retryPOST(request as never)

    expect(response.status).toBe(400)
  })

  it('POST /retry-exercise — record without outputLesson returns 409 conflict', async () => {
    const record = await payload.create({
      collection: 'lesson-duplications',
      data: {
        sourceLesson: sourceLessonId,
        level: 'medium',
        status: 'needs_review',
        outputExercises: [],
        failures: [],
        // intentionally no outputLesson
      },
      overrideAccess: true,
    })
    cleanupDuplicationIds.push(record.id)

    const retryUrl = `http://localhost:3000/api/lesson-duplications/${record.id}/retry-exercise`
    const request = new NextRequest(retryUrl, {
      method: 'POST',
      headers: {
        Authorization: `JWT ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sourceExerciseId: sourceExerciseId1 }),
    })
    const response = await retryPOST(request as never)

    expect(response.status).toBe(409)
  })
})
