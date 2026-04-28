// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing.

/**
 * Integration tests: Admin Dashboard Metrics API — response shape (#1372)
 *
 * Verifies that GET /api/admin/dashboard-metrics returns the registration
 * fields the admin dashboard widget depends on (registeredYesterday,
 * registeredThisWeek/LastWeek, registeredThisMonth/LastMonth, totalUsers,
 * returningUsers, returningUsersTotal). This guards against silent contract
 * drift between the route and the UI component.
 *
 * Pattern: matches tests/int/teacher-profiles-api.int.spec.ts — uses the
 * shared Payload instance from global-int-setup, imports GET directly, and
 * authenticates with `Authorization: JWT <token>`. We do not exercise
 * specific count math here (createdAt is auto-set by Payload, so backdated
 * fixtures aren't reliable); date-window math belongs in unit tests on the
 * route's exported helpers.
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
let adminUserId: string
let studentUserId: string
let studentToken: string

const ts = Date.now()

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  const adminEmail = `admin-shape-${ts}@test.local`
  const studentEmail = `student-shape-${ts}@test.local`
  const password = 'test-password-1234'

  // Admin user — create as default user, then promote via update.
  // The Users beforeChange hook strips role=Admin on create; only
  // payload.update with overrideAccess can set it.
  // See tests/int/access-codes.int.spec.ts for the canonical pattern.
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: adminEmail,
      password,
      name: 'Shape Admin',
    } as any,
  })
  await payload.update({
    collection: 'users',
    id: admin.id,
    data: { role: AccountRole.Admin } as any,
    overrideAccess: true,
  })
  adminUserId = admin.id

  const student = await payload.create({
    collection: 'users',
    data: {
      email: studentEmail,
      password,
      name: 'Shape Student',
      role: AccountRole.Student,
    } as any,
    overrideAccess: true,
  })
  studentUserId = student.id

  const adminLogin = await payload.login({
    collection: 'users',
    data: { email: adminEmail, password },
  })
  adminToken = adminLogin.token!

  const studentLogin = await payload.login({
    collection: 'users',
    data: { email: studentEmail, password },
  })
  studentToken = studentLogin.token!
}, 60_000)

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return
  for (const id of [adminUserId, studentUserId]) {
    if (!id) continue
    try {
      await payload.delete({ collection: 'users', id, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
}, 60_000)

describe.skipIf(!hasDatabaseUrl)('GET /api/admin/dashboard-metrics', () => {
  it('returns 401 without auth', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
      headers: { Authorization: `JWT ${studentToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('rejects invalid period values with 400', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=decade', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns the full UserMetrics shape for admins', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()

    expect(body.period).toBe('month')
    expect(body.userMetrics).toEqual(
      expect.objectContaining({
        activeUsersToday: expect.any(Number),
        activeUsersYesterday: expect.any(Number),
        registeredYesterday: expect.any(Number),
        registeredThisWeek: expect.any(Number),
        registeredLastWeek: expect.any(Number),
        registeredThisMonth: expect.any(Number),
        registeredLastMonth: expect.any(Number),
        totalUsers: expect.any(Number),
        totalGuestSessions: expect.any(Number),
        guestToRegisteredCount: expect.any(Number),
        returningUsers: expect.any(Number),
        returningUsersTotal: expect.any(Number),
      }),
    )
    expect(body.contentCounts).toEqual(
      expect.objectContaining({
        courses: expect.any(Number),
        lessons: expect.any(Number),
        exercises: expect.any(Number),
        formulaSheets: expect.any(Number),
        prompts: expect.any(Number),
      }),
    )
    expect(body.engagement.lessonTypeUsage).toEqual(
      expect.objectContaining({
        learning: expect.any(Number),
        practice: expect.any(Number),
        exam: expect.any(Number),
      }),
    )
    expect(Array.isArray(body.engagement.courseEnrollments)).toBe(true)
    expect(body.engagement.featureUsage).toEqual(
      expect.objectContaining({
        questionsAsked: expect.any(Number),
        conversationsStarted: expect.any(Number),
        lessonsCompleted: expect.any(Number),
        exercisesAttempted: expect.any(Number),
        exercisesCompleted: expect.any(Number),
      }),
    )

    // Total users count should at minimum reflect the two we created.
    expect(body.userMetrics.totalUsers).toBeGreaterThanOrEqual(2)
  })

  it('totalUsers grows after creating an additional user', async () => {
    const before = (await GET(
      new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
        headers: { Authorization: `JWT ${adminToken}` },
      }),
    ).then((r) => r.json())) as { userMetrics: { totalUsers: number } }

    const extra = await payload.create({
      collection: 'users',
      data: {
        email: `extra-${ts}-${Math.random().toString(36).slice(2)}@test.local`,
        password: 'test-password-1234',
        name: 'Extra',
        role: AccountRole.Student,
      } as any,
      overrideAccess: true,
    })

    try {
      const after = (await GET(
        new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
          headers: { Authorization: `JWT ${adminToken}` },
        }),
      ).then((r) => r.json())) as { userMetrics: { totalUsers: number } }

      expect(after.userMetrics.totalUsers).toBe(before.userMetrics.totalUsers + 1)
    } finally {
      await payload.delete({ collection: 'users', id: extra.id, overrideAccess: true })
    }
  })
})
