// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing which depends on
// Node.js's native TextEncoder/Uint8Array. The jsdom environment can cause a
// Uint8Array realm mismatch that breaks jose's FlattenedSign constructor check.

/**
 * Integration tests: Dashboard Metrics API — Course Enrollments (#1373)
 *
 * Verifies that the route returns multiple courses with correct enrollment
 * counts when users have entitlements to different courses. This guards
 * against the regression where ObjectId-shaped course refs collapsed to a
 * single bucket and only one course appeared in the response.
 *
 * Pattern: matches tests/int/teacher-profiles-api.int.spec.ts — uses the
 * shared Payload instance from global-int-setup, imports the route's GET
 * directly, and authenticates with `Authorization: JWT <token>`.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { GET } from '@/app/api/admin/dashboard-metrics/route'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let adminToken: string
const createdUserIds: string[] = []
const createdCourseIds: string[] = []
let categoryId: string | undefined
let tenantId: string | undefined

const ts = Date.now()

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  // Tenant + category needed by courses
  const tenant = await payload.create({
    collection: 'tenants',
    data: {
      name: `metrics-${ts}`,
      slug: `metrics-${ts}`,
      status: 'active',
    } as any,
    overrideAccess: true,
  })
  tenantId = tenant.id

  const category = await payload.create({
    collection: 'categories',
    data: { title: 'Metrics Cat', slug: `metrics-cat-${ts}`, locale: 'he' } as any,
    overrideAccess: true,
  })
  categoryId = category.id

  // Three distinct courses
  for (const i of [1, 2, 3]) {
    const c = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `Course ${i}`,
        title: `Test Course ${i} ${ts}`,
        categories: [categoryId],
        tenant: tenantId,
        status: 'published',
      } as any,
      overrideAccess: true,
    })
    createdCourseIds.push(c.id)
  }
  const [course1Id, course2Id, course3Id] = createdCourseIds

  // Admin user used for auth — create as default user, then promote.
  // The Users collection has a beforeChange hook that prevents setting
  // role=Admin on initial create; only update with overrideAccess can.
  // See tests/int/access-codes.int.spec.ts for the canonical pattern.
  const adminEmail = `admin-metrics-${ts}@test.local`
  const adminPassword = 'test-password-1234'
  const adminUser = await payload.create({
    collection: 'users',
    data: {
      email: adminEmail,
      password: adminPassword,
      name: 'Metrics Admin',
    } as any,
  })
  await payload.update({
    collection: 'users',
    id: adminUser.id,
    data: { role: AccountRole.Admin } as any,
    overrideAccess: true,
  })
  createdUserIds.push(adminUser.id)

  const login = await payload.login({
    collection: 'users',
    data: { email: adminEmail, password: adminPassword },
  })
  adminToken = login.token!

  // Enrollments — Course1: 3 (u1,u2,u5), Course2: 2 (u3,u5), Course3: 1 (u4)
  const enrollmentSpecs: Array<{ email: string; courses: string[] }> = [
    { email: `u1-${ts}@test.local`, courses: [course1Id] },
    { email: `u2-${ts}@test.local`, courses: [course1Id] },
    { email: `u3-${ts}@test.local`, courses: [course2Id] },
    { email: `u4-${ts}@test.local`, courses: [course3Id] },
    { email: `u5-${ts}@test.local`, courses: [course1Id, course2Id] },
  ]
  for (const spec of enrollmentSpecs) {
    const u = await payload.create({
      collection: 'users',
      data: {
        email: spec.email,
        password: adminPassword,
        name: spec.email,
        courseEntitlements: spec.courses.map((c) => ({ course: c, grantMethod: 'admin' })),
      } as any,
      overrideAccess: true,
    })
    createdUserIds.push(u.id)
  }
}, 60_000)

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return

  for (const id of createdUserIds) {
    try {
      await payload.delete({ collection: 'users', id, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
  for (const id of createdCourseIds) {
    try {
      await payload.delete({ collection: 'courses', id, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
  if (categoryId) {
    try {
      await payload.delete({ collection: 'categories', id: categoryId, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
  if (tenantId) {
    try {
      await payload.delete({ collection: 'tenants', id: tenantId, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
}, 60_000)

describe.skipIf(!hasDatabaseUrl)('GET /api/admin/dashboard-metrics — course enrollments', () => {
  it('returns 401 when not authenticated', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('aggregates multiple courses with correct counts', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = (await res.json()) as {
      engagement: { courseEnrollments: Array<{ courseTitle: string; count: number }> }
    }
    const titleToCount = new Map(
      body.engagement.courseEnrollments.map((e) => [e.courseTitle, e.count]),
    )

    expect(titleToCount.get(`Test Course 1 ${ts}`)).toBe(3)
    expect(titleToCount.get(`Test Course 2 ${ts}`)).toBe(2)
    expect(titleToCount.get(`Test Course 3 ${ts}`)).toBe(1)
  })
})
