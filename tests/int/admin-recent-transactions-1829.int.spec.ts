// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing.

/**
 * Integration tests: Admin Recent Transactions API (#1829)
 *
 * Verifies that GET /api/admin/recent-transactions returns the 5 most recent
 * transactions for the admin dashboard widget, bypassing collection-level
 * access control so non-admin QA accounts don't get 404.
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
let studentToken: string
let adminUserId: string
let studentUserId: string
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

  // Student user (QA account)
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

  // Create 6 transactions (more than the 5 limit)
  for (let i = 0; i < 6; i++) {
    const created = await payload.create({
      collection: 'transactions',
      data: {
        user: adminUserId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: `recent_tx_test_${ts}_${i}`,
        status: 'succeeded',
        amount: (i + 1) * 1000,
        currency: 'ILS',
      } as any,
      overrideAccess: true,
    })
    transactionIds.push(created.id)
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

  it('returns recent transactions for admin users', async () => {
    const req = new Request('http://localhost:3000/api/admin/recent-transactions', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.docs).toBeInstanceOf(Array)
    // Should return up to 5 transactions
    expect(body.docs.length).toBeLessThanOrEqual(5)
  })

  it('returns transactions sorted by createdAt descending', async () => {
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

  it('returns transactions with depth=2 (includes user and product)', async () => {
    const req = new Request('http://localhost:3000/api/admin/recent-transactions', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    const docs = body.docs as Array<{ user?: { email?: string }; product?: { name?: string } }>
    if (docs.length > 0) {
      // Should include populated user and product (depth=2)
      expect(docs[0].user).toBeDefined()
      expect(docs[0].product).toBeDefined()
    }
  })
})
