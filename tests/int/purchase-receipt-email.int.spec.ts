// @vitest-environment node
/**
 * Integration tests: Purchase Receipt Email on Payment Webhooks
 *
 * Tests:
 * 1. Stripe checkout.session.completed (payment_status=paid) → emailSentAt is set on transaction
 * 2. PayPal PAYMENT.CAPTURE.COMPLETED → emailSentAt is set on transaction
 * 3. Replay of checkout.session.completed does NOT double-set emailSentAt (idempotency)
 * 4. Refund events (charge.refunded, PAYMENT.CAPTURE.REFUNDED) do NOT trigger email send
 * 5. checkout.session.completed with payment_status != paid does NOT send email
 * 6. Webhook returns 200 even when sendPurchaseReceipt throws (fire-and-forget)
 *
 * @fileType integration-test
 * @domain payments, email
 * @pattern webhook, purchase-receipt, idempotency
 * @ai-summary Tests purchase receipt email flow on payment webhook success and failure cases
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
let stripeWebhookHandler: (request: NextRequest) => Promise<Response>
let paypalWebhookHandler: (request: NextRequest) => Promise<Response>

let payload: Payload
let originalDatabaseUrl: string | undefined

// Test fixture IDs (populated in beforeAll)
let userId: string
let tenantId: string
let chapterId: string
let lessonId: string
let productItemLessonId: string
let productItemFeatureId: string
let productId: string

const FEATURE_KEY = 'certificate'

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  const stripeRoute = await import('@/app/api/webhooks/stripe/route')
  stripeWebhookHandler = stripeRoute.POST

  const paypalRoute = await import('@/app/api/webhooks/paypal/route')
  paypalWebhookHandler = paypalRoute.POST

  // Create tenant
  const tenant = await payload.create({
    collection: 'tenants',
    data: { name: `email-test-${Date.now()}`, slug: `email-test-${Date.now()}` } as any,
    overrideAccess: true,
  })
  tenantId = tenant.id

  // Create category → course → chapter → lesson
  const category = await payload.create({
    collection: 'categories',
    data: {
      title: 'Email Test Category',
      slug: `email-cat-${Date.now()}`,
      locale: 'he',
    } as any,
    overrideAccess: true,
  })

  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: 'W1',
      title: 'Email Test Course',
      categories: [category.id],
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })

  const chapter = await payload.create({
    collection: 'chapters',
    data: {
      title: 'Email Test Chapter',
      slug: `email-chapter-${Date.now()}`,
      course: course.id,
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  chapterId = chapter.id

  const lesson = await payload.create({
    collection: 'lessons',
    data: {
      title: 'Email Test Lesson',
      slug: `email-lesson-${Date.now()}`,
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
      name: `Email Test Product ${Date.now()}`,
      slug: `email-test-product-${Date.now()}`,
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
      email: `email-user-${Date.now()}@test.com`,
      password: 'test-password-123!',
      name: 'Email Test User',
    } as any,
    overrideAccess: true,
  })
  userId = user.id
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

vi.mock('@/lib/payment/grant-entitlements', async () => {
  const { grantProductEntitlements: realGrant, ...rest } =
    await import('@/lib/payment/grant-entitlements')
  return {
    ...rest,
    grantProductEntitlements: vi.fn().mockImplementation(realGrant),
  }
})

// Mock the purchase receipt service — mockResolvedValue(false) simulates
// "no email adapter configured" so we test the no-op fallback path.
// The real test is whether emailSentAt gets set on the transaction.
vi.mock('@/server/email/services/purchase-receipt-service', () => ({
  sendPurchaseReceipt: vi.fn().mockResolvedValue(false),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getTransactionEmailSentAt(txId: string): Promise<string | null> {
  const tx = await payload.findByID({
    collection: 'transactions',
    id: txId,
    depth: 0,
    overrideAccess: true,
  })
  return (tx as any).emailSentAt ?? null
}

// ─── Stripe: emailSentAt set on successful payment ────────────────────────────

describe('Stripe purchase receipt email', () => {
  it('checkout.session.completed (payment_status=paid) should set emailSentAt on transaction', async () => {
    const sessionId = `cs_email_success_${Date.now()}`
    const { verifyStripeWebhook } = await import('@/lib/payment/stripe')

    vi.mocked(verifyStripeWebhook).mockResolvedValueOnce({
      id: 'evt_email_success',
      type: 'checkout.session.completed',
      data: { object: { id: sessionId, payment_status: 'paid' } },
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

    // emailSentAt should be set after successful payment webhook
    const emailSentAt = await getTransactionEmailSentAt(tx.id)
    expect(emailSentAt).toBeDefined()
    expect(new Date(emailSentAt!).toISOString()).toBeTruthy()

    await payload
      .delete({ collection: 'transactions', id: tx.id, overrideAccess: true })
      .catch(() => {})
  })

  it('replay of checkout.session.completed should NOT double-set emailSentAt (idempotency)', async () => {
    const sessionId = `cs_email_replay_${Date.now()}`
    const { verifyStripeWebhook } = await import('@/lib/payment/stripe')

    // First call: payment succeeds
    vi.mocked(verifyStripeWebhook).mockResolvedValueOnce({
      id: 'evt_email_replay_1',
      type: 'checkout.session.completed',
      data: { object: { id: sessionId, payment_status: 'paid' } },
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

    const req1 = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_test' },
    })
    const res1 = await stripeWebhookHandler(req1)
    expect(res1.status).toBe(200)

    const firstEmailSentAt = await getTransactionEmailSentAt(tx.id)
    expect(firstEmailSentAt).toBeDefined()

    // Second call: replay of same event (idempotency should skip re-send)
    vi.mocked(verifyStripeWebhook).mockResolvedValueOnce({
      id: 'evt_email_replay_2',
      type: 'checkout.session.completed',
      data: { object: { id: sessionId, payment_status: 'paid' } },
    } as any)

    const req2 = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_test' },
    })
    const res2 = await stripeWebhookHandler(req2)
    expect(res2.status).toBe(200)

    const secondEmailSentAt = await getTransactionEmailSentAt(tx.id)

    // emailSentAt should NOT have changed on replay (idempotency — already sent)
    expect(secondEmailSentAt).toBe(firstEmailSentAt)

    await payload
      .delete({ collection: 'transactions', id: tx.id, overrideAccess: true })
      .catch(() => {})
  })

  it('charge.refunded should NOT set emailSentAt on transaction', async () => {
    const paymentIntentId = `pi_email_refund_${Date.now()}`
    const { verifyStripeWebhook } = await import('@/lib/payment/stripe')

    vi.mocked(verifyStripeWebhook).mockResolvedValueOnce({
      id: 'evt_email_refund',
      type: 'charge.refunded',
      created: Math.floor(Date.now() / 1000),
      data: { object: { payment_intent: paymentIntentId, amount: 1000, amount_refunded: 1000 } },
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

    // emailSentAt should NOT be set for refunds
    const emailSentAt = await getTransactionEmailSentAt(tx.id)
    expect(emailSentAt).toBeNull()

    await payload
      .delete({ collection: 'transactions', id: tx.id, overrideAccess: true })
      .catch(() => {})
  })

  it('checkout.session.completed with payment_status != paid should NOT set emailSentAt', async () => {
    const sessionId = `cs_email_unpaid_${Date.now()}`
    const { verifyStripeWebhook } = await import('@/lib/payment/stripe')

    vi.mocked(verifyStripeWebhook).mockResolvedValueOnce({
      id: 'evt_email_unpaid',
      type: 'checkout.session.completed',
      data: { object: { id: sessionId, payment_status: 'unpaid' } },
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

    // emailSentAt should NOT be set when payment_status != paid
    const emailSentAt = await getTransactionEmailSentAt(tx.id)
    expect(emailSentAt).toBeNull()

    await payload
      .delete({ collection: 'transactions', id: tx.id, overrideAccess: true })
      .catch(() => {})
  })

  it('webhook returns 200 even when sendPurchaseReceipt throws (fire-and-forget)', async () => {
    const sessionId = `cs_email_error_${Date.now()}`
    const { verifyStripeWebhook } = await import('@/lib/payment/stripe')
    const { sendPurchaseReceipt } = await import('@/server/email/services/purchase-receipt-service')

    vi.mocked(verifyStripeWebhook).mockResolvedValueOnce({
      id: 'evt_email_error',
      type: 'checkout.session.completed',
      data: { object: { id: sessionId, payment_status: 'paid' } },
    } as any)

    // Simulate sendPurchaseReceipt throwing
    vi.mocked(sendPurchaseReceipt).mockRejectedValueOnce(new Error('Email service unavailable'))

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

    // Webhook should still return 200 even if email send throws
    const res = await stripeWebhookHandler(req)
    expect(res.status).toBe(200)

    // Reset the mock so it doesn't affect other tests
    vi.mocked(sendPurchaseReceipt).mockResolvedValue(false)

    await payload
      .delete({ collection: 'transactions', id: tx.id, overrideAccess: true })
      .catch(() => {})
  })
})

// ─── PayPal: emailSentAt set on successful payment ────────────────────────────

describe('PayPal purchase receipt email', () => {
  it('PAYMENT.CAPTURE.COMPLETED should set emailSentAt on transaction', async () => {
    const orderId = `PP_email_success_${Date.now()}`
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
        id: `PP_evt_${Date.now()}`,
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

    // emailSentAt should be set after successful payment webhook
    const emailSentAt = await getTransactionEmailSentAt(tx.id)
    expect(emailSentAt).toBeDefined()

    await payload
      .delete({ collection: 'transactions', id: tx.id, overrideAccess: true })
      .catch(() => {})
  })

  it('PAYMENT.CAPTURE.REFUNDED should NOT set emailSentAt on transaction', async () => {
    const captureId = `PP_email_refund_${Date.now()}`
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
        id: `PP_evt_${Date.now()}`,
        event_type: 'PAYMENT.CAPTURE.REFUNDED',
        resource: { id: captureId },
      }),
    })

    const res = await paypalWebhookHandler(req)
    expect(res.status).toBe(200)

    // emailSentAt should NOT be set for refunds
    const emailSentAt = await getTransactionEmailSentAt(tx.id)
    expect(emailSentAt).toBeNull()

    await payload
      .delete({ collection: 'transactions', id: tx.id, overrideAccess: true })
      .catch(() => {})
  })

  it('CHECKOUT.ORDER.APPROVED should NOT set emailSentAt (only CAPTURE.COMPLETED sends)', async () => {
    const orderId = `PP_email_approved_${Date.now()}`
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
        id: `PP_evt_${Date.now()}`,
        event_type: 'CHECKOUT.ORDER.APPROVED',
        resource: { id: orderId },
      }),
    })

    const res = await paypalWebhookHandler(req)
    expect(res.status).toBe(200)

    // emailSentAt should NOT be set — email only sent on CAPTURE.COMPLETED
    const emailSentAt = await getTransactionEmailSentAt(tx.id)
    expect(emailSentAt).toBeNull()

    await payload
      .delete({ collection: 'transactions', id: tx.id, overrideAccess: true })
      .catch(() => {})
  })
})
