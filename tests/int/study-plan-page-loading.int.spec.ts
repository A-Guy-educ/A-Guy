// @vitest-environment node
/**
 * Bug #1822: Study Plan page shows Loading indefinitely
 *
 * When a user without an existing study plan visits /study-plan:
 * 1. The page should show an empty state (not a loading spinner)
 * 2. The API should return { success: true, data: null } when there's no plan
 *
 * The bug manifests as the page being stuck on "Loading..." forever,
 * which happens when isLoading stays true and hasGenerated stays false.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'

let GET: (req: NextRequest) => Promise<Response>
let payload: Payload
let originalDatabaseUrl: string | undefined
let originalDefaultTenantSlug: string | undefined
let userToken: string

const USER_EMAIL = `study-plan-loading-test-${Date.now()}@test.com`
const USER_PASSWORD = 'test-password-123!'
const GRADE_LEVEL = 'grade-8-splt-test'
const TENANT_SLUG = `splt-test-tenant-${Date.now()}`

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

  // Ensure the default tenant exists
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

  // Create a student user
  await (payload as any).create({
    collection: 'users',
    data: { email: USER_EMAIL, password: USER_PASSWORD, name: 'Study Plan Loading Test User' },
  })

  const login = await payload.login({
    collection: 'users',
    data: { email: USER_EMAIL, password: USER_PASSWORD },
  })
  userToken = login.token as string

  // Dynamic import after DATABASE_URL is set
  const route = await import('@/app/api/study-plan/route')
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

function makeGetRequest(gradeLevel: string, courseId: string) {
  return new NextRequest(
    `http://localhost/api/study-plan?gradeLevel=${gradeLevel}&courseId=${courseId}`,
    {
      method: 'GET',
      headers: { Cookie: `payload-token=${userToken}` },
    },
  )
}

describe('GET /api/study-plan — empty state handling', () => {
  it('returns { success: true, data: null } when user has no existing plan', async () => {
    // User has no userProgress document - should return null data (not an error)
    const req = makeGetRequest(GRADE_LEVEL, 'default-course')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toBeNull()
  })

  it('returns { success: true, data: null } when userProgress exists but no plan for this courseId', async () => {
    // Create userProgress without a study plan
    await (payload as any).create({
      collection: 'user-progress',
      data: {
        user: (
          await payload.find({ collection: 'users', where: { email: { equals: USER_EMAIL } } })
        ).docs[0].id,
        gradeLevel: GRADE_LEVEL,
        studyPlans: [],
      },
      overrideAccess: true,
    })

    const req = makeGetRequest(GRADE_LEVEL, 'default-course')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toBeNull()
  })
})
