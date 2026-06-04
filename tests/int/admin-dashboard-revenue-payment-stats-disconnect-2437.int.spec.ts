// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing.

/**
 * Integration tests: Admin Dashboard Metrics API — PaymentStats as revenue source (#2437)
 *
 * Bug: RevenueWidget on /admin shows ₪0.00 / 0.0% success despite PaymentStats having
 * a succeeded record. The dashboard-metrics API was computing revenue exclusively from
 * the transactions collection, ignoring the pre-aggregated PaymentStats rows.
 *
 * This test verifies that when a PaymentStats record exists within the period,
 * the revenueMetrics response reflects it — even if no corresponding transaction
 * was created in the current period (e.g., legacy data or direct DB insertion).
 */

import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Start the MongoDB container and set DATABASE_URL BEFORE importing any Payload modules.
// payload.config.ts throws if DATABASE_URL is missing at import time, so all
// Payload imports (including @payload-config) must be deferred to inside beforeAll.
let mongoUri: string
let hasDatabaseUrl = false

let payload: Payload
let adminToken: string
let adminUserId: string
let studentUserId: string
let studentToken: string
let GET: typeof import('@/app/api/admin/dashboard-metrics/route').GET

const ts = Date.now()

beforeAll(async () => {
  // 1. Start MongoDB container (same pattern as payment-stats.int.spec.ts)
  const { startMongoContainer, stopMongoContainer } =
    await import('@/infra/utils/test/mongodb-container')
  mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri
  hasDatabaseUrl = true

  // 2. Now import AccountRole (no Payload dependency)
  const { AccountRole } = await import('@/server/payload/collections/Users/roles')

  // 3. Import @payload-config (must be after DATABASE_URL is set)
  const { default: config } = await import('@payload-config')

  // 4. Import the route (must be after DATABASE_URL is set)
  const mod = await import('@/app/api/admin/dashboard-metrics/route')
  GET = mod.GET

  // 5. Initialize Payload with the real config
  const { getPayload } = await import('payload')
  payload = await getPayload({ config })

  const adminEmail = `ps-revenue-admin-${ts}@test.local`
  const studentEmail = `ps-revenue-student-${ts}@test.local`
  const password = 'test-password-1234'

  // Admin user
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: adminEmail,
      password,
      name: 'PS Revenue Admin',
    } as any,
    overrideAccess: true,
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
      name: 'PS Revenue Student',
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
}, 120_000)

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
  // Stop MongoDB container
  try {
    const { stopMongoContainer } = await import('@/infra/utils/test/mongodb-container')
    await stopMongoContainer()
  } catch {
    /* ignore */
  }
}, 60_000)

