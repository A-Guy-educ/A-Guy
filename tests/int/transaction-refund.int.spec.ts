// @vitest-environment node
/**
 * Integration tests: Transaction Refund API
 *
 * Tests the POST /api/admin/transactions/{id}/refund endpoint:
 * 1. Returns 401 without auth
 * 2. Returns 403 for non-admin users
 * 3. Returns 404 for non-existent transaction
 * 4. Returns 400 for already-refunded transaction (double-refund guard)
 * 5. Returns 400 for non-succeeded transaction
 * 6. Successfully refunds a succeeded stripe transaction
 * 7. Successfully refunds a succeeded paypal transaction
 * 8. Double-refund attempt returns 400 with Hebrew message
 *
 * @fileType integration-test
 * @domain payments
 * @pattern refund, admin-api
 */

import { ObjectId } from 'mongodb'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { AccountRole } from '@/server/payload/collections/Users/roles'

// Dynamic import to avoid premature @payload-config initialization
let transactionRefundHandler: (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => Promise<Response>

let payload: Payload
let originalDatabaseUrl: string | undefined

// Test fixture IDs
let tenantId: string
let adminUserId: string
let studentUserId: string
let stripeTransactionId: string
let paypalTransactionId: string
let refundedFieldsTransactionId: string
let refundedTransactionId: string
let pendingTransactionId: string
let failedTransactionId: string

let adminToken: string
let studentToken: string

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Dynamically import the route handler
  const route = await import('@/app/api/admin/transactions/[id]/refund/route')
  transactionRefundHandler = route.POST

  // Create tenant
  const tenant = await payload.create({
    collection: 'tenants',
    data: { name: `refund-test-${Date.now()}`, slug: `refund-test-${Date.now()}` } as any,
    overrideAccess: true,
  })
  tenantId = tenant.id

  // Create admin user
  const adminEmail = `refund-admin-${Date.now()}@test.local`
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: adminEmail,
      password: 'test-password-1234',
      name: 'Refund Admin',
    } as any,
    overrideAccess: true,
  })
  await payload.update({
    collection: 'users',
    id: admin.id,
    data: { role: AccountRole.Admin } as any,
    overrideAccess: true,
  })
  adminUserId = admin.id

  // Create student user
  const studentEmail = `refund-student-${Date.now()}@test.local`
  const student = await payload.create({
    collection: 'users',
    data: {
      email: studentEmail,
      password: 'test-password-1234',
      name: 'Refund Student',
      role: AccountRole.Student,
    } as any,
    overrideAccess: true,
  })
  studentUserId = student.id

  // Create category, course, chapter, and lesson for pricing plan
  const category = await payload.create({
    collection: 'categories',
    data: {
      title: `Refund Test Category ${Date.now()}`,
      slug: `refund-cat-${Date.now()}`,
      locale: 'he',
    } as any,
    overrideAccess: true,
  })

  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: 'R1',
      title: `Refund Test Course ${Date.now()}`,
      categories: [category.id],
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })

  const chapter = await payload.create({
    collection: 'chapters',
    data: {
      title: `Refund Test Chapter ${Date.now()}`,
      slug: `refund-chapter-${Date.now()}`,
      course: course.id,
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })

  const lesson = await payload.create({
    collection: 'lessons',
    data: {
      title: `Refund Test Lesson ${Date.now()}`,
      slug: `refund-lesson-${Date.now()}`,
      type: 'practice',
      chapter: chapter.id,
      tenant: tenantId,
      status: 'published',
    } as any,
    overrideAccess: true,
  })

  // Create pricing plan
  const pricingPlan = await payload.create({
    collection: 'pricing-plans',
    data: {
      lesson: lesson.id,
      provider: 'tranzila',
      billingType: 'one_time',
      price: 1000,
      currency: 'ILS',
      isActive: true,
    } as any,
    overrideAccess: true,
  })

  // Create completed stripe transaction
  const stripeTx = await payload.create({
    collection: 'transactions',
    data: {
      user: adminUserId,
      pricingPlan: pricingPlan.id,
      tranzilaTransactionId: `cs_refund_test_${Date.now()}`,
      tranzilaOrderId: `order_refund_test_${Date.now()}`,
      status: 'completed',
      amount: 1000,
      currency: 'ILS',
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  stripeTransactionId = stripeTx.id

  // Create completed paypal transaction
  const paypalTx = await payload.create({
    collection: 'transactions',
    data: {
      user: adminUserId,
      pricingPlan: pricingPlan.id,
      tranzilaTransactionId: `PP_refund_test_${Date.now()}`,
      tranzilaOrderId: `order_paypal_test_${Date.now()}`,
      status: 'completed',
      amount: 1000,
      currency: 'ILS',
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  paypalTransactionId = paypalTx.id

  // Create completed stripe transaction for testing refund fields
  const refundFieldsTx = await payload.create({
    collection: 'transactions',
    data: {
      user: adminUserId,
      pricingPlan: pricingPlan.id,
      tranzilaTransactionId: `cs_refund_fields_test_${Date.now()}`,
      tranzilaOrderId: `order_fields_test_${Date.now()}`,
      status: 'completed',
      amount: 2500,
      currency: 'ILS',
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  refundedFieldsTransactionId = refundFieldsTx.id

  // Create already-refunded transaction
  const refundedTx = await payload.create({
    collection: 'transactions',
    data: {
      user: adminUserId,
      pricingPlan: pricingPlan.id,
      tranzilaTransactionId: `cs_refunded_test_${Date.now()}`,
      tranzilaOrderId: `order_refunded_test_${Date.now()}`,
      status: 'refunded',
      amount: 1000,
      currency: 'ILS',
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  refundedTransactionId = refundedTx.id

  // Create pending transaction
  const pendingTx = await payload.create({
    collection: 'transactions',
    data: {
      user: adminUserId,
      pricingPlan: pricingPlan.id,
      tranzilaTransactionId: `cs_pending_test_${Date.now()}`,
      tranzilaOrderId: `order_pending_test_${Date.now()}`,
      status: 'pending',
      amount: 1000,
      currency: 'ILS',
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  pendingTransactionId = pendingTx.id

  // Create failed transaction
  const failedTx = await payload.create({
    collection: 'transactions',
    data: {
      user: adminUserId,
      pricingPlan: pricingPlan.id,
      tranzilaTransactionId: `cs_failed_test_${Date.now()}`,
      tranzilaOrderId: `order_failed_test_${Date.now()}`,
      status: 'failed',
      amount: 1000,
      currency: 'ILS',
      tenant: tenantId,
      failureReason: 'Card declined',
    } as any,
    overrideAccess: true,
  })
  failedTransactionId = failedTx.id

  // Get tokens
  const adminLogin = await payload.login({
    collection: 'users',
    data: { email: adminEmail, password: 'test-password-1234' },
  })
  adminToken = adminLogin.token!

  const studentLogin = await payload.login({
    collection: 'users',
    data: { email: studentEmail, password: 'test-password-1234' },
  })
  studentToken = studentLogin.token!
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

// Mock the refund functions
vi.mock('@/lib/payment/stripe', () => ({
  refundStripe: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/payment/paypal', () => ({
  refundPayPal: vi.fn().mockResolvedValue(undefined),
}))

describe('POST /api/admin/transactions/{id}/refund', () => {
  it('returns 401 without auth', async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/admin/transactions/${stripeTransactionId}/refund`,
      {
        method: 'POST',
      },
    )
    const res = await transactionRefundHandler(req, {
      params: Promise.resolve({ id: stripeTransactionId }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/admin/transactions/${stripeTransactionId}/refund`,
      {
        method: 'POST',
        headers: { Authorization: `JWT ${studentToken}` },
      },
    )
    const res = await transactionRefundHandler(req, {
      params: Promise.resolve({ id: stripeTransactionId }),
    })
    expect(res.status).toBe(403)
  })

  it('returns 404 for non-existent transaction', async () => {
    const fakeId = new ObjectId().toString()
    const req = new NextRequest(`http://localhost:3000/api/admin/transactions/${fakeId}/refund`, {
      method: 'POST',
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await transactionRefundHandler(req, { params: Promise.resolve({ id: fakeId }) })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Transaction not found')
  })

  it('returns 400 for already-refunded transaction (double-refund guard)', async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/admin/transactions/${refundedTransactionId}/refund`,
      {
        method: 'POST',
        headers: { Authorization: `JWT ${adminToken}` },
      },
    )
    const res = await transactionRefundHandler(req, {
      params: Promise.resolve({ id: refundedTransactionId }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('העסקה כבר הוחזרה')
  })

  it('returns 400 for pending transaction', async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/admin/transactions/${pendingTransactionId}/refund`,
      {
        method: 'POST',
        headers: { Authorization: `JWT ${adminToken}` },
      },
    )
    const res = await transactionRefundHandler(req, {
      params: Promise.resolve({ id: pendingTransactionId }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Only succeeded transactions can be refunded')
  })

  it('returns 400 for failed transaction', async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/admin/transactions/${failedTransactionId}/refund`,
      {
        method: 'POST',
        headers: { Authorization: `JWT ${adminToken}` },
      },
    )
    const res = await transactionRefundHandler(req, {
      params: Promise.resolve({ id: failedTransactionId }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Only succeeded transactions can be refunded')
  })

  it('successfully refunds a succeeded stripe transaction', async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/admin/transactions/${stripeTransactionId}/refund`,
      {
        method: 'POST',
        headers: { Authorization: `JWT ${adminToken}` },
      },
    )
    const res = await transactionRefundHandler(req, {
      params: Promise.resolve({ id: stripeTransactionId }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)

    // Verify transaction status was updated
    const updated = await payload.findByID({
      collection: 'transactions',
      id: stripeTransactionId,
      overrideAccess: true,
    })
    expect(updated.status).toBe('refunded')
  })

  it('successfully refunds a succeeded paypal transaction', async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/admin/transactions/${paypalTransactionId}/refund`,
      {
        method: 'POST',
        headers: { Authorization: `JWT ${adminToken}` },
      },
    )
    const res = await transactionRefundHandler(req, {
      params: Promise.resolve({ id: paypalTransactionId }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)

    // Verify transaction status was updated
    const updated = await payload.findByID({
      collection: 'transactions',
      id: paypalTransactionId,
      overrideAccess: true,
    })
    expect(updated.status).toBe('refunded')
  })

  it('successfully refunds and sets refundedAmount, refundedBy, refundedAt fields', async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/admin/transactions/${refundedFieldsTransactionId}/refund`,
      {
        method: 'POST',
        headers: { Authorization: `JWT ${adminToken}` },
      },
    )
    const res = await transactionRefundHandler(req, {
      params: Promise.resolve({ id: refundedFieldsTransactionId }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)

    // Verify transaction status and refund audit fields were updated
    const updated = await payload.findByID({
      collection: 'transactions',
      id: refundedFieldsTransactionId,
      overrideAccess: true,
    })
    expect(updated.status).toBe('refunded')

    // Verify refund audit fields are set
    expect((updated as any).refundedAmount).toBe(2500)
    expect((updated as any).refundedBy?.id).toBe(adminUserId)
    expect((updated as any).refundedAt).toBeDefined()
    expect(new Date((updated as any).refundedAt).getTime()).toBeCloseTo(Date.now(), -3) // within ~1 second
  })

  it('double-refund attempt returns 400 with Hebrew message', async () => {
    // This transaction was already refunded in the previous test
    const req = new NextRequest(
      `http://localhost:3000/api/admin/transactions/${stripeTransactionId}/refund`,
      {
        method: 'POST',
        headers: { Authorization: `JWT ${adminToken}` },
      },
    )
    const res = await transactionRefundHandler(req, {
      params: Promise.resolve({ id: stripeTransactionId }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('העסקה כבר הוחזרה')
  })
})
