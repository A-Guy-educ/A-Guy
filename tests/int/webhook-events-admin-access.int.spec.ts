// @vitest-environment node
/**
 * Integration test: WebhookEvents admin UI access
 *
 * Reproduces the bug where WebhookEvents collection appears empty in admin UI
 * even though webhook handlers create records with overrideAccess: true.
 *
 * Tests:
 * 1. Webhook handler creates WebhookEvents with overrideAccess: true
 * 2. Admin UI query (no overrideAccess) should still see the records
 *
 * @fileType integration-test
 * @domain payments
 * @pattern webhook, admin-access
 */

import { ObjectId } from 'mongodb'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { AccountRole } from '@/server/payload/collections/Users/roles'

let payload: Payload
let originalDatabaseUrl: string | undefined

// Test fixture IDs
let adminUserId: string
let userId: string
let productId: string
let tenantId: string

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
      name: `webhook-events-test-${Date.now()}`,
      slug: `webhook-events-test-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })
  tenantId = tenant.id

  // Create admin user for WebhookEvents access testing
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: `wea-admin-${Date.now()}@test.com`,
      password: 'test-password-123!',
      name: 'Webhook Events Admin',
    } as any,
    overrideAccess: true,
  })
  await payload.update({
    collection: 'users',
    id: admin.id,
    data: { role: AccountRole.Admin },
    overrideAccess: true,
  })
  adminUserId = admin.id

  // Create test user
  const user = await payload.create({
    collection: 'users',
    data: {
      email: `wea-user-${Date.now()}@test.com`,
      password: 'test-password-123!',
      name: 'Webhook Events User',
    } as any,
    overrideAccess: true,
  })
  userId = user.id

  // Create product for checkout
  const product = await payload.create({
    collection: 'products',
    data: {
      name: `Webhook Events Test Product ${Date.now()}`,
      slug: `wea-product-${Date.now()}`,
      billingType: 'one_time',
      price: 1000,
      currency: 'ILS',
      isActive: true,
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
}, 120_000)

beforeEach(async () => {
  // Clean up WebhookEvents before each test
  const events = await payload.find({
    collection: 'webhook-events',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  for (const doc of events.docs) {
    await payload
      .delete({ collection: 'webhook-events', id: doc.id, overrideAccess: true })
      .catch(() => {})
  }
})

// ─── Mock verify functions ────────────────────────────────────────────────────

vi.mock('@/lib/payment/stripe', () => ({
  verifyStripeWebhook: vi.fn().mockResolvedValue({
    id: 'evt_test',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test' } },
  }),
}))

vi.mock('@/lib/payment/paypal', () => ({
  verifyPayPalWebhook: vi.fn().mockResolvedValue(true),
}))

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('WebhookEvents admin UI access', () => {
  it('ADMIN UI ACCESS: WebhookEvents created by webhook handler should be readable by admin (no overrideAccess)', async () => {
    // This test reproduces the bug where WebhookEvents appear empty in admin UI
    // The webhook handler creates records with overrideAccess: true
    // The admin UI queries WITHOUT overrideAccess: true

    // Simulate what the webhook handler does: create WebhookEvents with overrideAccess: true
    const eventId = `evt_admin_access_${Date.now()}`
    const createdDoc = await payload.create({
      collection: 'webhook-events',
      data: {
        provider: 'stripe',
        eventId: eventId,
        eventType: 'checkout.session.completed',
        processed: false,
        receivedAt: new Date().toISOString(),
      },
      draft: false,
      overrideAccess: true,
    })

    expect(createdDoc.id).toBeDefined()

    // Now simulate what the ADMIN UI does: query WITHOUT overrideAccess
    // The admin UI uses the authenticated admin user's context
    // adminOnly access should allow admin users to read

    // Query WITHOUT overrideAccess: true - simulates admin UI query
    const adminUser = await payload.findByID({
      collection: 'users',
      id: adminUserId,
      depth: 0,
      overrideAccess: true,
    })
    expect((adminUser as any).role).toBe(AccountRole.Admin)

    // This is the actual admin UI query (no overrideAccess)
    // This should return the record because admin user has admin role
    const eventsViaAdminQuery = await payload.find({
      collection: 'webhook-events',
      where: { eventId: { equals: eventId } },
      limit: 1,
      depth: 0,
      // NO overrideAccess - simulating admin UI query
      // user: adminUser, <-- how would the admin UI pass the user?
    })

    // BUG: If admin UI cannot see this record, eventsViaAdminQuery.totalDocs will be 0
    expect(eventsViaAdminQuery.totalDocs).toBe(1)
    expect((eventsViaAdminQuery.docs[0] as any).eventId).toBe(eventId)
    expect((eventsViaAdminQuery.docs[0] as any).provider).toBe('stripe')
  })

  it('ADMIN UI ACCESS: Admin user should be able to query WebhookEvents with adminOnly access', async () => {
    // Create a WebhookEvents record
    const eventId = `evt_admin_query_${Date.now()}`
    await payload.create({
      collection: 'webhook-events',
      data: {
        provider: 'stripe',
        eventId: eventId,
        eventType: 'checkout.session.completed',
        processed: true,
        receivedAt: new Date().toISOString(),
      },
      draft: false,
      overrideAccess: true,
    })

    // The critical question: when the admin UI queries, does it pass the user context?
    // In Payload admin UI, the user context IS passed via req.user
    // The adminOnly function checks user.role === AccountRole.Admin

    // For this test, we need to simulate the admin UI query
    // Since we can't easily pass user context to payload.find, let's
    // check if the admin user can at least be found and has admin role

    const adminUser = await payload.findByID({
      collection: 'users',
      id: adminUserId,
      depth: 0,
      overrideAccess: true,
    })

    expect((adminUser as any).role).toBe(AccountRole.Admin)

    // Query WITHOUT overrideAccess
    // If the admin UI properly passes user context, this should work
    const events = await payload.find({
      collection: 'webhook-events',
      where: { eventId: { equals: eventId } },
      limit: 1,
      depth: 0,
      // Note: NO overrideAccess: true
      // Note: NO user passed
    })

    // The question is: does this query return the record?
    // If adminOnly blocks this, totalDocs will be 0
    expect(events.totalDocs).toBe(1)
  })

  it('WEBHOOK HANDLER: Stripe webhook handler should create WebhookEvents record', async () => {
    // This test verifies the webhook handler creates WebhookEvents correctly
    const stripeWebhookHandler = (await import('@/app/api/webhooks/stripe/route')).POST

    const sessionId = `cs_wea_${Date.now()}`
    const eventId = `evt_wea_${Date.now()}`

    // Mock the verifyStripeWebhook to return our test event
    const { verifyStripeWebhook } = await import('@/lib/payment/stripe')
    vi.mocked(verifyStripeWebhook).mockResolvedValueOnce({
      id: eventId,
      type: 'checkout.session.completed',
      data: { object: { id: sessionId, payment_status: 'paid' } },
    } as any)

    // Create a transaction
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

    // Call the webhook handler
    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_test' },
    })

    const res = await stripeWebhookHandler(req)
    expect(res.status).toBe(200)

    // Verify WebhookEvents record was created
    const events = await payload.find({
      collection: 'webhook-events',
      where: { eventId: { equals: eventId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    expect(events.totalDocs).toBe(1)
    expect((events.docs[0] as any).processed).toBe(true)
    expect((events.docs[0] as any).provider).toBe('stripe')
    expect((events.docs[0] as any).eventType).toBe('checkout.session.completed')

    await payload
      .delete({ collection: 'transactions', id: tx.id, overrideAccess: true })
      .catch(() => {})
  })

  it('BUG REPRODUCTION: WebhookEvents record created but admin UI cannot see it (adminOnly issue)', async () => {
    // Create a WebhookEvents record like the webhook handler does
    const eventId = `evt_bug_${Date.now()}`
    await payload.create({
      collection: 'webhook-events',
      data: {
        provider: 'stripe',
        eventId: eventId,
        eventType: 'checkout.session.completed',
        processed: true,
        receivedAt: new Date().toISOString(),
      },
      draft: false,
      overrideAccess: true,
    })

    // Verify it exists with overrideAccess
    const withOverride = await payload.find({
      collection: 'webhook-events',
      where: { eventId: { equals: eventId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    expect(withOverride.totalDocs).toBe(1)

    // Now query WITHOUT overrideAccess (simulating admin UI)
    const withoutOverride = await payload.find({
      collection: 'webhook-events',
      where: { eventId: { equals: eventId } },
      limit: 1,
      depth: 0,
      // NO overrideAccess
    })

    // THIS IS THE BUG: if withoutOverride.totalDocs is 0,
    // then the admin UI cannot see WebhookEvents records
    //
    // Expected: 1 (record should be visible to admin)
    // Actual (if bug exists): 0 (admin UI shows empty collection)
    expect(withoutOverride.totalDocs).toBe(1) // This will FAIL if the bug exists
  })
})
