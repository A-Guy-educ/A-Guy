// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing which depends on
// Node.js's native TextEncoder/Uint8Array. The jsdom environment can cause a
// Uint8Array realm mismatch that breaks jose's FlattenedSign constructor check.

/**
 * Integration tests: V3 Extraction Log Gate
 * Covers: POST /api/exercises/convert/single/create — extraction log ownership validation
 *
 * P0 — security: without the gate, admins could create exercises from
 * extraction logs belonging to different lessons or media documents.
 *
 * Important implementation note:
 * The route handler imports withApiHandler which statically imports @payload-config.
 * If the route is statically imported at the top of this file, @payload-config is loaded
 * at module load time (before beforeAll runs) and captures the dev DATABASE_URL.
 * Fix: dynamically import the route inside beforeAll AFTER the testcontainer is ready.
 *
 * Admin creation note:
 * ensureRoleOnSignup field hook forces role='student' on all create ops.
 * Two-step pattern: create (→student) then update role to admin with overrideAccess:true.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { AccountRole } from '@/server/payload/collections/Users/roles'

// Route imported dynamically in beforeAll to ensure @payload-config is cached with
// the testcontainer DATABASE_URL before the static import chain in withApiHandler loads it.
let POST: (req: NextRequest) => Promise<Response>

let payload: Payload
let originalDatabaseUrl: string | undefined
let adminToken: string
let lessonId: string
let mediaId: string
let tenantId: string
let chapterId: string

const ADMIN_EMAIL = `v3-gate-admin-${Date.now()}@test.com`
const ADMIN_PASSWORD = 'test-password-123!'

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Create tenant
  const tenants = await payload.find({ collection: 'tenants', limit: 1, overrideAccess: true })
  if (tenants.docs.length > 0) {
    tenantId = tenants.docs[0].id
  } else {
    const t = await payload.create({
      collection: 'tenants',
      data: { name: 'V3 Gate Test Tenant', slug: `v3-gate-${Date.now()}`, status: 'active' },
      overrideAccess: true,
    })
    tenantId = t.id
  }

  // Create admin user (two-step: create→student, then update→admin)
  const adminBase = await (payload as any).create({
    collection: 'users',
    data: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      name: 'V3 Gate Admin',
    },
  })
  await payload.update({
    collection: 'users',
    id: adminBase.id,
    data: { role: AccountRole.Admin },
    overrideAccess: true,
  })

  // Login to get JWT token
  const loginResult = await payload.login({
    collection: 'users',
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  adminToken = loginResult.token as string

  // Route imported dynamically: ensures @payload-config is already cached with testcontainer URI
  // before withApiHandler's static import of configPromise loads the module.
  const route = await import('@/app/api/exercises/convert/single/create/route')
  POST = route.POST

  // Create category → course → chapter → lesson chain (lessons require chapter, chapters require course)
  const category = await payload.create({
    collection: 'categories',
    data: {
      title: 'V3 Gate Test Category',
      slug: `v3-gate-category-${Date.now()}`,
      locale: 'he',
    } as any,
    overrideAccess: true,
  })

  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: 'V3',
      title: 'V3 Gate Test Course',
      categories: [category.id],
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })

  const chapter = await payload.create({
    collection: 'chapters',
    data: {
      course: course.id,
      title: 'V3 Gate Test Chapter',
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  chapterId = chapter.id

  const lesson = await payload.create({
    collection: 'lessons',
    data: {
      title: 'V3 Gate Test Lesson',
      chapter: chapter.id,
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  lessonId = lesson.id

  // Create a media record (external type to avoid file upload complexity)
  // Use unique filename to avoid collision with other test files sharing the same DB
  const mediaFilename = `v3-gate-test-${Date.now()}.pdf`
  const media = await payload.create({
    collection: 'media',
    data: {
      type: 'external',
      externalUrl: `https://example.com/${mediaFilename}`,
      filename: mediaFilename,
      mimeType: 'application/pdf',
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  mediaId = media.id
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

function makeRequest(body: unknown, token = adminToken) {
  return new NextRequest('http://localhost/api/exercises/convert/single/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `payload-token=${token}`,
    },
    body: JSON.stringify(body),
  })
}

async function createExtractionLog(overrides: {
  stage?: string
  status?: string
  lessonId?: string
  mediaId?: string
}) {
  return (payload as any).create({
    collection: 'extraction-logs',
    data: {
      tenant: tenantId,
      lesson: overrides.lessonId ?? lessonId,
      media: overrides.mediaId ?? mediaId,
      stage: overrides.stage ?? 'extract',
      status: overrides.status ?? 'success',
      promptVersion: 'v1',
      model: 'gemini-2.0-flash-001',
      pipelineVersion: 3,
      processingTimeMs: 100,
    },
    overrideAccess: true,
  })
}

const VALID_BODY = () => ({
  lessonId,
  mediaId,
  title: 'Test Exercise',
  stem: 'What is 2 + 2?',
  subQuestions: [
    {
      prompt: 'Calculate the sum',
      type: 'free_response' as const,
      options: [],
      correctAnswer: null,
    },
  ],
})

describe('V3 extraction log gate — POST /api/exercises/convert/single/create', () => {
  describe('authentication', () => {
    it('returns 401 when unauthenticated', async () => {
      const log = await createExtractionLog({})
      const req = makeRequest({ ...VALID_BODY(), extractionLogId: log.id }, '')
      const res = await POST(req)
      expect(res.status).toBe(401)
    })
  })

  describe('extraction log not found', () => {
    it('returns 404 for non-existent extractionLogId', async () => {
      const req = makeRequest({
        ...VALID_BODY(),
        extractionLogId: '507f1f77bcf86cd799439011', // valid-looking but missing
      })
      const res = await POST(req)
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toMatch(/extraction log not found/i)
    })
  })

  describe('extraction log stage validation', () => {
    it('returns 400 when log stage is not "extract"', async () => {
      const log = await createExtractionLog({ stage: 'create' })
      const req = makeRequest({ ...VALID_BODY(), extractionLogId: log.id })
      const res = await POST(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/extract stage/i)
    })
  })

  describe('extraction log status validation', () => {
    it('returns 400 when log status is not "success"', async () => {
      const log = await createExtractionLog({ status: 'failed' })
      const req = makeRequest({ ...VALID_BODY(), extractionLogId: log.id })
      const res = await POST(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/not successful/i)
    })
  })

  describe('extraction log ownership validation (the security gate)', () => {
    it('returns 400 when log belongs to a different lesson', async () => {
      // Create a second lesson
      const otherLesson = await payload.create({
        collection: 'lessons',
        data: {
          title: 'Other Lesson',
          chapter: chapterId,
          tenant: tenantId,
        } as any,
        overrideAccess: true,
      })
      const log = await createExtractionLog({ lessonId: otherLesson.id })

      // Try to create an exercise for lessonId but with a log from otherLesson
      const req = makeRequest({ ...VALID_BODY(), extractionLogId: log.id })
      const res = await POST(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/does not match lesson or media/i)
    })

    it('returns 400 when log belongs to a different media document', async () => {
      const otherMedia = await payload.create({
        collection: 'media',
        data: {
          type: 'external',
          externalUrl: 'https://example.com/other.pdf',
          filename: 'other.pdf',
          mimeType: 'application/pdf',
          tenant: tenantId,
        } as any,
        overrideAccess: true,
      })
      const log = await createExtractionLog({ mediaId: otherMedia.id })

      const req = makeRequest({ ...VALID_BODY(), extractionLogId: log.id })
      const res = await POST(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/does not match lesson or media/i)
    })

    it('creates exercise when log matches lesson and media (happy path)', async () => {
      const log = await createExtractionLog({})
      const req = makeRequest({ ...VALID_BODY(), extractionLogId: log.id })
      const res = await POST(req)
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.exerciseId).toBeDefined()
      expect(body.data.adminUrl).toContain('/admin/collections/exercises/')
    })
  })
})
