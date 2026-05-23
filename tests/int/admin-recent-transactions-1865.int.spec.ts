// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing.

/**
 * Integration tests: Admin Recent Transactions API (#1865)
 *
 * Verifies that GET /api/admin/recent-transactions returns the 5 most recent
 * transactions for the admin dashboard Recent Transactions widget, which was
 * returning HTTP 404 because /api/collections/transactions does not exist.
 */

import { GET } from '@/app/api/admin/recent-transactions/route'
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

  // Create a product
  const product = await payload.create({
    collection: 'products',
    data: {
      name: `Recent Tx Test Product ${ts}`,
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
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10))
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
  for (const id of [adminUserId, studentUserId]) {
    if (!id) continue
    try {
      await payload.delete({ collection: 'users', id, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
}, 60_000)

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

  it('returns 200 for admin users with an array of transactions', async () => {
    const req = new Request('http://localhost:3000/api/admin/recent-transactions', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body.docs)).toBe(true)
  })

  it('returns at most 5 transactions', async () => {
    const req = new Request('http://localhost:3000/api/admin/recent-transactions', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.docs.length).toBeLessThanOrEqual(5)
  })

  it('transactions are sorted by createdAt descending (most recent first)', async () => {
    const req = new Request('http://localhost:3000/api/admin/recent-transactions', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    const docs = body.docs as Array<{ createdAt: string }>
    for (let i = 0; i < docs.length - 1; i++) {
      expect(new Date(docs[i].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(docs[i + 1].createdAt).getTime(),
      )
    }
  })

  it('each transaction has id, createdAt, amount, currency, status, user, and product fields', async () => {
    const req = new Request('http://localhost:3000/api/admin/recent-transactions', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    const docs = body.docs as Array<{
      id: string
      createdAt: string
      amount: number
      currency: string
      status: string
      user?: { email?: string }
      product?: { name?: string }
    }>

    expect(docs.length).toBeGreaterThan(0)

    for (const doc of docs) {
      expect(typeof doc.id).toBe('string')
      expect(typeof doc.createdAt).toBe('string')
      expect(typeof doc.amount).toBe('number')
      expect(typeof doc.currency).toBe('string')
      expect(['pending', 'succeeded', 'failed', 'refunded']).toContain(doc.status)
      expect(doc.user).toBeDefined()
      expect(doc.product).toBeDefined()
    }
  })
})
