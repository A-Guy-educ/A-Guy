// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing.

/**
 * Integration tests: Admin Dashboard Payment Attention Metrics — Issue #2619
 *
 * Verifies that GET /api/admin/dashboard-metrics returns correct counts for
 * the 4 payment attention conditions:
 * - stuckGrants: status=succeeded AND entitlementsGrantedAt=null
 * - stuckReceipts: status=succeeded AND emailSentAt=null AND createdAt < 5min ago
 * - partialRefunds: status=succeeded AND refundedAmount > 0
 * - stuckWebhooks: processed=false AND receivedAt < 15min ago
 *
 * Uses the same auth pattern as tests/int/admin-dashboard-metrics.int.spec.ts.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { GET } from '@/app/api/admin/dashboard-metrics/route'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let adminToken: string
let adminUserId: string
let studentUserId: string
let studentToken: string

const ts = Date.now()

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  const adminEmail = `admin-payment-attn-${ts}@test.local`
  const studentEmail = `student-payment-attn-${ts}@test.local`
  const password = 'test-password-1234'

  // Admin user
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: adminEmail,
      password,
      name: 'Payment Attn Admin',
    } as any,
  })
  await payload.update({
    collection: 'users',
    id: admin.id,
    data: { role: AccountRole.Admin } as any,
    overrideAccess: true,
  })
  adminUserId = admin.id

  const student = await payload.create({
    collection: 'users',
    data: {
      email: studentEmail,
      password,
      name: 'Payment Attn Student',
      role: AccountRole.Student,
    } as any,
    overrideAccess: true,
  })
  studentUserId = student.id

  const adminLogin = await payload.login({
    collection: 'users',
    data: { email: adminEmail, password },
  })
  adminToken = adminLogin.token!

  const studentLogin = await payload.login({
    collection: 'users',
    data: { email: studentEmail, password },
  })
  studentToken = studentLogin.token!
}, 60_000)

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return
  for (const id of [adminUserId, studentUserId]) {
    if (!id) continue
    try {
      await payload.delete({ collection: 'users', id, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
}, 60_000)

describe.skipIf(!hasDatabaseUrl)(
  'GET /api/admin/dashboard-metrics — paymentAttentionMetrics',
  () => {
    it('returns paymentAttentionMetrics shape for admins', async () => {
      const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
        headers: { Authorization: `JWT ${adminToken}` },
      })
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = await res.json()

      expect(body.paymentAttentionMetrics).toEqual(
        expect.objectContaining({
          stuckGrants: expect.any(Number),
          stuckReceipts: expect.any(Number),
          partialRefunds: expect.any(Number),
          stuckWebhooks: expect.any(Number),
        }),
      )
    })

    it('counts stuck grants (succeeded without entitlementsGrantedAt)', async () => {
      // Create a product for the transaction
      const product = await payload.create({
        collection: 'products',
        data: {
          name: `Stuck Grant Product ${ts}`,
          slug: `stuck-grant-product-${ts}`,
          billingType: 'one_time',
          price: 1000,
          currency: 'ILS',
          isActive: true,
        } as any,
        overrideAccess: true,
      })

      // Create admin user for ownership
      const ownerEmail = `stuck-grant-owner-${ts}@test.local`
      const owner = await payload.create({
        collection: 'users',
        data: { email: ownerEmail, password: 'test-password-1234', name: 'Owner' } as any,
        overrideAccess: true,
      })

      // Create a succeeded transaction WITHOUT entitlementsGrantedAt
      await payload.create({
        collection: 'transactions',
        data: {
          user: owner.id,
          product: product.id,
          provider: 'stripe',
          providerTransactionId: `stuck_grant_${ts}`,
          status: 'succeeded',
          amount: 1000,
          currency: 'ILS',
          // entitlementsGrantedAt intentionally omitted
        } as any,
        overrideAccess: true,
      })

      const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
        headers: { Authorization: `JWT ${adminToken}` },
      })
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.paymentAttentionMetrics.stuckGrants).toBeGreaterThan(0)
    })

    it('counts stuck receipts (succeeded without emailSentAt, older than 5 min)', async () => {
      const product = await payload.create({
        collection: 'products',
        data: {
          name: `Stuck Receipt Product ${ts}`,
          slug: `stuck-receipt-product-${ts}`,
          billingType: 'one_time',
          price: 1000,
          currency: 'ILS',
          isActive: true,
        } as any,
        overrideAccess: true,
      })

      const ownerEmail = `stuck-receipt-owner-${ts}@test.local`
      const owner = await payload.create({
        collection: 'users',
        data: { email: ownerEmail, password: 'test-password-1234', name: 'Owner' } as any,
        overrideAccess: true,
      })

      // Create a succeeded transaction without emailSentAt, with createdAt 10 min ago
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000)
      await payload.create({
        collection: 'transactions',
        data: {
          user: owner.id,
          product: product.id,
          provider: 'stripe',
          providerTransactionId: `stuck_receipt_${ts}`,
          status: 'succeeded',
          amount: 1000,
          currency: 'ILS',
          createdAt: tenMinAgo,
          // emailSentAt intentionally omitted
        } as any,
        overrideAccess: true,
      })

      const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
        headers: { Authorization: `JWT ${adminToken}` },
      })
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.paymentAttentionMetrics.stuckReceipts).toBeGreaterThan(0)
    })

    it('counts partial refunds (succeeded with refundedAmount > 0)', async () => {
      const product = await payload.create({
        collection: 'products',
        data: {
          name: `Partial Refund Product ${ts}`,
          slug: `partial-refund-product-${ts}`,
          billingType: 'one_time',
          price: 1000,
          currency: 'ILS',
          isActive: true,
        } as any,
        overrideAccess: true,
      })

      const ownerEmail = `partial-refund-owner-${ts}@test.local`
      const owner = await payload.create({
        collection: 'users',
        data: { email: ownerEmail, password: 'test-password-1234', name: 'Owner' } as any,
        overrideAccess: true,
      })

      // Create a succeeded transaction with refundedAmount > 0
      await payload.create({
        collection: 'transactions',
        data: {
          user: owner.id,
          product: product.id,
          provider: 'stripe',
          providerTransactionId: `partial_refund_${ts}`,
          status: 'succeeded',
          amount: 1000,
          currency: 'ILS',
          refundedAmount: 500,
        } as any,
        overrideAccess: true,
      })

      const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
        headers: { Authorization: `JWT ${adminToken}` },
      })
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.paymentAttentionMetrics.partialRefunds).toBeGreaterThan(0)
    })

    it('counts stuck webhooks (processed=false, older than 15 min)', async () => {
      // Create a webhook event that is processed=false and receivedAt 20 min ago
      const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000)
      await payload.create({
        collection: 'webhook-events',
        data: {
          provider: 'stripe',
          eventId: `stuck_webhook_${ts}`,
          eventType: 'checkout.session.completed',
          receivedAt: twentyMinAgo,
          processed: false,
        } as any,
        overrideAccess: true,
      })

      const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
        headers: { Authorization: `JWT ${adminToken}` },
      })
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.paymentAttentionMetrics.stuckWebhooks).toBeGreaterThan(0)
    })

    it('returns 403 for non-admin users', async () => {
      const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
        headers: { Authorization: `JWT ${studentToken}` },
      })
      const res = await GET(req)
      expect(res.status).toBe(403)
    })

    it('returns 401 without auth', async () => {
      const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month')
      const res = await GET(req)
      expect(res.status).toBe(401)
    })
  },
)
