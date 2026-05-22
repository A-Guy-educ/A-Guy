// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing.

/**
 * Integration tests: Admin Dashboard RecentTransactionsWidget — transactions API (#1797)
 *
 * Verifies that GET /api/collections/transactions returns data for admin users.
 * This guards against the widget permanently showing 'Loading...' when the
 * transactions API returns 404.
 *
 * Issue: Admin dashboard widgets fail to load — transactions API returns 404
 * URL: GET /api/collections/transactions?limit=5&sort=-createdAt&depth=2
 */

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
let transactionIds: string[] = []

const ts = Date.now()

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  const adminEmail = `admin-tx-${ts}@test.local`
  const studentEmail = `student-tx-${ts}@test.local`
  const password = 'test-password-1234'

  // Admin user
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

  // Student user
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
  studentUserId = student.id

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

  // Cleanup transactions
  for (const id of transactionIds) {
    try {
      await payload.delete({ collection: 'transactions', id, overrideAccess: true })
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

  // Cleanup
  if (payload?.db?.destroy) {
    await payload.db.destroy()
  }
}, 60_000)

describe.skipIf(!hasDatabaseUrl)('GET /api/collections/transactions', () => {
  it('returns 401 without auth', async () => {
    const req = new Request(
      'http://localhost:3000/api/collections/transactions?limit=5&sort=-createdAt&depth=2',
    )
    const res = await fetch(req.url, { method: 'GET' })
    // Without auth cookie, should return 401 or 403
    expect([401, 403]).toContain(res.status)
  })

  it('returns 403 for non-admin users', async () => {
    const req = new Request(
      'http://localhost:3000/api/collections/transactions?limit=5&sort=-createdAt&depth=2',
      {
        headers: { Authorization: `JWT ${studentToken}` },
      },
    )
    const res = await fetch(req.url, { method: 'GET' })
    expect(res.status).toBe(403)
  })

  it('returns 200 for admin users with transactions', async () => {
    // Create a test transaction first
    const product = await payload.create({
      collection: 'products',
      data: {
        name: `Test Product ${ts}`,
        slug: `test-product-${ts}`,
        billingType: 'one_time',
        price: 1000,
        currency: 'ILS',
        isActive: true,
      } as any,
      overrideAccess: true,
    })

    const tx = await payload.create({
      collection: 'transactions',
      data: {
        user: adminUserId,
        product: product.id,
        provider: 'stripe',
        providerTransactionId: `test_tx_${Date.now()}`,
        status: 'succeeded',
        amount: 1000,
        currency: 'ILS',
      } as any,
      overrideAccess: true,
    })
    transactionIds.push(tx.id)

    const req = new Request(
      'http://localhost:3000/api/collections/transactions?limit=5&sort=-createdAt&depth=2',
      {
        headers: { Authorization: `JWT ${adminToken}` },
      },
    )
    const res = await fetch(req.url, { method: 'GET' })

    // The issue says this returns 404 - it should return 200
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.docs).toBeDefined()
    expect(Array.isArray(json.docs)).toBe(true)
    expect(json.docs.length).toBeGreaterThan(0)

    // Cleanup
    await payload.delete({ collection: 'products', id: product.id, overrideAccess: true })
  })

  it('returns empty docs array when no transactions exist', async () => {
    const req = new Request(
      'http://localhost:3000/api/collections/transactions?limit=5&sort=-createdAt&depth=2',
      {
        headers: { Authorization: `JWT ${adminToken}` },
      },
    )
    const res = await fetch(req.url, { method: 'GET' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.docs).toBeDefined()
    expect(Array.isArray(json.docs)).toBe(true)
  })
})
