// @vitest-environment node
/**
 * Integration tests: Payment Webhook Handlers and grantProductEntitlements
 *
 * Tests:
 * 1. grantProductEntitlements: lesson entitlements are pushed, feature entitlements
 *    are pushed, duplicate calls are idempotent, missing product throws
 * 2. Stripe webhook: checkout.session.completed → succeeded + grant entitlements,
 *    idempotency guard prevents double-grant, session.expired → failed,
 *    charge.refunded → refunded
 * 3. PayPal webhook: CHECKOUT.ORDER.APPROVED → succeeded + grant entitlements,
 *    idempotency guard, PAYMENT.CAPTURE.COMPLETED skips non-pending,
 *    PAYMENT.CAPTURE.REFUNDED → refunded
 *
 * @fileType integration-test
 * @domain payments
 * @pattern webhook, entitlement-atomic
 * @ai-summary Tests webhook handlers and atomic entitlement granting for payment flows
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ObjectId } from 'mongodb'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { AccountRole } from '@/server/payload/collections/Users/roles'

// Dynamic imports to avoid premature @payload-config initialization
let grantProductEntitlements: (
  userId: string,
  productId: string,
  transactionId: string,
) => Promise<void>
let stripeWebhookHandler: (request: NextRequest) => Promise<Response>
let paypalWebhookHandler: (request: NextRequest) => Promise<Response>

let payload: Payload
let originalDatabaseUrl: string | undefined

// Test fixture IDs (populated in beforeAll)
let tenantId: string
let userId: string
let chapterId: string
let lessonId: string
let productItemLessonId: string
let productItemFeatureId: string
let productId: string
let stripeTransactionId: string
let paypalTransactionId: string

const FEATURE_KEY = 'certificate'

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Dynamically import to use testcontainer DB
  const grantModule = await import('@/lib/payment/grant-entitlements')
  grantProductEntitlements = grantModule.grantProductEntitlements

  const stripeRoute = await import('@/app/api/webhooks/stripe/route')
  stripeWebhookHandler = stripeRoute.POST

  const paypalRoute = await import('@/app/api/webhooks/paypal/route')
  paypalWebhookHandler = paypalRoute.POST

  // Create tenant
  const tenant = await payload.create({
    collection: 'tenants',
    data: { name: `webhook-test-${Date.now()}`, slug: `webhook-test-${Date.now()}` } as any,
    overrideAccess: true,
  })
  tenantId = tenant.id

  // Create category → course → chapter → lesson
  const category = await payload.create({
    collection: 'categories',
    data: {
      title: 'Webhook Test Category',
      slug: `webhook-cat-${Date.now()}`,
      locale: 'he',
    } as any,
    overrideAccess: true,
  })

  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: 'W1',
      title: 'Webhook Test Course',
      categories: [category.id],
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })

  const chapter = await payload.create({
    collection: 'chapters',
    data: {
      title: 'Webhook Test Chapter',
      slug: `webhook-chapter-${Date.now()}`,
      course: course.id,
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  chapterId = chapter.id

  const lesson = await payload.create({
    collection: 'lessons',
    data: {
      title: 'Webhook Test Lesson',
      slug: `webhook-lesson-${Date.now()}`,
      type: 'practice',
      chapter: chapterId,
      tenant: tenantId,
      status: 'published',
    } as any,
    overrideAccess: true,
  })
  lessonId = lesson.id

  // Create product-item (lesson type)
  const productItemLesson = await payload.create({
    collection: 'product-items',
    data: {
      type: 'lesson',
      lesson: lessonId,
    } as any,
    overrideAccess: true,
  })
  productItemLessonId = productItemLesson.id

  // Create product-item (feature type)
  const productItemFeature = await payload.create({
    collection: 'product-items',
    data: {
      type: 'feature',
      featureKey: FEATURE_KEY,
    } as any,
    overrideAccess: true,
  })
  productItemFeatureId = productItemFeature.id

  // Create product with both items
  const product = await payload.create({
    collection: 'products',
    data: {
      name: `Webhook Test Product ${Date.now()}`,
      slug: `webhook-test-product-${Date.now()}`,
      billingType: 'one_time',
      price: 1000,
      currency: 'ILS',
      items: [productItemLessonId, productItemFeatureId],
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  productId = product.id

  // Create test user
  const user = await payload.create({
    collection: 'users',
    data: {
      email: `webhook-user-${Date.now()}@test.com`,
      password: 'test-password-123!',
      name: 'Webhook Test User',
    } as any,
    overrideAccess: true,
  })
  userId = user.id

  // Create Stripe transaction
  const stripeTx = await payload.create({
    collection: 'transactions',
    data: {
      user: userId,
      product: productId,
      provider: 'stripe',
      providerTransactionId: `cs_test_${Date.now()}`,
      status: 'pending',
      amount: 1000,
      currency: 'ILS',
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  stripeTransactionId = stripeTx.id

  // Create PayPal transaction
  const paypalTx = await payload.create({
    collection: 'transactions',
    data: {
      user: userId,
      product: productId,
      provider: 'paypal',
      providerTransactionId: `PP_test_${Date.now()}`,
      status: 'pending',
      amount: 1000,
      currency: 'ILS',
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  paypalTransactionId = paypalTx.id
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

async function cleanupUsers() {
  // Only reset entitlements — do NOT delete the user so userId remains valid
  if (!userId) return
  const usersCollection = payload.db.collections['users']
  try {
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { courseEntitlements: [], featureEntitlements: [] } },
    )
  } catch {
    // User may not exist yet (before first test runs)
  }
}

beforeEach(cleanupUsers)
afterEach(cleanupUsers)

// ─── Mock verify functions ────────────────────────────────────────────────────

vi.mock('@/lib/payment/stripe', () => ({
  verifyStripeWebhook: vi.fn().mockResolvedValue({
    id: 'evt_test',
    type: 'checkout.session.completed',
    data: { object: { id: `cs_test_${Date.now()}` } },
  }),
}))

vi.mock('@/lib/payment/paypal', () => ({
  verifyPayPalWebhook: vi.fn().mockResolvedValue(true),
}))

// ─── grantProductEntitlements tests ──────────────────────────────────────────

describe('grantProductEntitlements', () => {
  it('should push lesson entitlement to user courseEntitlements', async () => {
    await grantProductEntitlements(userId, productId, 'tx_lesson_test')

    const user = await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
    })

    const entitlements = (user as any).courseEntitlements || []
    expect(entitlements.length).toBeGreaterThan(0)
    const lessonEntitlement = entitlements.find(
      (e: any) => e.course?.toString() === lessonId || e.course === lessonId,
    )
    expect(lessonEntitlement).toBeDefined()
    expect(lessonEntitlement.grantMethod).toBe('payment')
    expect(lessonEntitlement.transactionId).toBe('tx_lesson_test')
  })

  it('should push feature entitlement to user featureEntitlements', async () => {
    await grantProductEntitlements(userId, productId, 'tx_feature_test')

    const user = await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
    })

    const entitlements = (user as any).featureEntitlements || []
    expect(entitlements.length).toBeGreaterThan(0)
    const featureEntitlement = entitlements.find((e: any) => e.key === FEATURE_KEY)
    expect(featureEntitlement).toBeDefined()
    expect(featureEntitlement.transactionId).toBe('tx_feature_test')
  })

  it('should be idempotent — duplicate calls do not create double entries', async () => {
    const txId = 'tx_idempotent_test'

    // Call twice
    await grantProductEntitlements(userId, productId, txId)
    await grantProductEntitlements(userId, productId, txId)

    const user = await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
    })

    const courseEntitlements = (user as any).courseEntitlements || []
    const featureEntitlements = (user as any).featureEntitlements || []

    // Should have exactly one entitlement per type (no duplicates)
    const lessonCount = courseEntitlements.filter(
      (e: any) => e.course?.toString() === lessonId || e.course === lessonId,
    ).length
    const featureCount = featureEntitlements.filter((e: any) => e.key === FEATURE_KEY).length

    expect(lessonCount).toBe(1)
    expect(featureCount).toBe(1)
  })

  it('should throw when product is not found', async () => {
    // Payload findByID throws a NotFound error for non-existent IDs
    await expect(
      grantProductEntitlements(userId, 'non_existent_product_id', 'tx_missing_test'),
    ).rejects.toThrow()
  })
})

// ─── Stripe webhook route tests ──────────────────────────────────────────────

describe('Stripe webhook handler', () => {
  it('checkout.session.completed should update transaction to succeeded and grant entitlements', async () => {
    // Update the mock to return a session ID matching our test transaction
    const sessionId = `cs_stripe_success_${Date.now()}`
    const { verifyStripeWebhook } = await import('@/lib/payment/stripe')
    vi.mocked(verifyStripeWebhook).mockResolvedValueOnce({
      id: 'evt_success',
      type: 'checkout.session.completed',
      data: { object: { id: sessionId } },
    } as any)

    // Create a transaction with this session ID
    const tx = await payload.create({
      collection: 'transactions',
      data: {
        user: userId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: sessionId,
        status: 'pending',
        amount: 1000,
        currency: 'ILS',
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_test' },
    })

    const res = await stripeWebhookHandler(req)
    expect(res.status).toBe(200)

    const updated = await payload.findByID({
      collection: 'transactions',
      id: tx.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(updated.status).toBe('succeeded')

    // Verify entitlements were granted
    const user = await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
    })
    const courseEntitlements = (user as any).courseEntitlements || []
    const hasLessonEntitlement = courseEntitlements.some(
      (e: any) => e.course?.toString() === lessonId || e.course === lessonId,
    )
    expect(hasLessonEntitlement).toBe(true)

    await payload
      .delete({ collection: 'transactions', id: tx.id, overrideAccess: true })
      .catch(() => {})
  })

  it('checkout.session.completed should be idempotent — skip if already succeeded', async () => {
    const sessionId = `cs_stripe_idempotent_${Date.now()}`
    const { verifyStripeWebhook } = await import('@/lib/payment/stripe')
    vi.mocked(verifyStripeWebhook).mockResolvedValueOnce({
      id: 'evt_idem',
      type: 'checkout.session.completed',
      data: { object: { id: sessionId } },
    } as any)

    const tx = await payload.create({
      collection: 'transactions',
      data: {
        user: userId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: sessionId,
        status: 'succeeded', // Already succeeded
        amount: 1000,
        currency: 'ILS',
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    // Clear any existing entitlements
    const usersCollection = payload.db.collections['users']
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { courseEntitlements: [], featureEntitlements: [] } },
    )

    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_test' },
    })

    await stripeWebhookHandler(req)

    // Entitlements should NOT have been re-granted (idempotency guard)
    const user = await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
    })
    const courseEntitlements = (user as any).courseEntitlements || []
    const hasEntitlement = courseEntitlements.some(
      (e: any) => e.course?.toString() === lessonId || e.course === lessonId,
    )
    expect(hasEntitlement).toBe(false)

    await payload
      .delete({ collection: 'transactions', id: tx.id, overrideAccess: true })
      .catch(() => {})
  })

  it('checkout.session.expired should update transaction to failed', async () => {
    const sessionId = `cs_stripe_expired_${Date.now()}`
    const { verifyStripeWebhook } = await import('@/lib/payment/stripe')
    vi.mocked(verifyStripeWebhook).mockResolvedValueOnce({
      id: 'evt_expired',
      type: 'checkout.session.expired',
      data: { object: { id: sessionId } },
    } as any)

    const tx = await payload.create({
      collection: 'transactions',
      data: {
        user: userId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: sessionId,
        status: 'pending',
        amount: 1000,
        currency: 'ILS',
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_test' },
    })

    const res = await stripeWebhookHandler(req)
    expect(res.status).toBe(200)

    const updated = await payload.findByID({
      collection: 'transactions',
      id: tx.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(updated.status).toBe('failed')

    await payload
      .delete({ collection: 'transactions', id: tx.id, overrideAccess: true })
      .catch(() => {})
  })

  it('charge.refunded should update transaction to refunded', async () => {
    const paymentIntentId = `pi_stripe_refund_${Date.now()}`
    const { verifyStripeWebhook } = await import('@/lib/payment/stripe')
    vi.mocked(verifyStripeWebhook).mockResolvedValueOnce({
      id: 'evt_refund',
      type: 'charge.refunded',
      data: { object: { payment_intent: paymentIntentId } },
    } as any)

    const tx = await payload.create({
      collection: 'transactions',
      data: {
        user: userId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: paymentIntentId,
        status: 'succeeded',
        amount: 1000,
        currency: 'ILS',
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_test' },
    })

    const res = await stripeWebhookHandler(req)
    expect(res.status).toBe(200)

    const updated = await payload.findByID({
      collection: 'transactions',
      id: tx.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(updated.status).toBe('refunded')

    await payload
      .delete({ collection: 'transactions', id: tx.id, overrideAccess: true })
      .catch(() => {})
  })
})

// ─── PayPal webhook route tests ──────────────────────────────────────────────

describe('PayPal webhook handler', () => {
  it('CHECKOUT.ORDER.APPROVED should update transaction to succeeded and grant entitlements', async () => {
    const orderId = `PP_order_approved_${Date.now()}`
    const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')
    vi.mocked(verifyPayPalWebhook).mockResolvedValueOnce(true)

    const tx = await payload.create({
      collection: 'transactions',
      data: {
        user: userId,
        product: productId,
        provider: 'paypal',
        providerTransactionId: orderId,
        status: 'pending',
        amount: 1000,
        currency: 'ILS',
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    const req = new NextRequest('http://localhost/api/webhooks/paypal', {
      method: 'POST',
      headers: {
        'paypal-transmission-id': 'test-tx-id',
        'paypal-transmission-time': new Date().toISOString(),
        'paypal-transmission-sig': 'test-sig',
        'paypal-cert-url': 'https://cert.url',
        'paypal-auth-algo': 'SHA256withRSA',
      },
      body: JSON.stringify({
        event_type: 'CHECKOUT.ORDER.APPROVED',
        resource: { id: orderId },
      }),
    })

    const res = await paypalWebhookHandler(req)
    expect(res.status).toBe(200)

    const updated = await payload.findByID({
      collection: 'transactions',
      id: tx.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(updated.status).toBe('succeeded')

    // Verify entitlements were granted
    const user = await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
    })
    const courseEntitlements = (user as any).courseEntitlements || []
    const hasLessonEntitlement = courseEntitlements.some(
      (e: any) => e.course?.toString() === lessonId || e.course === lessonId,
    )
    expect(hasLessonEntitlement).toBe(true)

    await payload
      .delete({ collection: 'transactions', id: tx.id, overrideAccess: true })
      .catch(() => {})
  })

  it('CHECKOUT.ORDER.APPROVED should be idempotent — skip if already succeeded', async () => {
    const orderId = `PP_order_idempotent_${Date.now()}`
    const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')
    vi.mocked(verifyPayPalWebhook).mockResolvedValueOnce(true)

    const tx = await payload.create({
      collection: 'transactions',
      data: {
        user: userId,
        product: productId,
        provider: 'paypal',
        providerTransactionId: orderId,
        status: 'succeeded', // Already succeeded
        amount: 1000,
        currency: 'ILS',
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    // Clear entitlements
    const usersCollection = payload.db.collections['users']
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { courseEntitlements: [], featureEntitlements: [] } },
    )

    const req = new NextRequest('http://localhost/api/webhooks/paypal', {
      method: 'POST',
      headers: {
        'paypal-transmission-id': 'test-tx-id',
        'paypal-transmission-time': new Date().toISOString(),
        'paypal-transmission-sig': 'test-sig',
        'paypal-cert-url': 'https://cert.url',
        'paypal-auth-algo': 'SHA256withRSA',
      },
      body: JSON.stringify({
        event_type: 'CHECKOUT.ORDER.APPROVED',
        resource: { id: orderId },
      }),
    })

    await paypalWebhookHandler(req)

    // Entitlements should NOT have been re-granted
    const user = await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
    })
    const courseEntitlements = (user as any).courseEntitlements || []
    const hasEntitlement = courseEntitlements.some(
      (e: any) => e.course?.toString() === lessonId || e.course === lessonId,
    )
    expect(hasEntitlement).toBe(false)

    await payload
      .delete({ collection: 'transactions', id: tx.id, overrideAccess: true })
      .catch(() => {})
  })

  it('PAYMENT.CAPTURE.COMPLETED should update transaction to succeeded when pending', async () => {
    const orderId = `PP_capture_completed_${Date.now()}`
    const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')
    vi.mocked(verifyPayPalWebhook).mockResolvedValueOnce(true)

    const tx = await payload.create({
      collection: 'transactions',
      data: {
        user: userId,
        product: productId,
        provider: 'paypal',
        providerTransactionId: orderId,
        status: 'pending',
        amount: 1000,
        currency: 'ILS',
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    const req = new NextRequest('http://localhost/api/webhooks/paypal', {
      method: 'POST',
      headers: {
        'paypal-transmission-id': 'test-tx-id',
        'paypal-transmission-time': new Date().toISOString(),
        'paypal-transmission-sig': 'test-sig',
        'paypal-cert-url': 'https://cert.url',
        'paypal-auth-algo': 'SHA256withRSA',
      },
      body: JSON.stringify({
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: `${orderId}_capture`,
          supplementary_data: {
            related_ids: { order_id: orderId },
          },
        },
      }),
    })

    const res = await paypalWebhookHandler(req)
    expect(res.status).toBe(200)

    const updated = await payload.findByID({
      collection: 'transactions',
      id: tx.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(updated.status).toBe('succeeded')

    await payload
      .delete({ collection: 'transactions', id: tx.id, overrideAccess: true })
      .catch(() => {})
  })

  it('PAYMENT.CAPTURE.COMPLETED should skip if transaction is not pending (e.g. refunded)', async () => {
    const orderId = `PP_capture_refunded_${Date.now()}`
    const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')
    vi.mocked(verifyPayPalWebhook).mockResolvedValueOnce(true)

    const tx = await payload.create({
      collection: 'transactions',
      data: {
        user: userId,
        product: productId,
        provider: 'paypal',
        providerTransactionId: orderId,
        status: 'refunded',
        amount: 1000,
        currency: 'ILS',
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    const req = new NextRequest('http://localhost/api/webhooks/paypal', {
      method: 'POST',
      headers: {
        'paypal-transmission-id': 'test-tx-id',
        'paypal-transmission-time': new Date().toISOString(),
        'paypal-transmission-sig': 'test-sig',
        'paypal-cert-url': 'https://cert.url',
        'paypal-auth-algo': 'SHA256withRSA',
      },
      body: JSON.stringify({
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: `${orderId}_capture`,
          supplementary_data: {
            related_ids: { order_id: orderId },
          },
        },
      }),
    })

    await paypalWebhookHandler(req)

    // Status should remain refunded (not overwritten to succeeded)
    const updated = await payload.findByID({
      collection: 'transactions',
      id: tx.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(updated.status).toBe('refunded')

    await payload
      .delete({ collection: 'transactions', id: tx.id, overrideAccess: true })
      .catch(() => {})
  })

  it('PAYMENT.CAPTURE.REFUNDED should update transaction to refunded', async () => {
    const captureId = `PP_capture_refund_${Date.now()}`
    const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')
    vi.mocked(verifyPayPalWebhook).mockResolvedValueOnce(true)

    const tx = await payload.create({
      collection: 'transactions',
      data: {
        user: userId,
        product: productId,
        provider: 'paypal',
        providerTransactionId: captureId,
        status: 'succeeded',
        amount: 1000,
        currency: 'ILS',
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    const req = new NextRequest('http://localhost/api/webhooks/paypal', {
      method: 'POST',
      headers: {
        'paypal-transmission-id': 'test-tx-id',
        'paypal-transmission-time': new Date().toISOString(),
        'paypal-transmission-sig': 'test-sig',
        'paypal-cert-url': 'https://cert.url',
        'paypal-auth-algo': 'SHA256withRSA',
      },
      body: JSON.stringify({
        event_type: 'PAYMENT.CAPTURE.REFUNDED',
        resource: { id: captureId },
      }),
    })

    const res = await paypalWebhookHandler(req)
    expect(res.status).toBe(200)

    const updated = await payload.findByID({
      collection: 'transactions',
      id: tx.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(updated.status).toBe('refunded')

    await payload
      .delete({ collection: 'transactions', id: tx.id, overrideAccess: true })
      .catch(() => {})
  })
})
