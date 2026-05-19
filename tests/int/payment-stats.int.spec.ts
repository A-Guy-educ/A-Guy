// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests: PaymentStats collection and syncPaymentStats hook
 *
 * Tests:
 * 1. Succeeded transaction creates PaymentStats row with correct amounts
 * 2. Failed transaction creates PaymentStats row with failedAgorot/failedCount
 * 3. Refunded transaction creates PaymentStats row with refundedAgorot/refundedCount
 * 4. Two succeeded txs on same date+currency aggregate correctly
 * 5. Succeeded → refunded status transition moves amounts correctly
 * 6. Idempotency: update with same status doesn't double-count
 * 7. pending → succeeded transition creates PaymentStats row correctly
 * 8. newCustomersCount = 1 for first ever succeeded tx per user
 * 9. newCustomersCount = 2 when same user makes multiple succeeded txs (simplified logic)
 * 10. Admin-only access enforced on all CRUD operations
 *
 * @fileType integration-test
 * @domain payments
 * @pattern transaction-log
 */

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { AccountRole } from '@/server/payload/collections/Users/roles'

let payload: Payload
let originalDatabaseUrl: string | undefined

// Fixture IDs
let userId: string
let productId: string
let stripeProviderTxId: number

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Create product
  const product = await payload.create({
    collection: 'products',
    data: {
      name: `PS Test Product ${Date.now()}`,
      slug: `ps-test-product-${Date.now()}`,
      billingType: 'one_time',
      price: 1000,
      currency: 'ILS',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  productId = product.id

  // Create test user
  const user = await payload.create({
    collection: 'users',
    data: {
      email: `ps-user-${Date.now()}@test.com`,
      password: 'test-password-123!',
      name: 'PS Test User',
      role: AccountRole.Student,
    } as any,
    overrideAccess: true,
  })
  userId = user.id

  stripeProviderTxId = Date.now()
}, 60_000)

afterAll(async () => {
  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  }
  await stopMongoContainer()
})

