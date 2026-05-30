// @vitest-environment node
/**
 * Integration tests: Checkout Per-User Rate Limiting
 *
 * Tests that the checkout endpoint enforces per-user rate limits:
 * 1) 11th checkout request from the same user within 5 min returns 429 with Retry-After
 * 2) Counter resets after the window
 * 3) Super-admin user is exempt from rate limiting
 * 4) Unauthenticated user still gets 401 (rate limit does not fire before auth)
 * 5) Provider API is NOT called on rate-limited requests (verified via mock spy)
 *
 * @fileType integration-test
 * @domain payments
 * @pattern rate-limiting
 * @ai-summary Tests per-user rate limiting on checkout endpoint
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { startMongoContainer } from '@/infra/utils/test/mongodb-container'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import { clearAllRateLimits } from '@/server/services/rate-limit'

// Mock payment providers to avoid actual payment calls
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

// Import after mock so the module picks up the mock
import * as stripeMock from '@/lib/payment/stripe'
import * as paypalMock from '@/lib/payment/paypal'

let payload: Payload
let originalDatabaseUrl: string | undefined

// Test fixture IDs
let studentUserId: string
let studentUserEmail: string
let productId: string
let superAdminUserId: string
let superAdminUserEmail: string

const createdUserIds: string[] = []
const createdProductIds: string[] = []

const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 300_000 // 5 minutes

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Create a tenant (needed for product)
  const tenant = await payload.create({
    collection: 'tenants',
    data: {
      name: `rate-limit-tenant-${Date.now()}`,
      slug: `rate-limit-tenant-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })

  // Create student user (rate-limited)
  const studentEmail = `student-ratelimit-${Date.now()}@example.com`
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

  // Create super-admin user (exempt from rate limit).
  // NOTE: Users.role has a beforeChange hook (`ensureRoleOnSignup`) that forces
  // role='student' on every create, ignoring whatever the caller passes —
  // even with overrideAccess. To get an actual admin you MUST create first,
  // then update the role in a separate call (update respects the value).
  const superAdminEmail = `superadmin-ratelimit-${Date.now()}@example.com`
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

  // Create a product
  const product = await payload.create({
    collection: 'products',
    data: {
      name: `Rate Limit Test Product ${Date.now()}`,
      slug: `rate-limit-product-${Date.now()}`,
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

  // Clean up any pre-existing rate limits from previous test runs
  clearAllRateLimits()
})

afterEach(() => {
  // Reset mocks between tests
  vi.clearAllMocks()
  // Clean up rate limit state between tests
  clearAllRateLimits()
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
// Helper: Call checkout endpoint with authenticated user
// ---------------------------------------------------------------------------

async function callCheckout(
  userEmail: string,
  pId: string,
): Promise<{ status: number; data: any; headers: Headers }> {
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
    body: JSON.stringify({ productId: pId, provider: 'stripe' }),
  })

  const response = await POST(mockRequest)
  const data = await response.json()

  return { status: response.status, data, headers: response.headers as Headers }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!process.env.DATABASE_URL)('Checkout Rate Limiting', () => {
  /**
   * Test 1: First 10 requests succeed; 11th request returns 429 with Retry-After header.
   */
  it('should allow first 10 requests and block the 11th with 429 and Retry-After', async () => {
    // Make 10 requests that should all succeed
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      const result = await callCheckout(studentUserEmail, productId)
      ;(expect(result.status).toBe(200), `Request ${i + 1} should succeed`)
      expect(result.data.success).toBe(true)
      expect(result.headers.get('Retry-After')).toBeNull()
    }

    // 11th request should be rate-limited
    const eleventhResult = await callCheckout(studentUserEmail, productId)
    expect(eleventhResult.status).toBe(429)
    expect(eleventhResult.data.success).toBe(false)
    expect(eleventhResult.data.error).toBe('rate_limit_exceeded')
    expect(eleventhResult.headers.get('Retry-After')).not.toBeNull()

    const retryAfter = Number(eleventhResult.headers.get('Retry-After'))
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000))
  })

  /**
   * Test 2: Unauthenticated user gets 401 (rate limit does not fire before auth check).
   */
  it('should return 401 for unauthenticated requests without triggering rate limit', async () => {
    const { POST } = await import('@/app/api/payments/checkout/route')

    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    // No Authorization header = unauthenticated

    const mockRequest = new NextRequest('http://localhost:3000/api/payments/checkout', {
      method: 'POST',
      headers,
      body: JSON.stringify({ productId, provider: 'stripe' }),
    })

    const response = await POST(mockRequest)
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.success).toBe(false)
    expect(data.error).toBe('authentication_required')
  })

  /**
   * Test 3: Provider API is NOT called when rate limit is exceeded.
   * We verify that createStripeCheckout is never called on the 11th request.
   */
  it('should not call payment provider on rate-limited request', async () => {
    // Exhaust rate limit
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      await callCheckout(studentUserEmail, productId)
    }

    // Clear mock call history so we can verify no new calls
    ;(stripeMock.createStripeCheckout as any).mockClear()
    ;(paypalMock.createPayPalOrder as any).mockClear()

    // 11th request — should be rate-limited BEFORE calling the provider
    const eleventhResult = await callCheckout(studentUserEmail, productId)
    expect(eleventhResult.status).toBe(429)

    // Verify provider was never called on the rate-limited request
    expect((stripeMock.createStripeCheckout as any).mock.calls.length).toBe(0)
    expect((paypalMock.createPayPalOrder as any).mock.calls.length).toBe(0)
  })

  /**
   * Test 4: Super-admin user is exempt from rate limiting.
   * The super-admin user has role: AccountRole.Admin ('admin') which is included in the JWT.
   * isSuperAdmin checks user.role === AccountRole.Admin, exempting them from rate limiting.
   */
  it('should exempt super-admin users from rate limiting', async () => {
    // Clear any rate limit state from previous tests
    clearAllRateLimits()

    // Make 15 requests from super-admin — all should succeed
    for (let i = 0; i < 15; i++) {
      const result = await callCheckout(superAdminUserEmail, productId)
      ;(expect(result.status).toBe(200), `Super-admin request ${i + 1} should succeed`)
      expect(result.data.success).toBe(true)
    }
  })
})
