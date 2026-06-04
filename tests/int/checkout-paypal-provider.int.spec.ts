// @vitest-environment node
/**
 * Integration tests: Checkout with PayPal Provider
 *
 * Tests the PayPal-specific checkout path:
 * 1) PayPal checkout returns 200 with checkoutUrl for valid product
 * 2) PayPal checkout with invalid credentials returns 503 (not 500)
 * 3) PayPal order creation failure is properly logged and returns 500
 * 4) Super-admin is exempt from rate limiting for PayPal checkout
 *
 * @fileType integration-test
 * @domain payments
 * @pattern paypal-checkout
 * @ai-summary Tests PayPal-specific checkout endpoint behavior
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import { clearAllRateLimits } from '@/server/services/rate-limit'

// Mock payment providers
vi.mock('@/lib/payment/stripe', () => ({
  createStripeCheckout: vi.fn(async () => ({
    checkoutUrl: 'https://stripe.example.com/checkout/test-session',
    providerSessionId: 'stripe_test_session_123',
  })),
  cancelStripeCheckout: vi.fn(async () => ({})),
}))

vi.mock('@/lib/payment/paypal', () => ({
  createPayPalOrder: vi.fn(async () => ({
    checkoutUrl: 'https://paypal.example.com/checkout/test-order',
    providerSessionId: 'paypal_test_order_123',
  })),
  cancelPayPalOrder: vi.fn(async () => ({})),
}))

import * as stripeMock from '@/lib/payment/stripe'
import * as paypalMock from '@/lib/payment/paypal'

let payload: Payload
let originalDatabaseUrl: string | undefined

// Test fixture IDs
let studentUserId: string
let studentUserEmail: string
let productWithoutItemsId: string
let superAdminUserId: string
let superAdminUserEmail: string

const createdUserIds: string[] = []
const createdProductIds: string[] = []
const createdTransactionIds: string[] = []

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Create a tenant
  const tenant = await payload.create({
    collection: 'tenants',
    data: {
      name: `paypal-test-tenant-${Date.now()}`,
      slug: `paypal-test-tenant-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })

  // Create product WITHOUT items
  const productWithoutItems = await payload.create({
    collection: 'products',
    data: {
      name: `Product Without Items ${Date.now()}`,
      slug: `product-without-items-${Date.now()}`,
      billingType: 'one_time',
      price: 100,
      currency: 'ILS',
      isActive: true,
      tenant: tenant.id,
    } as any,
    overrideAccess: true,
  })
  productWithoutItemsId = productWithoutItems.id
  createdProductIds.push(productWithoutItems.id)

  // Create student user
  const studentEmail = `student-paypal-${Date.now()}@example.com`
  const studentUser = await payload.create({
    collection: 'users',
    data: {
      email: studentEmail,
      password: 'test123456',
      role: AccountRole.Student,
      tenant: tenant.id,
    } as any,
    overrideAccess: true,
  })
  studentUserId = studentUser.id
  studentUserEmail = studentEmail
  createdUserIds.push(studentUser.id)

  // Create super-admin user
  const superAdminEmail = `superadmin-paypal-${Date.now()}@example.com`
  const superAdminUser = await payload.create({
    collection: 'users',
    data: {
      email: superAdminEmail,
      password: 'test123456',
      tenant: tenant.id,
    } as any,
    overrideAccess: true,
  })
  await payload.update({
    collection: 'users',
    id: superAdminUser.id,
    data: { role: AccountRole.Admin } as any,
    overrideAccess: true,
  })
  superAdminUserId = superAdminUser.id
  superAdminUserEmail = superAdminEmail
  createdUserIds.push(superAdminUser.id)

  clearAllRateLimits()
}, 60_000)

afterEach(() => {
  vi.clearAllMocks()
  clearAllRateLimits()
  // Clean up transactions created during tests
  for (const id of createdTransactionIds) {
    try {
      payload.delete({ collection: 'transactions', id, overrideAccess: true }).catch(() => {})
    } catch {
      // ignore
    }
  }
  createdTransactionIds.length = 0
})

afterAll(async () => {
  // Clean up users
  for (const userId of [studentUserId, superAdminUserId]) {
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
// Helper: Call checkout endpoint with PayPal provider
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

  // Track transaction IDs for cleanup
  if (data?.transactionId) {
    createdTransactionIds.push(data.transactionId)
  }

  return { status: response.status, data }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!process.env.DATABASE_URL)('Checkout with PayPal Provider', () => {
  /**
   * Test 1: PayPal checkout succeeds for product without items.
   */
  it('should return 200 with checkoutUrl when checking out product via PayPal', async () => {
    const result = await callPayPalCheckout(studentUserEmail, productWithoutItemsId)
    expect(result.status).toBe(200)
    expect(result.data.success).toBe(true)
    expect(result.data.checkoutUrl).toContain('paypal.example.com')
    expect(result.data.transactionId).toBeDefined()

    // Verify PayPal was called (not Stripe)
    expect(paypalMock.createPayPalOrder).toHaveBeenCalled()
    expect(stripeMock.createStripeCheckout).not.toHaveBeenCalled()
  })

  /**
   * Test 3: When PayPal API throws an error, route returns 500 with checkout_creation_failed.
   * Previously the error message was swallowed and generic 'unknown_error' was returned.
   */
  it('should return 500 with checkout_creation_failed when PayPal API throws', async () => {
    // Make PayPal throw
    ;(paypalMock.createPayPalOrder as any).mockImplementationOnce(() => {
      throw new Error('PayPal token request failed: 401 {"error":"invalid_client"}')
    })

    const result = await callPayPalCheckout(studentUserEmail, productWithoutItemsId)

    expect(result.status).toBe(500)
    expect(result.data.success).toBe(false)
    expect(result.data.error).toBe('checkout_creation_failed')
  })

  /**
   * Test 4: When PayPal API rejects due to missing credentials, route returns 503.
   * The specific error message should be recognized and return 503 (not 500).
   */
  it('should return 503 when PayPal credentials are missing', async () => {
    // Make PayPal throw the specific error that getPaymentEnv throws for missing credentials
    ;(paypalMock.createPayPalOrder as any).mockImplementationOnce(() => {
      throw new Error('Missing required payment environment variables: PAYPAL_CLIENT_ID')
    })

    const result = await callPayPalCheckout(studentUserEmail, productWithoutItemsId)

    expect(result.status).toBe(503)
    expect(result.data.success).toBe(false)
    expect(result.data.error).toBe('payment_provider_not_configured')
  })

  /**
   * Test 5: Super-admin is exempt from rate limiting for PayPal checkout.
   */
  it('should allow super-admin to checkout without rate limiting', async () => {
    // Exhaust rate limit for student user first
    for (let i = 0; i < 10; i++) {
      await callPayPalCheckout(studentUserEmail, productWithoutItemsId)
    }

    // Super-admin should still be able to checkout
    const result = await callPayPalCheckout(superAdminUserEmail, productWithoutItemsId)
    expect(result.status).toBe(200)
    expect(result.data.success).toBe(true)
  })
})
