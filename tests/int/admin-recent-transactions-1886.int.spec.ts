// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing.

/**
 * Integration tests: Admin Recent Transactions API — #1886
 *
 * Verifies that GET /api/admin/recent-transactions:
 * 1. Returns 401 without authentication
 * 2. Returns 403 for non-admin users
 * 3. Returns recent transactions for admin users
 * 4. Respects the limit parameter
 *
 * This guards against the bug where the Payload REST API at
 * /api/collections/transactions returns HTTP 404 for non-admin users
 * (security: don't reveal resource existence), which the widget
 * cannot handle properly.
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
let tenantId: string
let productId: string

const ts = Date.now()

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  // Create tenant
  const tenant = await payload.create({
    collection: 'tenants',
    data: { name: `recent-tx-test-${ts}`, slug: `recent-tx-test-${ts}` } as any,
    overrideAccess: true,
  })
  tenantId = tenant.id

  // Create product
  const product = await payload.create({
    collection: 'products',
    data: {
      name: `Recent TX Test Product ${ts}`,
      slug: `recent-tx-test-${ts}`,
      billingType: 'one_time',
      price: 1000,
      currency: 'ILS',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  productId = product.id

  const adminEmail = `admin-recent-tx-${ts}@test.local`
  const studentEmail = `student-recent-tx-${ts}@test.local`
  const password = 'test-password-1234'

  // Admin user
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: adminEmail,
      password,
      name: 'Recent TX Admin',
    } as any,
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
      name: 'Recent TX Student',
      role: AccountRole.Student,
    } as any,
    overrideAccess: true,
  })
  studentUserId = student.id

  // Create some transactions
  for (let i = 0; i < 3; i++) {
    await payload.create({
      collection: 'transactions',
      data: {
        user: adminUserId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: `cs_recent_tx_${ts}_${i}`,
        status: 'succeeded',
        amount: 1000 + i * 100,
        currency: 'ILS',
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })
  }

  // Get tokens
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
  try {
    await payload.delete({ collection: 'products', id: productId, overrideAccess: true })
  } catch {
    /* already deleted */
  }
  try {
    await payload.delete({ collection: 'tenants', id: tenantId, overrideAccess: true })
  } catch {
    /* already deleted */
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

  it('returns recent transactions for admin users', async () => {
    const req = new Request('http://localhost:3000/api/admin/recent-transactions?limit=5', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.docs).toBeInstanceOf(Array)
    expect(body.docs.length).toBeGreaterThan(0)

    // Check transaction shape
    const tx = body.docs[0]
    expect(tx).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        createdAt: expect.any(String),
        amount: expect.any(Number),
        currency: expect.any(String),
        status: expect.stringMatching(/^(pending|succeeded|failed|refunded)$/),
      }),
    )
  })

  it('respects the limit parameter', async () => {
    const req = new Request('http://localhost:3000/api/admin/recent-transactions?limit=2', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.docs.length).toBeLessThanOrEqual(2)
  })
})
