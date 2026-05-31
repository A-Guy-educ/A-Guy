// @vitest-environment node
/**
 * Integration tests: Transactions.access.create — Issue #2211
 *
 * Verifies that Transactions.access.create is set to () => false so that
 * manually creating a Transaction via the admin UI or REST API is blocked.
 * Webhook handlers and the checkout route use payload.create with
 * overrideAccess: true, so legitimate creation paths still work.
 */

import { AccountRole } from '@/server/payload/collections/Users/roles'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'

const hasDatabaseUrl = !!process.env.DATABASE_URL

// The Payload REST API handlers
const REST_GET = (await import('@payloadcms/next/routes')).REST_GET
const REST_POST = (await import('@payloadcms/next/routes')).REST_POST

let payload: Payload
let adminToken: string
let userId: string
let productId: string
let transactionId: string

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  // Start MongoDB container
  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const payloadConfig = await import('@payload-config')
  payload = await getPayload({ config: payloadConfig.default })

  // Create admin user
  const adminEmail = `create-access-test-${Date.now()}@test.local`
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: adminEmail,
      password: 'test-password-1234',
      name: 'Create Access Test Admin',
    } as any,
    overrideAccess: true,
  })
  userId = admin.id
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

  // Create a product for transaction creation
  const product = await payload.create({
    collection: 'products',
    data: {
      name: `Create Access Test Product ${Date.now()}`,
      slug: `create-access-test-product-${Date.now()}`,
      billingType: 'one_time',
      price: 1000,
      currency: 'ILS',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  productId = product.id
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
  if (userId) {
    try {
      await payload.delete({ collection: 'users', id: userId, overrideAccess: true })
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
  if (payload?.db?.destroy) {
    await payload.db.destroy()
  }
  await stopMongoContainer()
})

describe.skipIf(!hasDatabaseUrl)('Transactions.access.create', () => {
  it('blocks manual creation via REST API (no auth)', async () => {
    // This simulates what the admin UI does when clicking "Create New":
    // a POST to /api/transactions without a valid JWT
    const handler = REST_POST(config)

    const req = new Request('http://localhost:3000/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No Authorization header — unauthenticated
      },
      body: JSON.stringify({
        user: userId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: `no_auth_test_${Date.now()}`,
        status: 'pending',
        amount: 1000,
        currency: 'ILS',
      }),
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (await handler(req, {
      params: Promise.resolve({ slug: ['transactions'] }),
    })) as Response

    expect(res.status).toBe(403)
  })

  it('blocks manual creation via REST API even with admin JWT', async () => {
    // Even an admin JWT should be blocked — create: () => false means NOBODY can create manually
    const handler = REST_POST(config)

    const req = new Request('http://localhost:3000/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${adminToken}`,
      },
      body: JSON.stringify({
        user: userId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: `admin_auth_test_${Date.now()}`,
        status: 'pending',
        amount: 1000,
        currency: 'ILS',
      }),
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (await handler(req, {
      params: Promise.resolve({ slug: ['transactions'] }),
    })) as Response

    expect(res.status).toBe(403)
  })

  it('still allows creation with overrideAccess: true (checkout route / webhook pattern)', async () => {
    // This is the pattern used by checkout route and webhook handlers
    const tx = await payload.create({
      collection: 'transactions',
      data: {
        user: userId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: `override_access_test_${Date.now()}`,
        status: 'pending',
        amount: 1000,
        currency: 'ILS',
      } as any,
      overrideAccess: true,
    })
    transactionId = tx.id
    expect(tx.id).toBeDefined()
  })
})