describe('GET /api/admin/dashboard-metrics revenue from PaymentStats (#2437)', () => {
  it('returns ₤0.00 when no PaymentStats records exist in period', async () => {
    // Wipe any residual payment_stats first
    const existing = await payload.find({
      collection: 'payment_stats',
      depth: 0,
      overrideAccess: true,
      limit: 100,
    })
    for (const doc of existing.docs) {
      await payload.delete({ collection: 'payment_stats', id: doc.id, overrideAccess: true })
    }

    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    // No data → zero revenue
    expect(body.revenueMetrics.totalRevenueAgorot.ILS ?? 0).toBe(0)
    expect(body.revenueMetrics.transactionCount).toBe(0)
  })

  it('reflects PaymentStats succeeded revenue in revenueMetrics', async () => {
    // Wipe any residual payment_stats first
    const existing = await payload.find({
      collection: 'payment_stats',
      depth: 0,
      overrideAccess: true,
      limit: 100,
    })
    for (const doc of existing.docs) {
      await payload.delete({ collection: 'payment_stats', id: doc.id, overrideAccess: true })
    }

    // Create a PaymentStats row directly (bypassing the transactions table)
    // This simulates legacy data or a record inserted independently of transactions
    const today = new Date().toISOString().split('T')[0]
    await payload.create({
      collection: 'payment_stats',
      data: {
        date: today,
        currency: 'ILS',
        totalRevenueAgorot: 6000, // ₪60.00 in agorot
        refundedAgorot: 0,
        failedAgorot: 0,
        transactionCount: 1,
        succeededCount: 1,
        refundedCount: 0,
        failedCount: 0,
        newCustomersCount: 1,
      } as any,
      overrideAccess: true,
    })

    try {
      const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
        headers: { Authorization: `JWT ${adminToken}` },
      })
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = await res.json()

      // RevenueWidget derives hasTransactions from transactionCount > 0
      expect(body.revenueMetrics.transactionCount).toBeGreaterThan(0)
      // totalRevenueAgorot.ILS should reflect the ₪60.00 from PaymentStats (6000 agorot)
      expect(body.revenueMetrics.totalRevenueAgorot.ILS ?? 0).toBe(6000)
    } finally {
      // Cleanup
      const leftover = await payload.find({
        collection: 'payment_stats',
        depth: 0,
        overrideAccess: true,
        limit: 10,
      })
      for (const doc of leftover.docs) {
        await payload.delete({ collection: 'payment_stats', id: doc.id, overrideAccess: true })
      }
    }
  })

  it('reflects refunded and failed amounts from PaymentStats', async () => {
    // Wipe any residual payment_stats first
    const existing = await payload.find({
      collection: 'payment_stats',
      depth: 0,
      overrideAccess: true,
      limit: 100,
    })
    for (const doc of existing.docs) {
      await payload.delete({ collection: 'payment_stats', id: doc.id, overrideAccess: true })
    }

    const today = new Date().toISOString().split('T')[0]
    await payload.create({
      collection: 'payment_stats',
      data: {
        date: today,
        currency: 'ILS',
        totalRevenueAgorot: 10000, // ₪100.00 succeeded
        refundedAgorot: 2000, // ₪20.00 refunded
        failedAgorot: 500, // ₪5.00 failed
        transactionCount: 3,
        succeededCount: 1,
        refundedCount: 1,
        failedCount: 1,
        newCustomersCount: 1,
      } as any,
      overrideAccess: true,
    })

    try {
      const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
        headers: { Authorization: `JWT ${adminToken}` },
      })
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = await res.json()

      expect(body.revenueMetrics.totalRevenueAgorot.ILS ?? 0).toBe(10000)
      expect(body.revenueMetrics.refundedAgorot).toBe(2000)
      expect(body.revenueMetrics.failedAgorot).toBe(500)
      expect(body.revenueMetrics.transactionCount).toBe(3)
      // successRate = succeededCount / nonPendingCount = 1 / 3 ≈ 33.3%
      expect(body.revenueMetrics.successRate).toBeCloseTo(33.3, 1)
    } finally {
      // Cleanup
      const leftover = await payload.find({
        collection: 'payment_stats',
        depth: 0,
        overrideAccess: true,
        limit: 10,
      })
      for (const doc of leftover.docs) {
        await payload.delete({ collection: 'payment_stats', id: doc.id, overrideAccess: true })
      }
    }
  })

  it('only counts PaymentStats records within the period start date', async () => {
    // Wipe any residual payment_stats first
    const existing = await payload.find({
      collection: 'payment_stats',
      depth: 0,
      overrideAccess: true,
      limit: 100,
    })
    for (const doc of existing.docs) {
      await payload.delete({ collection: 'payment_stats', id: doc.id, overrideAccess: true })
    }

    // Create a record for a date far in the past (outside any reasonable period)
    const oldDate = '2020-01-01'
    await payload.create({
      collection: 'payment_stats',
      data: {
        date: oldDate,
        currency: 'ILS',
        totalRevenueAgorot: 999999,
        refundedAgorot: 0,
        failedAgorot: 0,
        transactionCount: 99,
        succeededCount: 99,
        refundedCount: 0,
        failedCount: 0,
        newCustomersCount: 99,
      } as any,
      overrideAccess: true,
    })

    try {
      const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
        headers: { Authorization: `JWT ${adminToken}` },
      })
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = await res.json()

      // Old record should be outside the month period — not counted
      expect(body.revenueMetrics.totalRevenueAgorot.ILS ?? 0).toBe(0)
      expect(body.revenueMetrics.transactionCount).toBe(0)
    } finally {
      // Cleanup
      const leftover = await payload.find({
        collection: 'payment_stats',
        depth: 0,
        overrideAccess: true,
        limit: 10,
      })
      for (const doc of leftover.docs) {
        await payload.delete({ collection: 'payment_stats', id: doc.id, overrideAccess: true })
      }
    }
  })

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
})
