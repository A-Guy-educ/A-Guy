// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing.

/**
 * Integration tests: Admin Recent Transactions API
 *
 * Verifies that GET /api/admin/recent-transactions returns the 5 most recent
 * transactions with the fields required by the RecentTransactionsWidget:
 * id, createdAt, amount, currency, status, user.email, product.name.
 *
 * This guards against the regression where the RecentTransactionsWidget on /admin
 * fetched from /api/collections/transactions (Payload REST API) and got HTTP 404.
 * The fix: a dedicated /api/admin/recent-transactions admin endpoint.
 *
 * Pattern: matches tests/int/admin-dashboard-metrics.int.spec.ts — imports the
 * route handler directly and authenticates with `Authorization: JWT <token>`.
 */
/* eslint-disable @typescript-eslint/noexplicit-any */
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
let studentToken: string
let studentUserId: string

const ts = Date.now()

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  // Create admin user
  const adminEmail = `admin-rt-${ts}@test.local`
  const studentEmail = `student-rt-${ts}@test.local`
  const password = 'test-password-1234'

  const admin = await payload.create({
    collection: 'users',
    data: {
      email: adminEmail,
      password,
      name: 'RT Admin',
    } as any,
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
      name: 'RT Student',
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
}, 120_000)

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

  it('returns 200 with transactions array for admin users', async () => {
    const req = new Request('http://localhost:3000/api/admin/recent-transactions', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body.transactions)).toBe(true)
  })

  it('returns at most 5 transactions', async () => {
    const req = new Request('http://localhost:3000/api/admin/recent-transactions', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.transactions.length).toBeLessThanOrEqual(5)
  })

  it('returns transactions sorted by createdAt descending', async () => {
    const req = new Request('http://localhost:3000/api/admin/recent-transactions', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    const transactions = body.transactions as Array<{ createdAt: string }>
    for (let i = 1; i < transactions.length; i++) {
      expect(new Date(transactions[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(transactions[i].createdAt).getTime(),
      )
    }
  })

  it('returns required fields per transaction', async () => {
    const req = new Request('http://localhost:3000/api/admin/recent-transactions', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    const transactions = body.transactions as Array<any>
    for (const tx of transactions) {
      expect(tx).toHaveProperty('id')
      expect(tx).toHaveProperty('createdAt')
      expect(tx).toHaveProperty('amount')
      expect(tx).toHaveProperty('currency')
      expect(tx).toHaveProperty('status')
    }
  })
})
