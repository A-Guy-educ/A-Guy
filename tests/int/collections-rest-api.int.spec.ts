// @vitest-environment node
/**
 * Integration tests: Collections REST API
 *
 * Tests that the Payload collections REST API endpoints are accessible.
 * Specifically verifies that GET /api/collections/transactions works.
 *
 * @fileType integration-test
 * @domain payments
 * @pattern collections-rest-api
 */

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { AccountRole } from '@/server/payload/collections/Users/roles'

let payload: Payload
let originalDatabaseUrl: string | undefined

// Test fixture IDs
let tenantId: string
let adminUserId: string
let productId: string
let transactionId: string
let adminToken: string

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Create tenant
  const tenant = await payload.create({
    collection: 'tenants',
    data: {
      name: `collections-rest-test-${Date.now()}`,
      slug: `collections-rest-test-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })
  tenantId = tenant.id

  // Create admin user
  const adminEmail = `collections-rest-admin-${Date.now()}@test.local`
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: adminEmail,
      password: 'test-password-1234',
      name: 'Collections REST Admin',
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

  // Create product
  const product = await payload.create({
    collection: 'products',
    data: {
      name: `Collections REST Test Product ${Date.now()}`,
      slug: `collections-rest-test-product-${Date.now()}`,
      billingType: 'one_time',
      price: 1000,
      currency: 'ILS',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  productId = product.id

  // Create transaction
  const tx = await payload.create({
    collection: 'transactions',
    data: {
      user: adminUserId,
      product: productId,
      provider: 'stripe',
      providerTransactionId: `cs_collections_rest_test_${Date.now()}`,
      status: 'succeeded',
      amount: 1000,
      currency: 'ILS',
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  transactionId = tx.id

  // Get admin token
  const adminLogin = await payload.login({
    collection: 'users',
    data: { email: adminEmail, password: 'test-password-1234' },
  })
  adminToken = adminLogin.token!
}, 120_000)

afterAll(async () => {
  if (payload?.db?.destroy) await payload.db.destroy()
  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error: TypeScript doesn't allow delete on process.env
    delete process.env.DATABASE_URL
  }
}, 120_000)

describe('Collections REST API — GET /api/transactions', () => {
  it('returns 200 with transaction docs via the collections REST API', async () => {
    // Dynamically import the collections REST API route handler
    const collectionsRoute = await import('@/app/(payload)/api/[...slug]/route')
    const collectionsGetHandler = collectionsRoute.GET

    const url = new URL('http://localhost:3000/api/transactions')
    url.searchParams.set('limit', '5')
    url.searchParams.set('sort', '-createdAt')
    url.searchParams.set('depth', '2')

    const req = new NextRequest(url, {
      method: 'GET',
      headers: {
        Authorization: `JWT ${adminToken}`,
      },
    })

    // The Payload REST API endpoint for transactions is /api/transactions (not /api/collections/transactions)
    const res = await collectionsGetHandler(req as unknown as Request, {
      params: Promise.resolve({ slug: ['transactions'] }),
    })

    const bodyText = await res.text()
    expect(res.status, `Expected 200 but got ${res.status}. Body: ${bodyText.slice(0, 200)}`).toBe(
      200,
    )

    const json = JSON.parse(bodyText)
    expect(json.docs).toBeDefined()
    expect(Array.isArray(json.docs)).toBe(true)
    expect(json.docs.length).toBeGreaterThan(0)
  })
})
