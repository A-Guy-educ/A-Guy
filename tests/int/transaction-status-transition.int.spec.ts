// @vitest-environment node
/**
 * Integration tests: Transaction Status Transition Validation
 *
 * Tests the beforeChange hook on Transactions collection that enforces
 * the status transition table:
 * - pending → completed, failed, refunded (all allowed)
 * - completed → refunded (only this is allowed)
 * - failed → terminal (no transitions allowed)
 * - refunded → terminal (no transitions allowed)
 * - Creating a transaction with any starting status is allowed
 *
 * @fileType integration-test
 * @domain payments
 * @pattern status-transition, before-change-hook
 */

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { AccountRole } from '@/server/payload/collections/Users/roles'

let payload: Payload
let originalDatabaseUrl: string | undefined

// Test fixture IDs
let tenantId: string
let adminUserId: string
let studentUserId: string

let pendingTransactionId: string
let succeededTransactionId: string
let failedTransactionId: string
let refundedTransactionId: string

let productId: string

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
      name: `status-transition-test-${Date.now()}`,
      slug: `status-transition-test-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })
  tenantId = tenant.id

  // Create admin user
  const adminEmail = `status-transition-admin-${Date.now()}@test.local`
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: adminEmail,
      password: 'test-password-1234',
      name: 'Status Transition Admin',
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
  const studentEmail = `status-transition-student-${Date.now()}@test.local`
  const student = await payload.create({
    collection: 'users',
    data: {
      email: studentEmail,
      password: 'test-password-1234',
      name: 'Status Transition Student',
      role: AccountRole.Student,
    } as any,
    overrideAccess: true,
  })
  studentUserId = student.id

  // Create product
  const product = await payload.create({
    collection: 'products',
    data: {
      name: `Status Transition Test Product ${Date.now()}`,
      slug: `status-transition-test-product-${Date.now()}`,
      billingType: 'one_time',
      price: 1000,
      currency: 'ILS',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  productId = product.id

  // Create pending transaction
  const pendingTx = await payload.create({
    collection: 'transactions',
    data: {
      user: adminUserId,
      product: productId,
      provider: 'stripe',
      providerTransactionId: `cs_pending_${Date.now()}`,
      status: 'pending',
      amount: 1000,
      currency: 'ILS',
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  pendingTransactionId = pendingTx.id

  // Create succeeded transaction
  const succeededTx = await payload.create({
    collection: 'transactions',
    data: {
      user: adminUserId,
      product: productId,
      provider: 'stripe',
      providerTransactionId: `cs_succeeded_${Date.now()}`,
      status: 'completed',
      amount: 1000,
      currency: 'ILS',
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  succeededTransactionId = succeededTx.id

  // Create failed transaction
  const failedTx = await payload.create({
    collection: 'transactions',
    data: {
      user: adminUserId,
      product: productId,
      provider: 'stripe',
      providerTransactionId: `cs_failed_${Date.now()}`,
      status: 'failed',
      amount: 1000,
      currency: 'ILS',
      tenant: tenantId,
      errorMessage: 'Card declined',
    } as any,
    overrideAccess: true,
  })
  failedTransactionId = failedTx.id

  // Create refunded transaction
  const refundedTx = await payload.create({
    collection: 'transactions',
    data: {
      user: adminUserId,
      product: productId,
      provider: 'stripe',
      providerTransactionId: `cs_refunded_${Date.now()}`,
      status: 'refunded',
      amount: 1000,
      currency: 'ILS',
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  refundedTransactionId = refundedTx.id
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

describe('Transaction Status Transition Validation', () => {
  describe('Creating transactions with any initial status', () => {
    it('allows creating a transaction with pending status', async () => {
      const tx = await payload.create({
        collection: 'transactions',
        data: {
          user: studentUserId,
          product: productId,
          provider: 'stripe',
          providerTransactionId: `cs_create_pending_${Date.now()}`,
          status: 'pending',
          amount: 1000,
          currency: 'ILS',
          tenant: tenantId,
        } as any,
        overrideAccess: true,
      })
      expect(tx.status).toBe('pending')
    })

    it('allows creating a transaction with succeeded status', async () => {
      const tx = await payload.create({
        collection: 'transactions',
        data: {
          user: studentUserId,
          product: productId,
          provider: 'stripe',
          providerTransactionId: `cs_create_succeeded_${Date.now()}`,
          status: 'completed',
          amount: 1000,
          currency: 'ILS',
          tenant: tenantId,
        } as any,
        overrideAccess: true,
      })
      expect(tx.status).toBe('completed')
    })

    it('allows creating a transaction with failed status', async () => {
      const tx = await payload.create({
        collection: 'transactions',
        data: {
          user: studentUserId,
          product: productId,
          provider: 'stripe',
          providerTransactionId: `cs_create_failed_${Date.now()}`,
          status: 'failed',
          amount: 1000,
          currency: 'ILS',
          tenant: tenantId,
          errorMessage: 'Card declined',
        } as any,
        overrideAccess: true,
      })
      expect(tx.status).toBe('failed')
    })

    it('allows creating a transaction with refunded status', async () => {
      const tx = await payload.create({
        collection: 'transactions',
        data: {
          user: studentUserId,
          product: productId,
          provider: 'stripe',
          providerTransactionId: `cs_create_refunded_${Date.now()}`,
          status: 'refunded',
          amount: 1000,
          currency: 'ILS',
          tenant: tenantId,
        } as any,
        overrideAccess: true,
      })
      expect(tx.status).toBe('refunded')
    })
  })

  describe('Transitions from pending', () => {
    it('allows pending → succeeded', async () => {
      const updated = await payload.update({
        collection: 'transactions',
        id: pendingTransactionId,
        data: { status: 'completed' },
        overrideAccess: true,
      })
      expect(updated.status).toBe('completed')
    })

    it('allows pending → failed', async () => {
      // Re-create the pending transaction
      const tx = await payload.create({
        collection: 'transactions',
        data: {
          user: adminUserId,
          product: productId,
          provider: 'stripe',
          providerTransactionId: `cs_pending_to_failed_${Date.now()}`,
          status: 'pending',
          amount: 1000,
          currency: 'ILS',
          tenant: tenantId,
        } as any,
        overrideAccess: true,
      })
      const updated = await payload.update({
        collection: 'transactions',
        id: tx.id,
        data: { status: 'failed' },
        overrideAccess: true,
      })
      expect(updated.status).toBe('failed')
    })

    it('allows pending → refunded', async () => {
      // Re-create the pending transaction
      const tx = await payload.create({
        collection: 'transactions',
        data: {
          user: adminUserId,
          product: productId,
          provider: 'stripe',
          providerTransactionId: `cs_pending_to_refunded_${Date.now()}`,
          status: 'pending',
          amount: 1000,
          currency: 'ILS',
          tenant: tenantId,
        } as any,
        overrideAccess: true,
      })
      const updated = await payload.update({
        collection: 'transactions',
        id: tx.id,
        data: { status: 'refunded' },
        overrideAccess: true,
      })
      expect(updated.status).toBe('refunded')
    })
  })

  describe('Transitions from succeeded', () => {
    it('allows succeeded → refunded', async () => {
      // succeededTransactionId is already succeeded
      const updated = await payload.update({
        collection: 'transactions',
        id: succeededTransactionId,
        data: { status: 'refunded' },
        overrideAccess: true,
      })
      expect(updated.status).toBe('refunded')
    })

    it('rejects succeeded → pending', async () => {
      // Create a new succeeded transaction
      const tx = await payload.create({
        collection: 'transactions',
        data: {
          user: adminUserId,
          product: productId,
          provider: 'stripe',
          providerTransactionId: `cs_succeeded_to_pending_${Date.now()}`,
          status: 'completed',
          amount: 1000,
          currency: 'ILS',
          tenant: tenantId,
        } as any,
        overrideAccess: true,
      })
      await expect(
        payload.update({
          collection: 'transactions',
          id: tx.id,
          data: { status: 'pending' },
          overrideAccess: true,
        }),
      ).rejects.toThrow()
    })

    it('rejects succeeded → failed', async () => {
      // Create a new succeeded transaction
      const tx = await payload.create({
        collection: 'transactions',
        data: {
          user: adminUserId,
          product: productId,
          provider: 'stripe',
          providerTransactionId: `cs_succeeded_to_failed_${Date.now()}`,
          status: 'completed',
          amount: 1000,
          currency: 'ILS',
          tenant: tenantId,
        } as any,
        overrideAccess: true,
      })
      await expect(
        payload.update({
          collection: 'transactions',
          id: tx.id,
          data: { status: 'failed' },
          overrideAccess: true,
        }),
      ).rejects.toThrow()
    })
  })

  describe('Transitions from failed (terminal state)', () => {
    it('rejects failed → pending', async () => {
      await expect(
        payload.update({
          collection: 'transactions',
          id: failedTransactionId,
          data: { status: 'pending' },
          overrideAccess: true,
        }),
      ).rejects.toThrow()
    })

    it('rejects failed → succeeded', async () => {
      // Re-create the failed transaction
      const tx = await payload.create({
        collection: 'transactions',
        data: {
          user: adminUserId,
          product: productId,
          provider: 'stripe',
          providerTransactionId: `cs_failed_to_succeeded_${Date.now()}`,
          status: 'failed',
          amount: 1000,
          currency: 'ILS',
          tenant: tenantId,
          errorMessage: 'Card declined',
        } as any,
        overrideAccess: true,
      })
      await expect(
        payload.update({
          collection: 'transactions',
          id: tx.id,
          data: { status: 'completed' },
          overrideAccess: true,
        }),
      ).rejects.toThrow()
    })

    it('rejects failed → refunded', async () => {
      // Re-create the failed transaction
      const tx = await payload.create({
        collection: 'transactions',
        data: {
          user: adminUserId,
          product: productId,
          provider: 'stripe',
          providerTransactionId: `cs_failed_to_refunded_${Date.now()}`,
          status: 'failed',
          amount: 1000,
          currency: 'ILS',
          tenant: tenantId,
          errorMessage: 'Card declined',
        } as any,
        overrideAccess: true,
      })
      await expect(
        payload.update({
          collection: 'transactions',
          id: tx.id,
          data: { status: 'refunded' },
          overrideAccess: true,
        }),
      ).rejects.toThrow()
    })
  })

  describe('Transitions from refunded (terminal state)', () => {
    it('rejects refunded → pending', async () => {
      await expect(
        payload.update({
          collection: 'transactions',
          id: refundedTransactionId,
          data: { status: 'pending' },
          overrideAccess: true,
        }),
      ).rejects.toThrow()
    })

    it('rejects refunded → succeeded', async () => {
      // Re-create the refunded transaction
      const tx = await payload.create({
        collection: 'transactions',
        data: {
          user: adminUserId,
          product: productId,
          provider: 'stripe',
          providerTransactionId: `cs_refunded_to_succeeded_${Date.now()}`,
          status: 'refunded',
          amount: 1000,
          currency: 'ILS',
          tenant: tenantId,
        } as any,
        overrideAccess: true,
      })
      await expect(
        payload.update({
          collection: 'transactions',
          id: tx.id,
          data: { status: 'completed' },
          overrideAccess: true,
        }),
      ).rejects.toThrow()
    })

    it('rejects refunded → failed', async () => {
      // Re-create the refunded transaction
      const tx = await payload.create({
        collection: 'transactions',
        data: {
          user: adminUserId,
          product: productId,
          provider: 'stripe',
          providerTransactionId: `cs_refunded_to_failed_${Date.now()}`,
          status: 'refunded',
          amount: 1000,
          currency: 'ILS',
          tenant: tenantId,
        } as any,
        overrideAccess: true,
      })
      await expect(
        payload.update({
          collection: 'transactions',
          id: tx.id,
          data: { status: 'failed' },
          overrideAccess: true,
        }),
      ).rejects.toThrow()
    })
  })

  describe('Admin bypass with skipTransitionGuard', () => {
    it('allows invalid transition when skipTransitionGuard is true', async () => {
      // Create a succeeded transaction
      const tx = await payload.create({
        collection: 'transactions',
        data: {
          user: adminUserId,
          product: productId,
          provider: 'stripe',
          providerTransactionId: `cs_bypass_${Date.now()}`,
          status: 'completed',
          amount: 1000,
          currency: 'ILS',
          tenant: tenantId,
        } as any,
        overrideAccess: true,
      })
      // Admin should be able to force-transition using skipTransitionGuard
      const updated = await payload.update({
        collection: 'transactions',
        id: tx.id,
        data: { status: 'pending' },
        context: { skipTransitionGuard: true },
        overrideAccess: true,
      })
      expect(updated.status).toBe('pending')
    })
  })
})
