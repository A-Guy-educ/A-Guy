// @vitest-environment node
/**
 * Integration tests: Error logging in payment routes
 *
 * Verifies that payment provider errors are logged with pino-compatible { err, ... }
 * and that Stripe-specific (code, type, raw) and PayPal-specific (statusCode)
 * fields are extracted for production diagnostics.
 *
 * @fileType integration-test
 * @domain payments
 * @pattern error-logging
 * @ai-summary Tests that payment errors are logged with pino-serializable error details
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { AccountRole } from '@/server/payload/collections/Users/roles'

// ---------------------------------------------------------------------------
// Mock payment services
// ---------------------------------------------------------------------------

const stripeError = new Error('Stripe card declined') as any
stripeError.type = 'StripeCardError'
stripeError.code = 'card_declined'
stripeError.raw = { message: 'Your card was declined', type: 'card_error' }

const paypalError = new Error('PayPal network timeout') as any
paypalError.statusCode = 503
paypalError.statusText = 'Service Unavailable'

// Mutable mock refs so each test can re-configure
vi.mock('@/lib/payment/stripe', () => ({
  createStripeCheckout: vi.fn(),
  cancelStripeCheckout: vi.fn(),
}))

vi.mock('@/lib/payment/paypal', () => ({
  createPayPalOrder: vi.fn(),
  cancelPayPalOrder: vi.fn(),
}))

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let payload: Payload
let originalDatabaseUrl: string | undefined
let productId: string
let studentUserEmail: string

// Spy on the real payload logger to capture error calls
let realLoggerErrorSpy: ReturnType<typeof vi.spyOn>

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Spy on the real logger so we can verify log calls
  realLoggerErrorSpy = vi.spyOn(payload.logger, 'error').mockImplementation(vi.fn() as any)

  // Create a tenant
  const tenant = await payload.create({
    collection: 'tenants',
    data: { name: `error-log-test-${Date.now()}`, slug: `error-log-test-${Date.now()}` } as any,
    overrideAccess: true,
  })

  // Create student user
  studentUserEmail = `error-log-test-${Date.now()}@example.com`
  await payload.create({
    collection: 'users',
    data: {
      email: studentUserEmail,
      password: 'test123456',
      role: AccountRole.Student,
      tenant: tenant.id,
    } as any,
    overrideAccess: true,
  })

  // Create product
  const product = await payload.create({
    collection: 'products',
    data: {
      name: `Error Log Test Product ${Date.now()}`,
      slug: `error-log-product-${Date.now()}`,
      billingType: 'one_time',
      price: 100,
      currency: 'ILS',
      isActive: true,
      tenant: tenant.id,
    } as any,
    overrideAccess: true,
  })
  productId = product.id
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
})

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function callCheckout(provider: 'stripe' | 'paypal'): Promise<Response> {
  const { POST } = await import('@/app/api/payments/checkout/route')

  const loginResult = await payload.login({
    collection: 'users',
    data: { email: studentUserEmail, password: 'test123456' },
  })

  const req = new NextRequest('http://localhost:3000/api/payments/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginResult.token}`,
    },
    body: JSON.stringify({ productId, provider }),
  })

  return POST(req)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(async () => {
  realLoggerErrorSpy.mockClear()
  // Reset and re-import mocks so each test starts with a clean state
  const { createStripeCheckout } = await import('@/lib/payment/stripe')
  const { createPayPalOrder } = await import('@/lib/payment/paypal')
  vi.mocked(createStripeCheckout).mockReset()
  vi.mocked(createPayPalOrder).mockReset()
})

describe.skipIf(!process.env.DATABASE_URL)('Checkout error logging', () => {
  it('Stripe checkout error is logged with pino-compatible { err, ... } and extracted fields', async () => {
    const { createStripeCheckout } = await import('@/lib/payment/stripe')
    const { createPayPalOrder } = await import('@/lib/payment/paypal')

    vi.mocked(createStripeCheckout).mockRejectedValue(stripeError)
    vi.mocked(createPayPalOrder).mockResolvedValue({
      checkoutUrl: 'https://paypal.ok',
      providerSessionId: 'PP_OK',
    })

    const res = await callCheckout('stripe')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('checkout_creation_failed')

    // Verify logger.error was called with pino-compatible structure
    expect(realLoggerErrorSpy).toHaveBeenCalledTimes(1)
    const [logObj] = realLoggerErrorSpy.mock.calls[0] as any

    // Pino error serializer activates on 'err' key
    expect(logObj.err).toBeDefined()
    expect(logObj.err).toBeInstanceOf(Error)
    expect(logObj.err.message).toBe('Stripe card declined')

    // Extracted fields for human-readable logs without pino internals
    expect(logObj.errorMessage).toBe('Stripe card declined')
    expect(logObj.errorStack).toBeDefined()
    expect(typeof logObj.errorStack).toBe('string')

    // Stripe-specific fields
    expect(logObj.errorCode).toBe('card_declined')
    expect(logObj.errorType).toBe('StripeCardError')
    expect(logObj.errorRaw).toBeDefined()
  })

  it('PayPal checkout error is logged with pino-compatible { err, ... } and extracted fields', async () => {
    const { createStripeCheckout } = await import('@/lib/payment/stripe')
    const { createPayPalOrder } = await import('@/lib/payment/paypal')

    vi.mocked(createPayPalOrder).mockRejectedValue(paypalError)
    vi.mocked(createStripeCheckout).mockResolvedValue({
      checkoutUrl: 'https://stripe.ok',
      providerSessionId: 'cs_OK',
    })

    const res = await callCheckout('paypal')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('checkout_creation_failed')

    expect(realLoggerErrorSpy).toHaveBeenCalledTimes(1)
    const [logObj] = realLoggerErrorSpy.mock.calls[0] as any

    expect(logObj.err).toBeDefined()
    expect(logObj.err).toBeInstanceOf(Error)
    expect(logObj.errorMessage).toBe('PayPal network timeout')
    expect(logObj.errorStack).toBeDefined()

    // PayPal-specific field
    expect(logObj.errorStatusCode).toBe(503)
  })
})
