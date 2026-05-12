// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing.

/**
 * Integration tests: Admin Dashboard Metrics API — User Metrics fields (#1514)
 *
 * Verifies that GET /api/admin/dashboard-metrics returns all user metric fields
 * required by the dashboard according to issue #1514:
 *
 * 1. Active Users — Today, Last Week, Last Month (prevent double counting)
 * 2. Anonymous Users — Time period breakdowns
 * 3. Guest → Registered Conversion — count AND percentage (capped at 100%)
 * 4. Returned Users — "Returned Once+" and "Returned Multiple Times" counts/percentages
 *
 * Pattern: matches tests/int/admin-dashboard-metrics.int.spec.ts — uses the
 * shared Payload instance from global-int-setup, imports GET directly, and
 * authenticates with `Authorization: JWT <token>`.
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

const ts = Date.now()

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  const adminEmail = `admin-metrics-1514-${ts}@test.local`
  const password = 'test-password-1234'

  // Admin user — create as default user, then promote via update.
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: adminEmail,
      password,
      name: 'Metrics Admin 1514',
    } as any,
  })
  await payload.update({
    collection: 'users',
    id: admin.id,
    data: { role: AccountRole.Admin } as any,
    overrideAccess: true,
  })
  adminUserId = admin.id

  const adminLogin = await payload.login({
    collection: 'users',
    data: { email: adminEmail, password },
  })
  adminToken = adminLogin.token!
}, 60_000)

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return
  if (adminUserId) {
    try {
      await payload.delete({ collection: 'users', id: adminUserId, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
}, 60_000)

describe.skipIf(!hasDatabaseUrl)(
  'GET /api/admin/dashboard-metrics — user metrics per #1514',
  () => {
    it('returns Active Users with Today, Last Week, and Last Month breakdowns', async () => {
      const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
        headers: { Authorization: `JWT ${adminToken}` },
      })
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = await res.json()

      // Active Users should have time period breakdowns per issue #1514
      expect(body.userMetrics).toEqual(
        expect.objectContaining({
          // Issue #1514: "Show data for: Today, Last Week, Last Month"
          activeUsersToday: expect.any(Number),
          activeUsersLastWeek: expect.any(Number), // Required per issue #1514
          activeUsersLastMonth: expect.any(Number), // Required per issue #1514
        }),
      )
    })

    it('returns Anonymous Users with time period breakdowns', async () => {
      const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
        headers: { Authorization: `JWT ${adminToken}` },
      })
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = await res.json()

      // Anonymous/Guest Users should have time period breakdowns per issue #1514
      expect(body.userMetrics).toEqual(
        expect.objectContaining({
          // Issue #1514: "Show data for: Today, Last Week, Last Month" (for anonymous users too)
          guestSessionsToday: expect.any(Number), // Required per issue #1514
          guestSessionsLastWeek: expect.any(Number), // Required per issue #1514
          guestSessionsLastMonth: expect.any(Number), // Required per issue #1514
        }),
      )
    })

    it('returns Guest → Registered Conversion with count AND percentage', async () => {
      const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
        headers: { Authorization: `JWT ${adminToken}` },
      })
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = await res.json()

      // Guest → Registered Conversion requires BOTH count and percentage per issue #1514
      expect(body.userMetrics).toEqual(
        expect.objectContaining({
          guestToRegisteredCount: expect.any(Number),
          guestToRegisteredPercentage: expect.any(Number), // Required per issue #1514
        }),
      )

      // Issue #1514: "Percentage cannot exceed 100%"
      expect(body.userMetrics.guestToRegisteredPercentage).toBeLessThanOrEqual(100)
      expect(body.userMetrics.guestToRegisteredPercentage).toBeGreaterThanOrEqual(0)
    })

    it('returns Returned Users with Once+ and Multiple Times breakdowns', async () => {
      const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
        headers: { Authorization: `JWT ${adminToken}` },
      })
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = await res.json()

      // Returned Users should have two levels per issue #1514:
      // 1. "Returned Once+" - returned at least once after first use
      // 2. "Returned Multiple Times" - returned more than twice
      expect(body.userMetrics).toEqual(
        expect.objectContaining({
          // Returned Once+
          returnedOnceCount: expect.any(Number), // Required per issue #1514
          returnedOncePercentage: expect.any(Number), // Required per issue #1514
          // Returned Multiple Times
          returnedMultipleCount: expect.any(Number), // Required per issue #1514
          returnedMultiplePercentage: expect.any(Number), // Required per issue #1514
        }),
      )

      // Percentages should be valid (0-100)
      expect(body.userMetrics.returnedOncePercentage).toBeLessThanOrEqual(100)
      expect(body.userMetrics.returnedOncePercentage).toBeGreaterThanOrEqual(0)
      expect(body.userMetrics.returnedMultiplePercentage).toBeLessThanOrEqual(100)
      expect(body.userMetrics.returnedMultiplePercentage).toBeGreaterThanOrEqual(0)

      // Returned multiple should not exceed returned once
      expect(body.userMetrics.returnedMultipleCount).toBeLessThanOrEqual(
        body.userMetrics.returnedOnceCount,
      )
      expect(body.userMetrics.returnedMultiplePercentage).toBeLessThanOrEqual(
        body.userMetrics.returnedOncePercentage,
      )
    })

    it('has no anomalous values in user metrics', async () => {
      const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
        headers: { Authorization: `JWT ${adminToken}` },
      })
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      const { userMetrics } = body

      // Issue #1514: "Prevent anomalous or illogical values (e.g., negative numbers)"
      const numericFields = [
        'activeUsersToday',
        'activeUsersLastWeek',
        'activeUsersLastMonth',
        'totalGuestSessions',
        'guestSessionsToday',
        'guestSessionsLastWeek',
        'guestSessionsLastMonth',
        'guestToRegisteredCount',
        'guestToRegisteredPercentage',
        'returnedOnceCount',
        'returnedOncePercentage',
        'returnedMultipleCount',
        'returnedMultiplePercentage',
      ]

      for (const field of numericFields) {
        if (field in userMetrics) {
          expect(userMetrics[field]).toBeGreaterThanOrEqual(0)
        }
      }
    })
  },
)
