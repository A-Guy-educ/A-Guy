// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing which depends on
// Node.js's native TextEncoder/Uint8Array. The jsdom environment can cause a
// Uint8Array realm mismatch that breaks jose's FlattenedSign constructor check.

/**
 * Integration tests: Study Plan Generation API
 * Covers: PUT /api/study-plan (action=generate) — auth, plan creation, owner isolation
 *
 * P1 — correctness: the route composes generateStudyPlan (pure function) with a
 * Payload upsert; a broken upsert would silently overwrite or duplicate plans.
 *
 * Important implementation note:
 * The route handler imports configPromise statically from @payload-config.
 * Dynamic import in beforeAll (after testcontainer is ready) ensures the module
 * cache is populated with the correct DATABASE_URL before the route loads it.
 *
 * DEFAULT_TENANT_SLUG env var is required by getDefaultTenantId, which the route
 * calls when creating the first user-progress record.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'

// Route handlers imported dynamically in beforeAll after testcontainer is ready
let PUT: (req: NextRequest) => Promise<Response>
let GET: (req: NextRequest) => Promise<Response>

let payload: Payload
let originalDatabaseUrl: string | undefined
let originalDefaultTenantSlug: string | undefined
let userAToken: string
let userBToken: string
let courseId: string

const USER_A_EMAIL = `study-plan-a-${Date.now()}@test.com`
const USER_B_EMAIL = `study-plan-b-${Date.now()}@test.com`
const USER_PASSWORD = 'test-password-123!'
const GRADE_LEVEL = 'grade-8-sp-test'
const TENANT_SLUG = `sp-test-tenant-${Date.now()}`

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  originalDefaultTenantSlug = process.env.DEFAULT_TENANT_SLUG

  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL
  process.env.DEFAULT_TENANT_SLUG = TENANT_SLUG

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Ensure the default tenant exists so getDefaultTenantId succeeds
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

  // Create a course to use as the plan's courseId
  const category = await payload.create({
    collection: 'categories',
    data: { title: 'SP Test Category', slug: `sp-cat-${Date.now()}` } as any,
    overrideAccess: true,
  })
  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: 'Test',
      title: 'SP Test Course',
      categories: [category.id],
    } as any,
    overrideAccess: true,
  })
  courseId = course.id

  // Create two student users
  await (payload as any).create({
    collection: 'users',
    data: { email: USER_A_EMAIL, password: USER_PASSWORD, name: 'Study Plan User A' },
  })
  await (payload as any).create({
    collection: 'users',
    data: { email: USER_B_EMAIL, password: USER_PASSWORD, name: 'Study Plan User B' },
  })

  const loginA = await payload.login({
    collection: 'users',
    data: { email: USER_A_EMAIL, password: USER_PASSWORD },
  })
  userAToken = loginA.token as string

  const loginB = await payload.login({
    collection: 'users',
    data: { email: USER_B_EMAIL, password: USER_PASSWORD },
  })
  userBToken = loginB.token as string

  // Dynamic import after DATABASE_URL is set — ensures @payload-config is cached correctly
  const route = await import('@/app/api/study-plan/route')
  PUT = route.PUT
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

  if (originalDefaultTenantSlug !== undefined) {
    process.env.DEFAULT_TENANT_SLUG = originalDefaultTenantSlug
  } else {
    delete process.env.DEFAULT_TENANT_SLUG
  }
}, 120_000)

const VALID_GENERATE_BODY = () => ({
  action: 'generate' as const,
  courseId,
  examDate: '2099-12-31',
  topics: [{ topicId: 'topic-1', topicLabel: 'Algebra', mastery: 'weak' as const }],
  gradeLevel: GRADE_LEVEL,
})

function makePutRequest(body: unknown, token = userAToken) {
  return new NextRequest('http://localhost/api/study-plan', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `payload-token=${token}`,
    },
    body: JSON.stringify(body),
  })
}

function makeGetRequest(gradeLevel: string, cId: string, token = userAToken) {
  return new NextRequest(
    `http://localhost/api/study-plan?gradeLevel=${gradeLevel}&courseId=${cId}`,
    {
      method: 'GET',
      headers: { Cookie: `payload-token=${token}` },
    },
  )
}

describe('PUT /api/study-plan — generate action', () => {
  it('returns 401 when unauthenticated', async () => {
    const req = makePutRequest(VALID_GENERATE_BODY(), '')
    const res = await PUT(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 on invalid request body', async () => {
    const req = makePutRequest({ action: 'generate', courseId: '' })
    const res = await PUT(req)
    expect(res.status).toBe(400)
  })

  it('creates a study plan and returns plan data on first request', async () => {
    const req = makePutRequest(VALID_GENERATE_BODY())
    const res = await PUT(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.courseId).toBe(courseId)
    expect(body.data.examDate).toBe('2099-12-31')
    expect(Array.isArray(body.data.days)).toBe(true)
    expect(body.data.days.length).toBeGreaterThan(0)
  })
})

describe('GET /api/study-plan — owner isolation', () => {
  it('returns null when a different user queries the same course plan', async () => {
    // User A already generated a plan in the previous describe block.
    // User B queries with their own token — should not see User A's plan.
    const req = makeGetRequest(GRADE_LEVEL, courseId, userBToken)
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toBeNull()
  })

  it('returns the plan when the owner queries it', async () => {
    // User A should be able to retrieve their own plan
    const req = makeGetRequest(GRADE_LEVEL, courseId, userAToken)
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).not.toBeNull()
    expect(body.data.courseId).toBe(courseId)
  })
})