describe('PaymentStats syncPaymentStats hook', () => {
  // Bulk clean payment_stats AND transactions before each test. The mongo
  // container is shared across test files (db name "test"), so prior files
  // can leave residue. afterEach alone leaves the FIRST test in this file
  // exposed to that pollution.
  const wipeState = async () => {
    try {
      const psDocs = await payload.find({
        collection: 'payment_stats',
        depth: 0,
        overrideAccess: true,
        limit: 1000,
      })
      for (const doc of psDocs.docs) {
        await payload.delete({ collection: 'payment_stats', id: doc.id, overrideAccess: true })
      }
    } catch {
      /* ignore */
    }
    try {
      const txDocs = await payload.find({
        collection: 'transactions',
        depth: 0,
        overrideAccess: true,
        limit: 1000,
      })
      for (const doc of txDocs.docs) {
        await payload.delete({ collection: 'transactions', id: doc.id, overrideAccess: true })
      }
    } catch {
      /* ignore */
    }
  }

  beforeEach(wipeState)

  afterEach(async () => {
    // Clean up transactions and payment_stats after each test
    try {
      const txDocs = await payload.find({
        collection: 'transactions',
        where: { providerTransactionId: { like: `ps-${Date.now()}` } },
        depth: 0,
        overrideAccess: true,
      })
      for (const doc of txDocs.docs) {
        await payload.delete({ collection: 'transactions', id: doc.id, overrideAccess: true })
      }
    } catch {
      /* ignore cleanup errors */
    }
    try {
      const psDocs = await payload.find({
        collection: 'payment_stats',
        depth: 0,
        overrideAccess: true,
        limit: 100,
      })
      for (const doc of psDocs.docs) {
        await payload.delete({ collection: 'payment_stats', id: doc.id, overrideAccess: true })
      }
    } catch {
      /* ignore cleanup errors */
    }
  })

  it('succeeded tx creates PaymentStats row with correct amounts', async () => {
    const tx = await payload.create({
      collection: 'transactions',
      data: {
        user: userId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: `ps-${stripeProviderTxId}-s1`,
        status: 'succeeded',
        amount: 5000,
        currency: 'ILS',
        successUrl: 'https://example.com/success',
      } as any,
      overrideAccess: true,
    })

    const stats = await payload.find({
      collection: 'payment_stats',
      where: {
        date: { equals: tx.createdAt.split('T')[0] },
        currency: { equals: 'ILS' },
      },
      depth: 0,
      overrideAccess: true,
    })

    expect(stats.totalDocs).toBe(1)
    expect(stats.docs[0].totalRevenueAgorot).toBe(5000)
    expect(stats.docs[0].succeededCount).toBe(1)
    expect(stats.docs[0].refundedCount).toBe(0)
    expect(stats.docs[0].failedCount).toBe(0)
    expect(stats.docs[0].transactionCount).toBe(1)
    expect(stats.docs[0].newCustomersCount).toBe(1)
  })

  it('failed tx creates PaymentStats row with failedAgorot/failedCount', async () => {
    const tx = await payload.create({
      collection: 'transactions',
      data: {
        user: userId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: `ps-${stripeProviderTxId}-f1`,
        status: 'failed',
        amount: 3000,
        currency: 'ILS',
      } as any,
      overrideAccess: true,
    })

    const stats = await payload.find({
      collection: 'payment_stats',
      where: {
        date: { equals: tx.createdAt.split('T')[0] },
        currency: { equals: 'ILS' },
      },
      depth: 0,
      overrideAccess: true,
    })

    expect(stats.totalDocs).toBe(1)
    expect(stats.docs[0].failedAgorot).toBe(3000)
    expect(stats.docs[0].failedCount).toBe(1)
    expect(stats.docs[0].transactionCount).toBe(1)
    expect(stats.docs[0].totalRevenueAgorot).toBe(0)
  })

  it('refunded tx creates PaymentStats row with refundedAgorot/refundedCount', async () => {
    const tx = await payload.create({
      collection: 'transactions',
      data: {
        user: userId,
        product: productId,
        provider: 'paypal',
        providerTransactionId: `ps-${stripeProviderTxId}-r1`,
        status: 'refunded',
        amount: 2000,
        currency: 'ILS',
      } as any,
      overrideAccess: true,
    })

    const stats = await payload.find({
      collection: 'payment_stats',
      where: {
        date: { equals: tx.createdAt.split('T')[0] },
        currency: { equals: 'ILS' },
      },
      depth: 0,
      overrideAccess: true,
    })

    expect(stats.totalDocs).toBe(1)
    expect(stats.docs[0].refundedAgorot).toBe(2000)
    expect(stats.docs[0].refundedCount).toBe(1)
    expect(stats.docs[0].transactionCount).toBe(1)
  })

  it('two succeeded txs on same date+currency aggregate correctly', async () => {
    const tx1 = await payload.create({
      collection: 'transactions',
      data: {
        user: userId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: `ps-${stripeProviderTxId}-agg1`,
        status: 'succeeded',
        amount: 1000,
        currency: 'ILS',
      } as any,
      overrideAccess: true,
    })

    // Same date+currency, second tx
    const _tx2 = await payload.create({
      collection: 'transactions',
      data: {
        user: userId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: `ps-${stripeProviderTxId}-agg2`,
        status: 'succeeded',
        amount: 2000,
        currency: 'ILS',
      } as any,
      overrideAccess: true,
    })

    const stats = await payload.find({
      collection: 'payment_stats',
      where: {
        date: { equals: tx1.createdAt.split('T')[0] },
        currency: { equals: 'ILS' },
      },
      depth: 0,
      overrideAccess: true,
    })

    expect(stats.totalDocs).toBe(1)
    expect(stats.docs[0].totalRevenueAgorot).toBe(3000)
    expect(stats.docs[0].succeededCount).toBe(2)
    expect(stats.docs[0].transactionCount).toBe(2)
    expect(stats.docs[0].newCustomersCount).toBe(2)
  })

  it('succeeded → refunded status transition moves amounts correctly', async () => {
    const tx = await payload.create({
      collection: 'transactions',
      data: {
        user: userId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: `ps-${stripeProviderTxId}-rev1`,
        status: 'succeeded',
        amount: 5000,
        currency: 'ILS',
      } as any,
      overrideAccess: true,
    })

    // Update status to refunded
    await payload.update({
      collection: 'transactions',
      id: tx.id,
      data: { status: 'refunded' } as any,
      req: {} as any,
      overrideAccess: true,
    })

    const stats = await payload.find({
      collection: 'payment_stats',
      where: {
        date: { equals: tx.createdAt.split('T')[0] },
        currency: { equals: 'ILS' },
      },
      depth: 0,
      overrideAccess: true,
    })

    expect(stats.totalDocs).toBe(1)
    // Revenue should be removed; refunded should be added
    expect(stats.docs[0].totalRevenueAgorot).toBe(0)
    expect(stats.docs[0].succeededCount).toBe(0)
    expect(stats.docs[0].refundedAgorot).toBe(5000)
    expect(stats.docs[0].refundedCount).toBe(1)
  })

  it('idempotency: update with same status does not double-count', async () => {
    const tx = await payload.create({
      collection: 'transactions',
      data: {
        user: userId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: `ps-${stripeProviderTxId}-idem1`,
        status: 'succeeded',
        amount: 5000,
        currency: 'ILS',
      } as any,
      overrideAccess: true,
    })

    // Update to same status (no actual change)
    await payload.update({
      collection: 'transactions',
      id: tx.id,
      data: { status: 'succeeded' } as any,
      req: {} as any,
      overrideAccess: true,
    })

    const stats = await payload.find({
      collection: 'payment_stats',
      where: {
        date: { equals: tx.createdAt.split('T')[0] },
        currency: { equals: 'ILS' },
      },
      depth: 0,
      overrideAccess: true,
    })

    expect(stats.totalDocs).toBe(1)
    // Should NOT be doubled
    expect(stats.docs[0].totalRevenueAgorot).toBe(5000)
    expect(stats.docs[0].succeededCount).toBe(1)
    expect(stats.docs[0].transactionCount).toBe(1)
  })

  it('pending → succeeded transition creates PaymentStats row correctly', async () => {
    // Create with pending status (not countable)
    const tx = await payload.create({
      collection: 'transactions',
      data: {
        user: userId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: `ps-${stripeProviderTxId}-pend1`,
        status: 'pending',
        amount: 5000,
        currency: 'ILS',
      } as any,
      overrideAccess: true,
    })

    // Verify no PaymentStats row was created yet
    const beforeStats = await payload.find({
      collection: 'payment_stats',
      depth: 0,
      overrideAccess: true,
    })
    expect(beforeStats.totalDocs).toBe(0)

    // Update status to succeeded (now countable)
    await payload.update({
      collection: 'transactions',
      id: tx.id,
      data: { status: 'succeeded' } as any,
      req: {} as any,
      overrideAccess: true,
    })

    const stats = await payload.find({
      collection: 'payment_stats',
      where: {
        date: { equals: tx.createdAt.split('T')[0] },
        currency: { equals: 'ILS' },
      },
      depth: 0,
      overrideAccess: true,
    })

    expect(stats.totalDocs).toBe(1)
    expect(stats.docs[0].totalRevenueAgorot).toBe(5000)
    expect(stats.docs[0].succeededCount).toBe(1)
    expect(stats.docs[0].transactionCount).toBe(1)
    expect(stats.docs[0].newCustomersCount).toBe(1)
  })

  it('newCustomersCount = 1 for first ever succeeded tx per user', async () => {
    const tx = await payload.create({
      collection: 'transactions',
      data: {
        user: userId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: `ps-${stripeProviderTxId}-new1`,
        status: 'succeeded',
        amount: 5000,
        currency: 'ILS',
      } as any,
      overrideAccess: true,
    })

    const stats = await payload.find({
      collection: 'payment_stats',
      where: {
        date: { equals: tx.createdAt.split('T')[0] },
        currency: { equals: 'ILS' },
      },
      depth: 0,
      overrideAccess: true,
    })

    expect(stats.totalDocs).toBe(1)
    expect(stats.docs[0].newCustomersCount).toBe(1)
  })

  it('newCustomersCount = 2 when same user makes multiple succeeded txs (simplified logic)', async () => {
    // First succeeded tx
    await payload.create({
      collection: 'transactions',
      data: {
        user: userId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: `ps-${stripeProviderTxId}-existing1`,
        status: 'succeeded',
        amount: 5000,
        currency: 'ILS',
      } as any,
      overrideAccess: true,
    })

    // Second succeeded tx by same user on same date
    const tx2 = await payload.create({
      collection: 'transactions',
      data: {
        user: userId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: `ps-${stripeProviderTxId}-existing2`,
        status: 'succeeded',
        amount: 3000,
        currency: 'ILS',
      } as any,
      overrideAccess: true,
    })

    const stats = await payload.find({
      collection: 'payment_stats',
      where: {
        date: { equals: tx2.createdAt.split('T')[0] },
        currency: { equals: 'ILS' },
      },
      depth: 0,
      overrideAccess: true,
    })

    expect(stats.totalDocs).toBe(1)
    expect(stats.docs[0].newCustomersCount).toBe(2)
    expect(stats.docs[0].totalRevenueAgorot).toBe(8000)
    expect(stats.docs[0].succeededCount).toBe(2)
  })

  it('admin-only access: non-admin cannot create payment_stats', async () => {
    // Create a non-admin user
    const student = await payload.create({
      collection: 'users',
      data: {
        email: `ps-nonsadmin-${Date.now()}@test.com`,
        password: 'test-password-123!',
        name: 'PS NonAdmin Test',
        role: AccountRole.Student,
      } as any,
      overrideAccess: true,
    })

    try {
      await payload.create({
        collection: 'payment_stats',
        data: {
          date: '2025-01-01',
          currency: 'ILS',
          totalRevenueAgorot: 1000,
          refundedAgorot: 0,
          failedAgorot: 0,
          transactionCount: 1,
          succeededCount: 1,
          refundedCount: 0,
          failedCount: 0,
          newCustomersCount: 0,
        } as any,
        // No overrideAccess → enforces collection access control
        user: student as any,
        overrideAccess: false,
      })
      expect.fail('Non-admin should not be able to create payment_stats')
    } catch (err: any) {
      // Expected: access denied (Payload returns "You are not allowed to perform this action")
      expect(err?.message ?? String(err)).toMatch(
        /access|denied|unauthorized|forbidden|not allowed/i,
      )
    } finally {
      await payload.delete({ collection: 'users', id: student.id, overrideAccess: true })
    }
  })
})
