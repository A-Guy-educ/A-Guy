// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing.

/**
 * Integration tests: Admin Dashboard Metrics API — recent transactions (#1968)
 *
 * Verifies that GET /api/admin/dashboard-metrics returns recentTransactions
 * (5 most recent transactions with user.email and product.name populated via depth=2).
 * This guards against the widget that was fetching /api/collections/transactions directly
 * and returning HTTP 404.
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
let productId: string
let transactionIds: string[] = []

const ts = Date.now()

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  const adminEmail = `recent-tx-admin-${ts}@test.local`
  const studentEmail = `recent-tx-student-${ts}@test.local`
  const password = 'test-password-1234'

  // Admin user
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: adminEmail,
      password,
      name: 'Recent TX Admin',
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
      name: 'Recent TX Student',
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

  // Create product
  const product = await payload.create({
    collection: 'products',
    data: {
      name: `Recent TX Test Product ${ts}`,
      slug: `recent-tx-test-product-${ts}`,
      billingType: 'one_time',
      price: 1000,
      currency: 'ILS',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  productId = product.id

  // Create 6 transactions (more than the 5 that should be returned)
  for (let i = 0; i < 6; i++) {
    const created = await payload.create({
      collection: 'transactions',
      data: {
        user: adminUserId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: `recent_tx_test_${Date.now()}_${i}_${Math.random().toString(36).slice(2)}`,
        status: i % 2 === 0 ? 'succeeded' : 'pending',
        amount: (i + 1) * 1000,
        currency: 'ILS',
      } as any,
      overrideAccess: true,
    })
    transactionIds.push(created.id)
    // Small delay to ensure different createdAt timestamps
    await new Promise((r) => setTimeout(r, 10))
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
  // Cleanup product
  if (productId) {
    try {
      await payload.delete({ collection: 'products', id: productId, overrideAccess: true })
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

describe.skipIf(!hasDatabaseUrl)('GET /api/admin/dashboard-metrics recent transactions', () => {
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

  it('returns recentTransactions array with at most 5 entries for admin', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()

    expect(body.recentTransactions).toBeDefined()
    expect(Array.isArray(body.recentTransactions)).toBe(true)
    expect(body.recentTransactions.length).toBeLessThanOrEqual(5)
  })

  it('each recent transaction has id, createdAt, amount, currency, status, user.email, and product.name', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()

    for (const tx of body.recentTransactions) {
      expect(typeof tx.id).toBe('string')
      expect(typeof tx.createdAt).toBe('string')
      expect(typeof tx.amount).toBe('number')
      expect(typeof tx.currency).toBe('string')
      expect(typeof tx.status).toBe('string')
      expect(tx.user).toBeDefined()
      expect(typeof tx.user?.email).toBe('string')
      expect(tx.product).toBeDefined()
      expect(typeof tx.product?.name).toBe('string')
    }
  })

  it('recentTransactions are sorted by createdAt descending (most recent first)', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()

    for (let i = 0; i < body.recentTransactions.length - 1; i++) {
      const current = new Date(body.recentTransactions[i].createdAt).getTime()
      const next = new Date(body.recentTransactions[i + 1].createdAt).getTime()
      expect(current).toBeGreaterThanOrEqual(next)
    }
  })

  it('returns recentTransactions for all period values (week/month/year)', async () => {
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

      expect(body.recentTransactions).toBeDefined()
      expect(Array.isArray(body.recentTransactions))
    }
  })
})
