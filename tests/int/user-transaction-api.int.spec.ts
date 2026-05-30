// @vitest-environment node
/**
 * Integration tests: User Transaction API
 *
 * Tests GET /api/account/transactions/{id}:
 * 1. Returns 401 without auth
 * 2. Returns 404 for non-existent transaction
 * 3. Returns 404 when user tries to access another user's transaction
 * 4. Returns 200 with transaction when user accesses their own transaction
 *
 * @fileType integration-test
 * @domain billing
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
let user1Id: string
let user2Id: string
let user1Token: string
let user2Token: string
let transactionId: string
let productId: string

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
      name: `user-tx-test-${Date.now()}`,
      slug: `user-tx-test-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })
  tenantId = tenant.id

  // Create first user
  const user1Email = `user1-tx-${Date.now()}@test.local`
  const user1 = await payload.create({
    collection: 'users',
    data: {
      email: user1Email,
      password: 'test-password-1234',
      name: 'User One',
      role: AccountRole.Student,
    } as any,
    overrideAccess: true,
  })
  user1Id = user1.id

  const login1 = await payload.login({
    collection: 'users',
    data: { email: user1Email, password: 'test-password-1234' },
  })
  user1Token = login1.token!

  // Create second user
  const user2Email = `user2-tx-${Date.now()}@test.local`
  const user2 = await payload.create({
    collection: 'users',
    data: {
      email: user2Email,
      password: 'test-password-1234',
      name: 'User Two',
      role: AccountRole.Student,
    } as any,
    overrideAccess: true,
  })
  user2Id = user2.id

  const login2 = await payload.login({
    collection: 'users',
    data: { email: user2Email, password: 'test-password-1234' },
  })
  user2Token = login2.token!

  // Create product
  const product = await payload.create({
    collection: 'products',
    data: {
      name: `User TX Test Product ${Date.now()}`,
      slug: `user-tx-test-product-${Date.now()}`,
      billingType: 'one_time',
      price: 1000,
      currency: 'ILS',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  productId = product.id

  // Create transaction belonging to user1
  const tx = await payload.create({
    collection: 'transactions',
    data: {
      user: user1Id,
      product: productId,
      provider: 'stripe',
      providerTransactionId: `cs_user_tx_test_${Date.now()}`,
      status: 'succeeded',
      amount: 1000,
      currency: 'ILS',
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  transactionId = tx.id
}, 300_000)

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

describe('GET /api/account/transactions/{id}', () => {
  it('returns 401 without auth', async () => {
    const handler = (await import('@/app/api/account/transactions/[id]/route')).GET

    const req = new NextRequest(`http://localhost:3000/api/account/transactions/${transactionId}`, {
      method: 'GET',
    })

    const response = await handler(req, { params: Promise.resolve({ id: transactionId }) })
    expect(response.status).toBe(401)
  })

  it('returns 404 for non-existent transaction', async () => {
    const handler = (await import('@/app/api/account/transactions/[id]/route')).GET

    const fakeId = '000000000000000000000000'
    const req = new NextRequest(`http://localhost:3000/api/account/transactions/${fakeId}`, {
      method: 'GET',
      headers: {
        Authorization: `JWT ${user1Token}`,
        Cookie: `payload-token=${user1Token}`,
      },
    })

    const response = await handler(req, { params: Promise.resolve({ id: fakeId }) })
    expect(response.status).toBe(404)
  })

  it("returns 404 when user tries to access another user's transaction", async () => {
    const handler = (await import('@/app/api/account/transactions/[id]/route')).GET

    // user2 tries to access user1's transaction
    const req = new NextRequest(`http://localhost:3000/api/account/transactions/${transactionId}`, {
      method: 'GET',
      headers: {
        Authorization: `JWT ${user2Token}`,
        Cookie: `payload-token=${user2Token}`,
      },
    })

    const response = await handler(req, { params: Promise.resolve({ id: transactionId }) })
    // Should return 404 to avoid leaking information about other users' transactions
    expect(response.status).toBe(404)
  })

  it('returns 200 with transaction when user accesses their own transaction', async () => {
    const handler = (await import('@/app/api/account/transactions/[id]/route')).GET

    // user1 accesses their own transaction
    const req = new NextRequest(`http://localhost:3000/api/account/transactions/${transactionId}`, {
      method: 'GET',
      headers: {
        Authorization: `JWT ${user1Token}`,
        Cookie: `payload-token=${user1Token}`,
      },
    })

    const response = await handler(req, { params: Promise.resolve({ id: transactionId }) })
    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json.transaction).toBeDefined()
    expect(json.transaction.id).toBe(transactionId)
    expect(json.transaction.status).toBe('succeeded')
    expect(json.transaction.amount).toBe(1000)
    expect(json.transaction.currency).toBe('ILS')
  })
})
