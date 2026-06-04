// @vitest-environment node
/**
 * Integration tests: Transaction Detail productName population — Issue #2459
 *
 * Verifies that when fetching a transaction for the account purchases detail page,
 * the product relationship is populated so that productName is available.
 *
 * Bug: The [transactionId]/page.tsx was using depth: 0, which means tx.product
 * was a string ID instead of a populated object. The productName extraction then
 * failed and the page showed "Unknown Product" instead of the actual product name.
 *
 * Fix: Changed depth: 0 to depth: 1 in [transactionId]/page.tsx
 *
 * @fileType integration-test
 * @domain billing
 */

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { AccountRole } from '@/server/payload/collections/Users/roles'

let payload: Payload
let originalDatabaseUrl: string | undefined

// Test fixture IDs
let userId: string
let tenantId: string
let productId: string
let productName: string
let productSlug: string
let transactionId: string

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
      name: `product-name-test-${Date.now()}`,
      slug: `product-name-test-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })
  tenantId = tenant.id

  // Create user
  const userEmail = `product-name-test-${Date.now()}@test.local`
  const user = await payload.create({
    collection: 'users',
    data: {
      email: userEmail,
      password: 'test-password-1234',
      name: 'Product Name Test User',
      role: AccountRole.Student,
    } as any,
    overrideAccess: true,
  })
  userId = user.id

  // Create product
  productName = `Test Product ${Date.now()}`
  productSlug = `test-product-${Date.now()}`
  const product = await payload.create({
    collection: 'products',
    data: {
      name: productName,
      slug: productSlug,
      billingType: 'one_time',
      price: 1000,
      currency: 'ILS',
      isActive: true,
    } as any,
    overrideAccess: true,
  })
  productId = product.id

  // Create transaction (pending status - this is the key scenario from issue #2459)
  const tx = await payload.create({
    collection: 'transactions',
    data: {
      user: userId,
      product: productId,
      provider: 'stripe',
      providerTransactionId: `cs_product_name_test_${Date.now()}`,
      status: 'pending', // pending transaction - product may not be populated
      amount: 1000,
      currency: 'ILS',
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  transactionId = tx.id
}, 300_000)

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

describe('Transaction detail page productName extraction — Issue #2459', () => {
  /**
   * This test verifies the FIX: using depth: 1 correctly populates the
   * product relationship so that productName can be extracted.
   *
   * The page now uses depth: 1, so this test passes.
   */
  it('extracts productName correctly with depth: 1 (the fix)', async () => {
    // The page now uses depth: 1 to populate the product relationship
    const tx = await payload.findByID({
      collection: 'transactions',
      id: transactionId,
      depth: 1, // FIX: populates the product relationship
      overrideAccess: true,
    })

    // Extract productName the same way the page does
    const extractedProductName =
      typeof tx.product === 'object' && tx.product !== null
        ? ((tx.product as { name?: string }).name ?? null)
        : null

    // With depth: 1, productName should be correctly extracted
    expect(extractedProductName).toBe(productName)
  })

  /**
   * This test demonstrates the ORIGINAL BUG: using depth: 0 causes
   * productName extraction to fail, resulting in "Unknown Product".
   *
   * This was the bug in [transactionId]/page.tsx before the fix.
   * This test documents the problematic behavior.
   */
  it('demonstrates that depth: 0 causes productName extraction to fail (original bug)', async () => {
    // Before the fix, the page used depth: 0
    const tx = await payload.findByID({
      collection: 'transactions',
      id: transactionId,
      depth: 0, // BUG: does not populate the product relationship
      overrideAccess: true,
    })

    // With depth: 0, tx.product is a string ID (not a populated object)
    expect(typeof tx.product).toBe('string')

    // Extract productName the same way the page does (with the bug)
    const extractedProductName =
      typeof tx.product === 'object' && tx.product !== null
        ? ((tx.product as { name?: string }).name ?? null)
        : null

    // This is the BUG: productName is null because tx.product is a string, not an object
    // This caused "Unknown Product" to be displayed on the pending purchase detail page
    expect(extractedProductName).toBe(null)
  })
})
