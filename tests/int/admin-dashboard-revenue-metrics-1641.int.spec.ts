// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing.

/**
 * Integration tests: Admin Dashboard Metrics API — revenue metrics (#1641)
 *
 * Verifies that GET /api/admin/dashboard-metrics returns revenueMetrics
 * with totalRevenueAgorot, refundedAgorot, failedAgorot, transactionCount,
 * successRate, and topProducts for all period values (week/month/year).
 */

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
let product1Id: string
let product2Id: string
let transactionIds: string[] = []

const ts = Date.now()

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  const adminEmail = `revenue-admin-${ts}@test.local`
  const studentEmail = `revenue-student-${ts}@test.local`
  const password = 'test-password-1234'

  // Admin user
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: adminEmail,
      password,
      name: 'Revenue Admin',
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
      name: 'Revenue Student',
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

  // Create products
  const product1 = await payload.create({
    collection: 'products',
    data: {
      name: `Revenue Test Product 1 ${ts}`,
      slug: `revenue-test-product-1-${ts}`,
      billingType: 'one_time',
      price: 1000,
      currency: 'ILS',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  product1Id = product1.id

  const product2 = await payload.create({
    collection: 'products',
    data: {
      name: `Revenue Test Product 2 ${ts}`,
      slug: `revenue-test-product-2-${ts}`,
      billingType: 'one_time',
      price: 2000,
      currency: 'ILS',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  product2Id = product2.id

  // Create transactions
  const txData = [
    { status: 'succeeded', amount: 1000, currency: 'ILS', product: product1Id },
    { status: 'succeeded', amount: 2000, currency: 'ILS', product: product2Id },
    { status: 'refunded', amount: 500, currency: 'ILS', product: product1Id },
    { status: 'failed', amount: 300, currency: 'ILS', product: product2Id },
  ]

  for (const tx of txData) {
    const created = await payload.create({
      collection: 'transactions',
      data: {
        user: adminUserId,
        product: tx.product,
        provider: 'stripe',
        providerTransactionId: `revenue_test_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        status: tx.status,
        amount: tx.amount,
        currency: tx.currency,
      } as any,
      overrideAccess: true,
    })
    transactionIds.push(created.id)
  }
}, 120_000)

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return
  // Cleanup transactions
  for (const id of transactionIds) {
    try {
      await payload.delete({ collection: 'transactions', id, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
  // Cleanup products
  for (const id of [product1Id, product2Id]) {
    if (!id) continue
    try {
      await payload.delete({ collection: 'products', id, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
  // Cleanup users
  for (const id of [adminUserId, studentUserId]) {
    if (!id) continue
    try {
      await payload.delete({ collection: 'users', id, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
}, 120_000)

describe.skipIf(!hasDatabaseUrl)('GET /api/admin/dashboard-metrics revenue metrics', () => {
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

  it('returns revenueMetrics block for admin with all required fields', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()

    expect(body.revenueMetrics).toEqual(
      expect.objectContaining({
        totalRevenueAgorot: expect.any(Object),
        refundedAgorot: expect.any(Number),
        failedAgorot: expect.any(Number),
        transactionCount: expect.any(Number),
        successRate: expect.any(Number),
        topProducts: expect.any(Array),
      }),
    )
  })

  it('totalRevenueAgorot is broken down by currency ISO code', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()

    // ILS should be present since our test transactions use ILS
    expect(typeof body.revenueMetrics.totalRevenueAgorot.ILS).toBe('number')
  })

  it('transactionCount reflects all transactions in period', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()

    // We created 4 transactions, should be at least 4
    expect(body.revenueMetrics.transactionCount).toBeGreaterThanOrEqual(4)
  })

  it('successRate is a percentage between 0 and 100', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()

    expect(body.revenueMetrics.successRate).toBeGreaterThanOrEqual(0)
    expect(body.revenueMetrics.successRate).toBeLessThanOrEqual(100)
  })

  it('topProducts returns up to 5 entries with product name and agorot total', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    const { topProducts } = body.revenueMetrics

    expect(Array.isArray(topProducts)).toBe(true)
    expect(topProducts.length).toBeLessThanOrEqual(5)

    for (const item of topProducts) {
      expect(typeof item.productName).toBe('string')
      expect(typeof item.agorot).toBe('number')
    }
  })

  it('topProducts are sorted by revenue descending', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    const { topProducts } = body.revenueMetrics

    for (let i = 0; i < topProducts.length - 1; i++) {
      expect(topProducts[i].agorot).toBeGreaterThanOrEqual(topProducts[i + 1].agorot)
    }
  })

  it('returns revenueMetrics for all period values (week/month/year)', async () => {
    for (const period of ['week', 'month', 'year']) {
      const req = new Request(
        `http://localhost:3000/api/admin/dashboard-metrics?period=${period}`,
        {
          headers: { Authorization: `JWT ${adminToken}` },
        },
      )
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = await res.json()

      expect(body.period).toBe(period)
      expect(body.revenueMetrics).toEqual(
        expect.objectContaining({
          totalRevenueAgorot: expect.any(Object),
          refundedAgorot: expect.any(Number),
          failedAgorot: expect.any(Number),
          transactionCount: expect.any(Number),
          successRate: expect.any(Number),
          topProducts: expect.any(Array),
        }),
      )
    }
  })
})
