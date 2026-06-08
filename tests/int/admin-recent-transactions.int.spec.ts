// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing.

/**
 * Integration tests: Admin Recent Transactions API (#1783)
 *
 * Verifies that GET /api/admin/recent-transactions returns the 5 most
 * recent transactions for the admin dashboard RecentTransactionsWidget.
 * This test guards against the widget fetching /api/collections/transactions
 * directly (which returns 404 due to CSRF/auth issues with Payload REST API
 * when called from client-side components).
 *
 * Covers:
 * 1. Returns 401 without auth
 * 2. Returns 403 for non-admin users
 * 3. Returns recent transactions for admin users with correct shape
 */

import { GET } from '@/app/api/admin/recent-transactions/route'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
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
let studentUserId: string
let productId: string
let transactionIds: string[] = []
let originalDatabaseUrl: string | undefined

const ts = Date.now()

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const configModule = await import('@payload-config')
  payload = await getPayload({ config: configModule.default })

  const adminEmail = `recent-tx-admin-${ts}@test.local`
  const studentEmail = `recent-tx-student-${ts}@test.local`
  const password = 'test-password-1234'

  // Admin user
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: adminEmail,
      password,
      name: 'Recent Tx Admin',
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

  // Student user
  const student = await payload.create({
    collection: 'users',
    data: {
      email: studentEmail,
      password,
      name: 'Recent Tx Student',
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
      name: `Recent Tx Product ${ts}`,
      slug: `recent-tx-product-${ts}`,
      billingType: 'one_time',
      price: 2500,
      currency: 'ILS',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  productId = product.id

  // Create 6 transactions (more than the 5 the widget requests)
  for (let i = 0; i < 6; i++) {
    const statuses = ['succeeded', 'pending', 'failed', 'refunded']
    const created = await payload.create({
      collection: 'transactions',
      data: {
        user: adminUserId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: `recent_tx_test_${ts}_${i}_${Math.random().toString(36).slice(2)}`,
        status: statuses[i % statuses.length],
        amount: (i + 1) * 1000,
        currency: 'ILS',
      } as any,
      overrideAccess: true,
    })
    transactionIds.push(created.id)
    // Small delay to ensure distinct createdAt timestamps
    await new Promise((r) => setTimeout(r, 10))
  }
}, 240_000)

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
  for (const id of [adminUserId, studentUserId]) {
    if (!id) continue
    try {
      await payload.delete({ collection: 'users', id, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }

  stopMongoContainer()
  if (originalDatabaseUrl) {
    process.env.DATABASE_URL = originalDatabaseUrl
  }
}, 120_000)

describe.skipIf(!hasDatabaseUrl)('GET /api/admin/recent-transactions', () => {
  it('returns 401 without auth', async () => {
    const req = new Request('http://localhost:3000/api/admin/recent-transactions')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const req = new Request('http://localhost:3000/api/admin/recent-transactions', {
      headers: { Authorization: `JWT ${studentToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('returns recent transactions for admin users with correct shape', async () => {
    const req = new Request('http://localhost:3000/api/admin/recent-transactions', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()

    // Should return an array of transactions
    expect(Array.isArray(body.transactions)).toBe(true)

    // Should return at most 5 transactions (widget requests limit=5)
    expect(body.transactions.length).toBeLessThanOrEqual(5)

    if (body.transactions.length > 0) {
      const tx = body.transactions[0]
      expect(tx).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          createdAt: expect.any(String),
          amount: expect.any(Number),
          currency: expect.any(String),
          status: expect.any(String),
          user: expect.objectContaining({
            email: expect.any(String),
          }),
          product: expect.objectContaining({
            name: expect.any(String),
          }),
        }),
      )
    }
  })

  it('returns transactions sorted by createdAt descending (most recent first)', async () => {
    const req = new Request('http://localhost:3000/api/admin/recent-transactions', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    if (body.transactions.length >= 2) {
      for (let i = 0; i < body.transactions.length - 1; i++) {
        const current = new Date(body.transactions[i].createdAt)
        const next = new Date(body.transactions[i + 1].createdAt)
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime())
      }
    }
  })
})
