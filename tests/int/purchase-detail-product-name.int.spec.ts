// @vitest-environment node
/**
 * Bug #2373: Purchase detail shows 'Unknown Product' instead of product name
 *
 * The transaction detail page (/account/purchases/[transactionId]) fetches the
 * transaction with depth:0, so tx.product is a string ID (not a populated object).
 * The product name extraction:
 *   if (typeof tx.product === 'object' && tx.product !== null) { ... }
 * evaluates to false, leaving productName null and showing "Unknown Product".
 *
 * The fix is depth:1 so the product relationship is populated and the extraction works.
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
let originalDefaultTenantSlug: string | undefined

let userId: string
let transactionId: string
let productName = ''
let productSlug = ''

const TENANT_SLUG = `purchase-detail-test-tenant-${Date.now()}`
const USER_EMAIL = `purchase-detail-test-${Date.now()}@test.local`
const USER_PASSWORD = 'test-password-1234'

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  originalDefaultTenantSlug = process.env.DEFAULT_TENANT_SLUG

  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL
  process.env.DEFAULT_TENANT_SLUG = TENANT_SLUG

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Ensure the default tenant exists
  const existingTenants = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: TENANT_SLUG } },
    limit: 1,
    overrideAccess: true,
  })
  if (existingTenants.docs.length === 0) {
    await payload.create({
      collection: 'tenants',
      data: { name: TENANT_SLUG, slug: TENANT_SLUG, status: 'active' },
      overrideAccess: true,
    })
  }

  // Create user
  const user = await payload.create({
    collection: 'users',
    data: {
      email: USER_EMAIL,
      password: USER_PASSWORD,
      name: 'Purchase Detail Test User',
      role: AccountRole.Student,
    } as any,
    overrideAccess: true,
  })
  userId = user.id

  // Create product
  productName = `Test Course Product ${Date.now()}`
  productSlug = `test-product-${Date.now()}`
  const product = await payload.create({
    collection: 'products',
    data: {
      name: productName,
      slug: productSlug,
      billingType: 'one_time',
      price: 29900,
      currency: 'ILS',
      isActive: true,
    } as any,
    overrideAccess: true,
  })

  // Create transaction
  const tx = await payload.create({
    collection: 'transactions',
    data: {
      user: userId,
      product: product.id,
      provider: 'stripe',
      providerTransactionId: `cs_purchase_detail_test_${Date.now()}`,
      status: 'succeeded',
      amount: 29900,
      currency: 'ILS',
      tenant: (
        await payload.find({
          collection: 'tenants',
          where: { slug: { equals: TENANT_SLUG } },
          limit: 1,
          overrideAccess: true,
        })
      ).docs[0].id,
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

  if (originalDefaultTenantSlug !== undefined) {
    process.env.DEFAULT_TENANT_SLUG = originalDefaultTenantSlug
  } else {
    delete process.env.DEFAULT_TENANT_SLUG
  }
}, 120_000)

describe('Purchase detail page product name extraction (bug #2373)', () => {
  it('extracts productName from transaction at depth:1', async () => {
    // This mirrors what the detail page does at depth:1
    const tx = await payload.findByID({
      collection: 'transactions',
      id: transactionId,
      depth: 1, // ← this is what the detail page MUST use
      overrideAccess: true,
    })

    const extractedProductName =
      typeof tx.product === 'object' && tx.product !== null
        ? ((tx.product as { name?: string }).name ?? null)
        : null

    expect(extractedProductName).toBe(productName)
  })

  it('productName is null when transaction is fetched at depth:0 (the bug)', async () => {
    // This mirrors what the buggy detail page currently does
    const tx = await payload.findByID({
      collection: 'transactions',
      id: transactionId,
      depth: 0, // ← this is the bug: depth:0 leaves product as a string ID
      overrideAccess: true,
    })

    // At depth:0, tx.product is a string (the product ID), not an object
    const isObject = typeof tx.product === 'object' && tx.product !== null

    // This test documents the bug: with depth:0, the product field is NOT populated
    expect(isObject).toBe(false)
    expect(typeof tx.product).toBe('string')

    // The buggy extraction would fail to get the product name:
    const productNameAtDepth0 = isObject ? ((tx.product as { name?: string }).name ?? null) : null
    expect(productNameAtDepth0).toBeNull()
  })

  it('productSlug is also extracted correctly at depth:1', async () => {
    const tx = await payload.findByID({
      collection: 'transactions',
      id: transactionId,
      depth: 1,
      overrideAccess: true,
    })

    const extractedProductSlug =
      typeof tx.product === 'object' && tx.product !== null
        ? ((tx.product as { slug?: string }).slug ?? null)
        : null

    expect(extractedProductSlug).toBe(productSlug)
  })
})
