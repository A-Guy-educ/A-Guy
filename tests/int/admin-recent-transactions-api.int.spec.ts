// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing.

/**
 * Integration tests: Recent Transactions API
 *
 * Tests the GET /api/collections/transactions endpoint:
 * 1. Returns 401 without auth
 * 2. Returns 403 for non-admin users
 * 3. Returns 200 for admin users with transactions list
 * 4. Returns { docs: [] } shape with correct transaction fields
 *
 * @fileType integration-test
 * @domain payments
 * @pattern admin-dashboard, transactions-list
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { GET } from '@/app/api/collections/transactions/route'
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

const ts = Date.now()

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  const adminEmail = `admin-recent-tx-${ts}@test.local`
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: adminEmail,
      password: 'test-password-1234',
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

  const studentEmail = `student-recent-tx-${ts}@test.local`
  const student = await payload.create({
    collection: 'users',
    data: {
      email: studentEmail,
      password: 'test-password-1234',
      name: 'Recent Tx Student',
      role: AccountRole.Student,
    } as any,
    overrideAccess: true,
  })
  studentUserId = student.id

  const product = await payload.create({
    collection: 'products',
    data: { name: 'Test Product', slug: `test-product-${ts}` } as any,
    overrideAccess: true,
  })
  productId = product.id

  await payload.create({
    collection: 'transactions',
    data: {
      user: adminUserId,
      product: productId,
      provider: 'stripe',
      providerTransactionId: `test-stripe-${ts}`,
      status: 'succeeded',
      amount: 9900,
      currency: 'ILS',
    } as any,
    overrideAccess: true,
  })

  const adminLogin = await payload.login({
    collection: 'users',
    data: { email: adminEmail, password: 'test-password-1234' },
  })
  adminToken = adminLogin.token!

  const studentLogin = await payload.login({
    collection: 'users',
    data: { email: studentEmail, password: 'test-password-1234' },
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
}, 60_000)

describe.skipIf(!hasDatabaseUrl)('GET /api/collections/transactions', () => {
  it('returns 401 without auth', async () => {
    const req = new Request('http://localhost:3000/api/collections/transactions?limit=5')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const req = new Request('http://localhost:3000/api/collections/transactions?limit=5', {
      headers: { Authorization: `JWT ${studentToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('returns 200 for admin users with docs array', async () => {
    const req = new Request(
      'http://localhost:3000/api/collections/transactions?limit=5&sort=-createdAt&depth=2',
      { headers: { Authorization: `JWT ${adminToken}` } },
    )
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('docs')
    expect(Array.isArray(body.docs)).toBe(true)
  })

  it('returns transaction docs with required fields', async () => {
    const req = new Request(
      'http://localhost:3000/api/collections/transactions?limit=5&sort=-createdAt&depth=2',
      { headers: { Authorization: `JWT ${adminToken}` } },
    )
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.docs.length).toBeGreaterThan(0)

    const tx = body.docs[0]
    expect(tx).toHaveProperty('id')
    expect(tx).toHaveProperty('createdAt')
    expect(tx).toHaveProperty('amount')
    expect(tx).toHaveProperty('currency')
    expect(tx).toHaveProperty('status')
    expect(['pending', 'succeeded', 'failed', 'refunded']).toContain(tx.status)
  })

  it('respects limit parameter', async () => {
    const req = new Request(
      'http://localhost:3000/api/collections/transactions?limit=1&sort=-createdAt',
      { headers: { Authorization: `JWT ${adminToken}` } },
    )
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.docs.length).toBeLessThanOrEqual(1)
  })
})
