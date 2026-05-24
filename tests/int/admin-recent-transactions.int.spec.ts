// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing.

/**
 * Integration tests: Admin Recent Transactions API
 *
 * Tests the GET /api/admin/transactions/recent endpoint:
 * 1. Returns 401 without auth
 * 2. Returns 403 for non-admin users
 * 3. Returns recent transactions for admin users
 * 4. Respects limit query parameter
 *
 * This endpoint is used by the RecentTransactionsWidget on the admin dashboard.
 * The widget previously called /api/collections/transactions directly, which
 * returned HTTP 404 due to authentication issues with client-side fetches
 * to Payload's REST API from admin dashboard widgets.
 *
 * @fileType integration-test
 * @domain payments
 * @pattern recent-transactions, admin-api
 */

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AccountRole } from '@/server/payload/collections/Users/roles'
import config from '@payload-config'
import type { RecentTransactionsResponse } from '@/app/api/admin/transactions/recent/route'

const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let adminToken: string
let adminUserId: string
let studentUserId: string
let studentToken: string

const ts = Date.now()

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  const adminEmail = `admin-recent-tx-${ts}@test.local`
  const studentEmail = `student-recent-tx-${ts}@test.local`
  const password = 'test-password-1234'

  // Create admin user
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: adminEmail,
      password,
      name: 'Recent Tx Admin',
    } as any,
  })
  await payload.update({
    collection: 'users',
    id: admin.id,
    data: { role: AccountRole.Admin } as any,
    overrideAccess: true,
  })
  adminUserId = admin.id

  // Create student user
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

describe.skipIf(!hasDatabaseUrl)('GET /api/admin/transactions/recent', () => {
  it('returns 401 without auth', async () => {
    const { GET } = await import('@/app/api/admin/transactions/recent/route')
    const req = new Request('http://localhost:3000/api/admin/transactions/recent')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const { GET } = await import('@/app/api/admin/transactions/recent/route')
    const req = new Request('http://localhost:3000/api/admin/transactions/recent', {
      headers: { Authorization: `JWT ${studentToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('returns recent transactions for admin users', async () => {
    const { GET } = await import('@/app/api/admin/transactions/recent/route')
    const req = new Request('http://localhost:3000/api/admin/transactions/recent', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = (await res.json()) as RecentTransactionsResponse
    expect(Array.isArray(body.docs)).toBe(true)
    // Should have at most 5 transactions by default
    expect(body.docs.length).toBeLessThanOrEqual(5)
  })

  it('respects limit query parameter', async () => {
    const { GET } = await import('@/app/api/admin/transactions/recent/route')
    const req = new Request('http://localhost:3000/api/admin/transactions/recent?limit=2', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = (await res.json()) as RecentTransactionsResponse
    expect(body.docs.length).toBeLessThanOrEqual(2)
  })
})
