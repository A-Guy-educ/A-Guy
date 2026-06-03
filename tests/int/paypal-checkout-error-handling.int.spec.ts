// @vitest-environment node
/**
 * Integration tests: PayPal Checkout Error Handling
 *
 * Tests that the checkout endpoint returns a proper 503 error with
 * payment_provider_not_configured when PayPal credentials are missing,
 * instead of a generic 500 with checkout_creation_failed.
 *
 * @fileType integration-test
 * @domain payments
 * @ai-summary Tests PayPal credential error handling in checkout endpoint
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { startMongoContainer } from '@/infra/utils/test/mongodb-container'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import { resetPaymentEnvCache } from '@/lib/payment/env'

// Mock only Stripe (we're testing PayPal error handling)
// DO NOT mock @/lib/payment/paypal — we need getPaymentEnv() to throw
vi.mock('@/lib/payment/stripe', () => ({
  createStripeCheckout: vi.fn(async () => ({
    checkoutUrl: 'https://stripe.example.com/checkout/test-session',
    providerSessionId: 'stripe_test_session_123',
  })),
  cancelStripeCheckout: vi.fn(async () => ({})),
}))

let payload: Payload
let originalDatabaseUrl: string | undefined

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

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Create a tenant
  const tenant = await payload.create({
    collection: 'tenants',
    data: {
      name: `paypal-error-test-tenant-${Date.now()}`,
      slug: `paypal-error-test-tenant-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })

  // Create student user
  const email = `student-paypalerror-${Date.now()}@example.com`
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

  // Create a product with PayPal as the provider
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
      provider: 'paypal',
    } as any,
    overrideAccess: true,
  })
  productId = product.id
  createdProductIds.push(product.id)
})

afterAll(async () => {
  for (const userId of createdUserIds) {
    if (userId) {
      try {
        await payload.delete({ collection: 'users', id: userId, overrideAccess: true })
      } catch {
        // ignore
      }
    }
  }

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
// Helper
// ---------------------------------------------------------------------------

async function callCheckout(
  userEmail: string,
  pId: string,
  provider: 'stripe' | 'paypal' = 'stripe',
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
    body: JSON.stringify({ productId: pId, provider }),
  })

  const response = await POST(mockRequest)
  const data = await response.json()

  return { status: response.status, data }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!process.env.DATABASE_URL)('PayPal checkout error handling', () => {
  /**
   * When PayPal credentials are missing, the checkout endpoint should return
   * 503 with error 'payment_provider_not_configured' — NOT 500 with 'checkout_creation_failed'.
   *
   * This test simulates the missing-credentials scenario by:
   * 1. Resetting the payment env cache so the next call re-reads env vars
   * 2. Saving original PAYPAL env vars, then deleting them
   * 3. Calling checkout with provider='paypal'
   * 4. Restoring env vars and resetting cache for other tests
   */
  it('should return 503 payment_provider_not_configured when PayPal credentials are missing', async () => {
    // Save original values and clear PayPal credentials
    const savedPaypalClientId = process.env.PAYPAL_CLIENT_ID
    const savedPaypalClientSecret = process.env.PAYPAL_CLIENT_SECRET
    const savedPaypalWebhookId = process.env.PAYPAL_WEBHOOK_ID

    delete process.env.PAYPAL_CLIENT_ID
    delete process.env.PAYPAL_CLIENT_SECRET
    delete process.env.PAYPAL_WEBHOOK_ID

    // Reset the env cache so the next getPaymentEnv() call re-reads the cleared vars
    resetPaymentEnvCache()

    try {
      const result = await callCheckout(studentUserEmail, productId, 'paypal')

      // Should be 503 Service Unavailable (provider not configured), not 500
      expect(result.status).toBe(503)
      expect(result.data.success).toBe(false)
      expect(result.data.error).toBe('payment_provider_not_configured')
    } finally {
      // Restore env vars and reset cache
      if (savedPaypalClientId !== undefined) process.env.PAYPAL_CLIENT_ID = savedPaypalClientId
      if (savedPaypalClientSecret !== undefined)
        process.env.PAYPAL_CLIENT_SECRET = savedPaypalClientSecret
      if (savedPaypalWebhookId !== undefined) process.env.PAYPAL_WEBHOOK_ID = savedPaypalWebhookId
      resetPaymentEnvCache()
    }
  })
})
