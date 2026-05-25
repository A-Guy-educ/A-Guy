// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing.

/**
 * Integration tests: Admin Dashboard Metrics API — Recent Transactions (#1963)
 *
 * Verifies that GET /api/admin/dashboard-metrics returns recentTransactions
 * (up to 5 most recent transactions, sorted by createdAt descending) so that
 * the RecentTransactionsWidget can use MetricsProvider instead of calling
 * /api/collections/transactions directly (which returns HTTP 404).
 *
 * Pattern: matches tests/int/admin-dashboard-revenue-metrics-1641.int.spec.ts
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
let transactionIds: string[] = []

const ts = Date.now()

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  const adminEmail = `recenttx-admin-${ts}@test.local`
  const studentEmail = `recenttx-student-${ts}@test.local`
  const password = 'test-password-1234'

  // Admin user
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: adminEmail,
      password,
      name: 'RecentTx Admin',
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
      name: 'RecentTx Student',
      role: AccountRole.Student,
    } as any,
    overrideAccess: true,
  })

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

  // Product
  const product = await payload.create({
    collection: 'products',
    data: {
      name: `RecentTx Product ${ts}`,
      slug: `recenttx-product-${ts}`,
      billingType: 'one_time',
      price: 1500,
      currency: 'ILS',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  productId = product.id

  // Create 6 transactions (widget only shows 5 most recent)
  for (let i = 0; i < 6; i++) {
    const created = await payload.create({
      collection: 'transactions',
      data: {
        user: adminUserId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: `recenttx_test_${ts}_${i}_${Math.random().toString(36).slice(2)}`,
        status: i % 2 === 0 ? 'succeeded' : 'failed',
        amount: (i + 1) * 1000,
        currency: 'ILS',
      } as any,
      overrideAccess: true,
    })
    transactionIds.push(created.id)
    // Stagger creation times slightly
    await new Promise((r) => setTimeout(r, 50))
  }
}, 120_000)

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return
  for (const id of transactionIds) {
    try {
      await payload.delete({ collection: 'transactions', id, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
  if (productId) {
    try {
      await payload.delete({ collection: 'products', id: productId, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
  for (const email of [`recenttx-admin-${ts}@test.local`, `recenttx-student-${ts}@test.local`]) {
    try {
      const users = await payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        overrideAccess: true,
      })
      for (const u of users.docs) {
        await payload.delete({ collection: 'users', id: u.id, overrideAccess: true })
      }
    } catch {
      /* already deleted */
    }
  }
}, 60_000)

describe.skipIf(!hasDatabaseUrl)(
  'GET /api/admin/dashboard-metrics — recentTransactions (#1963)',
  () => {
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

    it('returns recentTransactions field with up to 5 transactions sorted by createdAt descending', async () => {
      const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
        headers: { Authorization: `JWT ${adminToken}` },
      })
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = await res.json()

      expect(body).toHaveProperty('recentTransactions')
      expect(Array.isArray(body.recentTransactions)).toBe(true)
      expect(body.recentTransactions.length).toBeLessThanOrEqual(5)

      // Most recent first
      for (let i = 0; i < body.recentTransactions.length - 1; i++) {
        const curr = new Date(body.recentTransactions[i].createdAt).getTime()
        const next = new Date(body.recentTransactions[i + 1].createdAt).getTime()
        expect(curr).toBeGreaterThanOrEqual(next)
      }
    })

    it('each recentTransaction has required fields: id, status, amount, currency, product, user', async () => {
      const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
        headers: { Authorization: `JWT ${adminToken}` },
      })
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(Array.isArray(body.recentTransactions)).toBe(true)
      expect(body.recentTransactions.length).toBeGreaterThan(0)

      for (const tx of body.recentTransactions) {
        expect(typeof tx.id).toBe('string')
        expect(['pending', 'succeeded', 'failed', 'refunded']).toContain(tx.status)
        expect(typeof tx.amount).toBe('number')
        expect(typeof tx.currency).toBe('string')
        expect(tx.product).toBeDefined()
        expect(tx.user).toBeDefined()
      }
    })
  },
)
