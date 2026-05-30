// @vitest-environment node
/**
 * Integration tests: Admin Transactions REST API — Issue #1792
 *
 * Verifies that GET /api/transactions returns 200 with admin auth (not 404).
 *
 * Bug: RecentTransactionsWidget fetches /api/collections/transactions (404).
 * Fix: Payload REST API is at /api/{slug}, not /api/collections/{slug}.
 *
 * This test imports the Payload REST API catch-all handler and calls it
 * directly with a mock Request, following the same pattern as
 * tests/int/admin-dashboard-metrics.int.spec.ts.
 */

// The Payload REST API catch-all route
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REST_GET = (await import('@payloadcms/next/routes')).REST_GET
import { AccountRole } from '@/server/payload/collections/Users/roles'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'

const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let adminToken: string
let transactionId: string

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  // Start MongoDB container
  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const payloadConfig = await import('@payload-config')
  payload = await getPayload({ config: payloadConfig.default })

  // Create admin user
  const adminEmail = `rest-admin-${Date.now()}@test.local`
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: adminEmail,
      password: 'test-password-1234',
      name: 'REST Admin',
    } as any,
    overrideAccess: true,
  })
  await payload.update({
    collection: 'users',
    id: admin.id,
    data: { role: AccountRole.Admin } as any,
    overrideAccess: true,
  })

  const adminLogin = await payload.login({
    collection: 'users',
    data: { email: adminEmail, password: 'test-password-1234' },
  })
  adminToken = adminLogin.token!

  // Create a transaction
  const product = await payload.create({
    collection: 'products',
    data: {
      name: `REST Test Product ${Date.now()}`,
      slug: `rest-test-product-${Date.now()}`,
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
      user: admin.id,
      product: product.id,
      provider: 'stripe',
      providerTransactionId: `rest_test_${Date.now()}`,
      status: 'succeeded',
      amount: 1000,
      currency: 'ILS',
    } as any,
    overrideAccess: true,
  })
  transactionId = tx.id
}, 300_000)

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return
  if (transactionId) {
    try {
      await payload.delete({ collection: 'transactions', id: transactionId, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
  if (payload?.db?.destroy) {
    await payload.db.destroy()
  }
  await stopMongoContainer()
})

describe.skipIf(!hasDatabaseUrl)('GET /api/transactions — REST API endpoint', () => {
  it('returns 200 with admin auth (not 404)', async () => {
    // Call the Payload REST API handler directly, following the same pattern as
    // tests/int/admin-dashboard-metrics.int.spec.ts
    const handler = REST_GET(config)

    const req = new Request('http://localhost:3000/api/transactions?limit=5&depth=2', {
      method: 'GET',
      headers: {
        Authorization: `JWT ${adminToken}`,
        'Content-Type': 'application/json',
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (await handler(req, {
      params: Promise.resolve({ slug: ['transactions'] }),
    })) as Response

    // Bug: before fix, this returns 404 because /api/collections/transactions doesn't exist
    // After fix (changing widget URL), this should return 200
    expect(res.status).toBe(200)
  })

  it('returns 401 without auth', async () => {
    const handler = REST_GET(config)

    const req = new Request('http://localhost:3000/api/transactions?limit=5', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (await handler(req, {
      params: Promise.resolve({ slug: ['transactions'] }),
    })) as Response

    // Payload CMS returns 403 for any access denied (unauthenticated or unauthorized),
    // not 401 — it does not distinguish between anonymous and authenticated-but-unauthorized
    expect(res.status).toBe(403)
  })

  it('returns 403 for non-admin users', async () => {
    // Create a non-admin user
    const studentEmail = `rest-student-${Date.now()}@test.local`
    const student = await payload.create({
      collection: 'users',
      data: {
        email: studentEmail,
        password: 'test-password-1234',
        name: 'REST Student',
        role: AccountRole.Student,
      } as any,
      overrideAccess: true,
    })

    const studentLogin = await payload.login({
      collection: 'users',
      data: { email: studentEmail, password: 'test-password-1234' },
    })

    const handler = REST_GET(config)

    const req = new Request('http://localhost:3000/api/transactions?limit=5', {
      method: 'GET',
      headers: {
        Authorization: `JWT ${studentLogin.token}`,
        'Content-Type': 'application/json',
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (await handler(req, {
      params: Promise.resolve({ slug: ['transactions'] }),
    })) as Response

    expect(res.status).toBe(403)

    // Cleanup
    await payload.delete({ collection: 'users', id: student.id, overrideAccess: true })
  })
})
