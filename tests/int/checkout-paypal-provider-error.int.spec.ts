// @vitest-environment node
/**
 * Integration tests: Checkout PayPal Provider Error Handling
 *
 * Tests that when PayPal credentials are missing (getPaymentEnv throws),
 * the checkout endpoint returns 503 with 'payment_provider_not_configured'
 * instead of a generic 500 with 'checkout_creation_failed'.
 *
 * Bug: The route handler checks for the literal string
 * 'Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET environment variable'
 * but getPaymentEnv() throws
 * 'Missing required payment environment variables: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET'
 * These don't match, causing a 500 to be returned instead of 503.
 *
 * @fileType integration-test
 * @domain payments
 * @pattern error-handling
 * @ai-summary Tests that PayPal credential errors return 503 not 500
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { startMongoContainer } from '@/infra/utils/test/mongodb-container'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import { resetPaymentEnvCache } from '@/lib/payment/env'

let payload: Payload
let originalDatabaseUrl: string | undefined
let originalPaypalClientId: string | undefined
let originalPaypalClientSecret: string | undefined

// Test fixture IDs
let studentUserId: string
let studentUserEmail: string
let productId: string

const createdUserIds: string[] = []
const createdProductIds: string[] = []

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  // Store original PayPal env vars
  originalPaypalClientId = process.env.PAYPAL_CLIENT_ID
  originalPaypalClientSecret = process.env.PAYPAL_CLIENT_SECRET

  // Ensure PayPal credentials are set (so getPaymentEnv doesn't throw at import time)
  process.env.PAYPAL_CLIENT_ID = 'test_client_id'
  process.env.PAYPAL_CLIENT_SECRET = 'test_client_secret'

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Create a tenant (needed for product)
  const tenant = await payload.create({
    collection: 'tenants',
    data: {
      name: `paypal-error-tenant-${Date.now()}`,
      slug: `paypal-error-tenant-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })

  // Create student user
  const email = `student-paypal-error-${Date.now()}@example.com`
  const studentUser = await payload.create({
    collection: 'users',
    data: {
      email,
      password: 'test123456',
      role: AccountRole.Student,
      tenant: tenant.id,
    } as any,
    overrideAccess: true,
  })
  studentUserId = studentUser.id
  studentUserEmail = email
  createdUserIds.push(studentUser.id)

  // Create a product
  const product = await payload.create({
    collection: 'products',
    data: {
      name: `PayPal Error Test Product ${Date.now()}`,
      slug: `paypal-error-product-${Date.now()}`,
      billingType: 'one_time',
      price: 100,
      currency: 'ILS',
      isActive: true,
      tenant: tenant.id,
    } as any,
    overrideAccess: true,
  })
  productId = product.id
  createdProductIds.push(product.id)
}, 60_000)

afterAll(async () => {
  // Restore original env vars
  if (originalPaypalClientId !== undefined) {
    process.env.PAYPAL_CLIENT_ID = originalPaypalClientId
  }
  if (originalPaypalClientSecret !== undefined) {
    process.env.PAYPAL_CLIENT_SECRET = originalPaypalClientSecret
  }
  resetPaymentEnvCache()

  // Clean up users
  for (const userId of createdUserIds) {
    if (userId) {
      try {
        await payload.delete({ collection: 'users', id: userId, overrideAccess: true })
      } catch {
        // ignore
      }
    }
  }

  // Clean up products
  for (const pid of createdProductIds) {
    if (pid) {
      try {
        await payload.delete({ collection: 'products', id: pid, overrideAccess: true })
      } catch {
        // ignore
      }
    }
  }

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  }
  if (payload.db?.destroy) {
    await payload.db.destroy()
  }
})

// ---------------------------------------------------------------------------
// Helper: Call checkout endpoint with authenticated user and PayPal provider
// ---------------------------------------------------------------------------

async function callPayPalCheckout(
  userEmail: string,
  pId: string,
): Promise<{ status: number; data: any }> {
  const loginResult = await payload.login({
    collection: 'users',
    data: { email: userEmail, password: 'test123456' },
  })
  const token = loginResult.token

  const { POST } = await import('@/app/api/payments/checkout/route')

  const headers = new Headers()
  headers.set('Content-Type', 'application/json')
  headers.set('Authorization', `Bearer ${token}`)

  const mockRequest = new NextRequest('http://localhost:3000/api/payments/checkout', {
    method: 'POST',
    headers,
    body: JSON.stringify({ productId: pId, provider: 'paypal' }),
  })

  const response = await POST(mockRequest)
  const data = await response.json()

  return { status: response.status, data }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!process.env.DATABASE_URL)('Checkout PayPal Provider Error Handling', () => {
  /**
   * Bug repro: When PayPal credentials are missing and getPaymentEnv() throws,
   * the route handler should return 503 with 'payment_provider_not_configured'.
   *
   * The bug is that getPaymentEnv() throws
   * "Missing required payment environment variables: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET"
   * but the route handler checks for the exact string
   * "Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET environment variable"
   * which doesn't match, causing a 500 with 'checkout_creation_failed' instead.
   */
  it('should return 503 payment_provider_not_configured when PayPal credentials are missing', async () => {
    // Simulate missing PayPal credentials by clearing env vars and resetting the cache
    delete process.env.PAYPAL_CLIENT_ID
    delete process.env.PAYPAL_CLIENT_SECRET
    resetPaymentEnvCache()

    const result = await callPayPalCheckout(studentUserEmail, productId)

    // BUG: This currently returns 500 with 'checkout_creation_failed'
    // EXPECTED: 503 with 'payment_provider_not_configured'
    expect(result.status).toBe(503)
    expect(result.data.success).toBe(false)
    expect(result.data.error).toBe('payment_provider_not_configured')
  })
})
