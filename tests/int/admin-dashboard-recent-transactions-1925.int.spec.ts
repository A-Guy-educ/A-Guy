// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing.

/**
 * Integration tests: Admin Dashboard Recent Transactions — fix #1925
 *
 * Verifies that GET /api/admin/dashboard-metrics returns recentTransactions
 * (the 5 most recent transactions with depth=2) so that the
 * RecentTransactionsWidget can consume them via useMetricsContext instead
 * of making a separate client-side fetch to a non-existent endpoint.
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

  const adminEmail = `recent-tx-admin-${ts}@test.local`
  const studentEmail = `recent-tx-student-${ts}@test.local`
  const password = 'test-password-1234'

  const admin = await payload.create({
    collection: 'users',
    data: { email: adminEmail, password, name: 'Recent Tx Admin' } as any,
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

  const product = await payload.create({
    collection: 'products',
    data: {
      name: `Recent Tx Product ${ts}`,
      slug: `recent-tx-product-${ts}`,
      billingType: 'one_time',
      price: 1000,
      currency: 'ILS',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  productId = product.id

  // Create 6 transactions (widget shows 5 most recent)
  for (let i = 0; i < 6; i++) {
    const created = await payload.create({
      collection: 'transactions',
      data: {
        user: adminUserId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: `rtx_test_${Date.now()}_${i}_${Math.random().toString(36).slice(2)}`,
        status: i % 2 === 0 ? 'succeeded' : 'pending',
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
  for (const id of [adminUserId]) {
    if (!id) continue
    try {
      await payload.delete({ collection: 'users', id, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
}, 60_000)

describe.skipIf(!hasDatabaseUrl)('GET /api/admin/dashboard-metrics recentTransactions', () => {
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

  it('returns recentTransactions array for admin users', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('recentTransactions')
    expect(Array.isArray(body.recentTransactions)).toBe(true)
  })

  it('recentTransactions contains at most 5 items', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.recentTransactions.length).toBeLessThanOrEqual(5)
  })

  it('recentTransactions are sorted by createdAt descending', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    const txList = body.recentTransactions as Array<{ createdAt: string }>
    for (let i = 0; i < txList.length - 1; i++) {
      expect(new Date(txList[i].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(txList[i + 1].createdAt).getTime(),
      )
    }
  })

  it('recentTransactions items have required fields for the widget', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    const txList = body.recentTransactions as Array<{
      id: string
      createdAt: string
      amount: number
      currency: string
      status: string
      user?: { email?: string }
      product?: { name?: string }
    }>

    expect(txList.length).toBeGreaterThan(0)
    for (const tx of txList) {
      expect(typeof tx.id).toBe('string')
      expect(typeof tx.createdAt).toBe('string')
      expect(typeof tx.amount).toBe('number')
      expect(typeof tx.currency).toBe('string')
      expect(['pending', 'succeeded', 'failed', 'refunded']).toContain(tx.status)
    }
  })
})
