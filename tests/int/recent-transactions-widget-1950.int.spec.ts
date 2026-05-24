// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing.

/**
 * Integration tests: Recent Transactions Widget - dashboard metrics integration (#1950)
 *
 * Verifies that GET /api/admin/dashboard-metrics returns recentTransactions
 * field that the RecentTransactionsWidget depends on.
 *
 * The widget previously called /api/collections/transactions directly which returned 404.
 * Now it reads from the dashboard metrics endpoint which uses the Payload local API.
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
let studentToken: string
let productId: string
let createdTransactionIds: string[] = []

const ts = Date.now()

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  const adminEmail = `admin-tx-${ts}@test.local`
  const studentEmail = `student-tx-${ts}@test.local`
  const password = 'test-password-1234'

  // Create admin user
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: adminEmail,
      password,
      name: 'Tx Admin',
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

  // Create student user (non-admin)
  const student = await payload.create({
    collection: 'users',
    data: {
      email: studentEmail,
      password,
      name: 'Tx Student',
      role: AccountRole.Student,
    } as any,
    overrideAccess: true,
  })

  // Login both users
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

  // Create a product for transactions
  const product = await payload.create({
    collection: 'products',
    data: {
      name: `Tx Test Product ${ts}`,
      slug: `tx-test-product-${ts}`,
      billingType: 'one_time',
      price: 1000,
      currency: 'ILS',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  productId = product.id

  // Create test transactions
  const txData = [
    { status: 'succeeded', amount: 1000 },
    { status: 'failed', amount: 500 },
    { status: 'refunded', amount: 300 },
    { status: 'pending', amount: 200 },
    { status: 'succeeded', amount: 1500 },
    { status: 'succeeded', amount: 2000 },
  ]

  for (const tx of txData) {
    const created = await payload.create({
      collection: 'transactions',
      data: {
        user: adminUserId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: `test-widget-${ts}-${Math.random().toString(36).slice(2)}`,
        status: tx.status,
        amount: tx.amount,
        currency: 'ILS',
      } as any,
      overrideAccess: true,
    })
    createdTransactionIds.push(created.id)
  }
}, 120_000)

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return

  // Cleanup transactions
  for (const id of createdTransactionIds) {
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
      /* ignore */
    }
  }

  // Cleanup users
  for (const id of [adminUserId]) {
    if (!id) continue
    try {
      await payload.delete({ collection: 'users', id, overrideAccess: true })
    } catch {
      /* ignore */
    }
  }
}, 120_000)

describe.skipIf(!hasDatabaseUrl)('GET /api/admin/dashboard-metrics - recentTransactions', () => {
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

  it('includes recentTransactions field in response for admin', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()

    expect(body).toHaveProperty('recentTransactions')
    expect(Array.isArray(body.recentTransactions)).toBe(true)
  })

  it('returns up to 5 recent transactions sorted by createdAt descending', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    const { recentTransactions } = body

    expect(recentTransactions.length).toBeLessThanOrEqual(5)

    // Verify sorting (most recent first)
    for (let i = 0; i < recentTransactions.length - 1; i++) {
      const current = new Date(recentTransactions[i].createdAt)
      const next = new Date(recentTransactions[i + 1].createdAt)
      expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime())
    }
  })

  it('each recentTransaction has required fields', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    const { recentTransactions } = body

    if (recentTransactions.length > 0) {
      const tx = recentTransactions[0]
      expect(tx).toHaveProperty('id')
      expect(tx).toHaveProperty('createdAt')
      expect(tx).toHaveProperty('amount')
      expect(tx).toHaveProperty('currency')
      expect(tx).toHaveProperty('status')
      expect(['pending', 'succeeded', 'failed', 'refunded']).toContain(tx.status)
    }
  })

  it('includes user and product relationships when depth=2', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    const { recentTransactions } = body

    if (recentTransactions.length > 0) {
      const tx = recentTransactions[0]
      // user and product are populated because depth=2 was used
      expect(tx).toHaveProperty('user')
      expect(tx).toHaveProperty('product')
    }
  })
})
