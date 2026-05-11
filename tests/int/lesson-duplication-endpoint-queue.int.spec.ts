/**
 * Integration test: lesson duplication endpoint properly queues the orchestrator job.
 *
 * Catches the bug we hit in production: endpoint created a LessonDuplications
 * record with status=pending but never enqueued the lesson_duplication task,
 * so the AI variation pipeline was unreachable. This test calls the endpoint
 * with level=deep and asserts a queued job for `lesson_duplication` exists in
 * the payload-jobs collection right after the call returns.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'

import { getDefaultTenantSlug } from '@/server/repos/tenant/get-default-tenant'
import { duplicateLessonEndpoint } from '@/server/payload/endpoints/lessons/duplicate'

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

describe('Lesson duplication endpoint — queues orchestrator job for non-none levels', () => {
  let payload: Payload
  let tenantId: string
  let categoryId: string
  let courseId: string
  let chapterId: string
  let sourceLessonId: string

  beforeAll(async () => {
    payload = await getPayload({ config })
    tenantId = await ensureDefaultTenant(payload)
    const ts = Date.now()

    const category = await payload.create({
      collection: 'categories',
      data: { title: `EndpointCat ${ts}`, slug: `endpoint-cat-${ts}`, locale: 'he' },
    })
    categoryId = category.id

    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `EP-${ts}`,
        title: `Endpoint Course ${ts}`,
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
        title: `Endpoint Chapter ${ts}`,
        chapterLabel: `EC-${ts}`,
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
        title: `Endpoint Source Lesson ${ts}`,
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
    sourceLessonId = lesson.id
  }, 120000)

  afterAll(async () => {
    // cleanup omitted for brevity — test DB is ephemeral
    await payload.db?.destroy?.()
  })

  it('enqueues a lesson_duplication job when called with level=deep', async () => {
    // Real admin user (createdByField requires a valid ObjectId).
    const created = await payload.create({
      collection: 'users',
      data: {
        email: `endpoint-test-admin-${Date.now()}@example.com`,
        password: 'test-pw-1234',
        role: 'admin',
      } as never,
      overrideAccess: true,
    })
    const adminUser = { ...created, collection: 'users' as const, role: 'admin' as const }

    // Build a synthetic PayloadRequest mimicking what Next would pass
    const req = {
      payload,
      user: adminUser,
      url: `http://localhost:3000/api/lessons/${sourceLessonId}/duplicate`,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ level: 'deep', subject: 'algebra' }),
    } as unknown as Parameters<typeof duplicateLessonEndpoint>[0]

    // Snapshot job count before
    const jobsCountBefore = await payload.db?.connection
      ?.collection?.('payload-jobs')
      .countDocuments({ taskSlug: 'lesson_duplication' })

    const response = await duplicateLessonEndpoint(req)
    const body = (await response.json()) as { id?: string; status?: string; jobId?: string }

    expect(response.status).toBe(200)
    expect(body.status).toBe('pending')
    expect(body.id).toBeTruthy()
    expect(body.jobId).toBeTruthy()

    // The duplication record was created in pending status
    const record = await payload.findByID({
      collection: 'lesson-duplications',
      id: body.id!,
      overrideAccess: true,
    })
    expect(record.status).toBe('pending')
    expect(record.level).toBe('deep')
    expect(record.subject).toBe('algebra')
    expect(record.outputLesson).toBeFalsy()

    // A lesson_duplication job was inserted into payload-jobs
    const jobsCountAfter = await payload.db?.connection
      ?.collection?.('payload-jobs')
      .countDocuments({ taskSlug: 'lesson_duplication' })
    if (typeof jobsCountBefore === 'number' && typeof jobsCountAfter === 'number') {
      expect(jobsCountAfter).toBeGreaterThan(jobsCountBefore)
    }
  })
})
