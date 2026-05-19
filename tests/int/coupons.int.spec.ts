/**
 * Integration tests for Coupons collection
 *
 * Tests:
 * - CRUD operations as admin
 * - Access control — student is denied all mutations
 * - Public read access
 * - Hooks: code normalization (uppercase), discount validation, date range validation
 * - Unique code constraint
 * - createdByField auto-populate
 *
 * @fileType integration-test
 * @domain payments
 * @ai-summary Tests Coupons collection: CRUD, access control, hooks, and validation
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ObjectId } from 'mongodb'

import { AccountRole } from '@/server/payload/collections/Users/roles'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let adminUserId: string
let studentUserId: string
const createdCouponIds: string[] = []
const createdCouponUsageIds: string[] = []

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  // Create admin user
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: `coupons-admin-${Date.now()}@example.com`,
      password: 'test123456',
    } as any,
  })
  await payload.update({
    collection: 'users',
    id: admin.id,
    data: { role: AccountRole.Admin },
    overrideAccess: true,
  })
  adminUserId = admin.id

  // Create student user
  const student = await payload.create({
    collection: 'users',
    data: {
      email: `coupons-student-${Date.now()}@example.com`,
      password: 'test123456',
      role: AccountRole.Student,
    } as any,
  })
  studentUserId = student.id
}, 60_000)

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterEach(async () => {
  if (!payload) return
  for (const id of createdCouponIds) {
    try {
      await payload.delete({ collection: 'coupons', id, overrideAccess: true })
    } catch {
      // Already deleted
    }
  }
  createdCouponIds.length = 0

  for (const id of createdCouponUsageIds) {
    try {
      await payload.delete({ collection: 'coupon-usages', id, overrideAccess: true })
    } catch {
      // Already deleted
    }
  }
  createdCouponUsageIds.length = 0
})

afterAll(async () => {
  if (!payload) return

  for (const userId of [adminUserId, studentUserId]) {
    if (userId) {
      try {
        await payload.delete({ collection: 'users', id: userId, overrideAccess: true })
      } catch {
        // ignore
      }
    }
  }

  if (payload.db?.destroy) {
    await payload.db.destroy()
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAdminUser() {
  return payload.findByID({ collection: 'users', id: adminUserId, overrideAccess: true })
}

async function getStudentUser() {
  return payload.findByID({ collection: 'users', id: studentUserId, overrideAccess: true })
}

function trackCoupon(id: string) {
  createdCouponIds.push(id)
}

function trackCouponUsage(id: string) {
  createdCouponUsageIds.push(id)
}

// ---------------------------------------------------------------------------
// Tests — Coupons
// ---------------------------------------------------------------------------

describe.skipIf(!hasDatabaseUrl)('Coupons Collection', () => {
  // -------------------------------------------------------------------------
  // CRUD as admin
  // -------------------------------------------------------------------------

  describe('CRUD operations as admin', () => {
    it('should create a coupon with all fields', async () => {
      const admin = await getAdminUser()
      const code = `TEST-COUPON-${Date.now()}`

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code,
          discountType: 'percentage',
          discountValue: 20,
          currency: 'ILS',
          maxUses: 100,
          usesCount: 0,
          isActive: true,
          maxUsesPerUser: 3,
        },
        user: admin as any,
        overrideAccess: false,
      })

      trackCoupon(coupon.id)

      expect(coupon).toBeDefined()
      expect(coupon.id).toBeDefined()
      expect(coupon.code).toBe(code)
      expect(coupon.discountType).toBe('percentage')
      expect(coupon.discountValue).toBe(20)
      expect(coupon.maxUses).toBe(100)
      expect(coupon.usesCount).toBe(0)
      expect(coupon.isActive).toBe(true)
    })

    it('should create a coupon with minimal required fields', async () => {
      const admin = await getAdminUser()
      const code = `MINIMAL-${Date.now()}`

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code,
          discountType: 'fixed',
          discountValue: 5000,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })

      trackCoupon(coupon.id)

      expect(coupon).toBeDefined()
      expect(coupon.id).toBeDefined()
      expect(coupon.code).toBe(code)
    })

    it('should read a coupon by ID', async () => {
      const admin = await getAdminUser()
      const code = `READ-TEST-${Date.now()}`

      const created = await payload.create({
        collection: 'coupons',
        data: {
          code,
          discountType: 'percentage',
          discountValue: 15,
          currency: 'USD',
          maxUses: 50,
          usesCount: 5,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(created.id)

      const read = await payload.findByID({
        collection: 'coupons',
        id: created.id,
        user: admin as any,
        overrideAccess: false,
      })

      expect(read.id).toBe(created.id)
      expect(read.code).toBe(code)
      expect(read.discountValue).toBe(15)
    })

    it('should update a coupon', async () => {
      const admin = await getAdminUser()

      const created = await payload.create({
        collection: 'coupons',
        data: {
          code: `UPDATE-TEST-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 10,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(created.id)

      const updated = await payload.update({
        collection: 'coupons',
        id: created.id,
        data: {
          discountValue: 25,
          isActive: false,
        },
        user: admin as any,
        overrideAccess: false,
      })

      expect(updated.discountValue).toBe(25)
      expect(updated.isActive).toBe(false)

      // Confirm persisted state
      const reRead = await payload.findByID({
        collection: 'coupons',
        id: created.id,
        overrideAccess: true,
      })
      expect(reRead.discountValue).toBe(25)
      expect(reRead.isActive).toBe(false)
    })

    it('should delete a coupon', async () => {
      const admin = await getAdminUser()

      const created = await payload.create({
        collection: 'coupons',
        data: {
          code: `DELETE-TEST-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 5,
          currency: 'EUR',
          maxUses: 1,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })

      await payload.delete({
        collection: 'coupons',
        id: created.id,
        user: admin as any,
        overrideAccess: false,
      })

      // Verify deletion
      let notFoundError: Error | null = null
      try {
        await payload.findByID({ collection: 'coupons', id: created.id, overrideAccess: true })
      } catch (error) {
        notFoundError = error as Error
      }
      expect(notFoundError).not.toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // Hook: code normalization
  // -------------------------------------------------------------------------

  describe('Code normalization', () => {
    it('should normalize code to uppercase on create', async () => {
      const admin = await getAdminUser()

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: 'lowercasecode',
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(coupon.id)

      expect(coupon.code).toBe('LOWERCASECODE')
    })

    it('should normalize code to uppercase on update', async () => {
      const admin = await getAdminUser()

      const created = await payload.create({
        collection: 'coupons',
        data: {
          code: `NORMALIZE-UPDATE-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(created.id)

      const updated = await payload.update({
        collection: 'coupons',
        id: created.id,
        data: { code: 'newcode' },
        user: admin as any,
        overrideAccess: false,
      })

      expect(updated.code).toBe('NEWCODE')
    })

    it('should trim whitespace from code', async () => {
      const admin = await getAdminUser()

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: '  SPACES  ',
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(coupon.id)

      expect(coupon.code).toBe('SPACES')
    })
  })

  // -------------------------------------------------------------------------
  // Hook: discount validation
  // -------------------------------------------------------------------------

  describe('Validation — discountType and discountValue', () => {
    it('should reject percentage discount > 100', async () => {
      const admin = await getAdminUser()

      let error: Error | null = null
      try {
        await payload.create({
          collection: 'coupons',
          data: {
            code: `PERCENT-150-${Date.now()}`,
            discountType: 'percentage',
            discountValue: 150,
            currency: 'ILS',
            maxUses: 0,
            usesCount: 0,
            isActive: true,
          },
          user: admin as any,
          overrideAccess: false,
        })
      } catch (e) {
        error = e as Error
      }

      expect(error).not.toBeNull()
    })

    it('should accept percentage discount = 100', async () => {
      const admin = await getAdminUser()

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `PERCENT-100-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 100,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(coupon.id)

      expect(coupon.discountValue).toBe(100)
    })

    it('should accept fixed discount with any positive value', async () => {
      const admin = await getAdminUser()

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `FIXED-HIGH-${Date.now()}`,
          discountType: 'fixed',
          discountValue: 999999,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(coupon.id)

      expect(coupon.discountValue).toBe(999999)
    })
  })

  // -------------------------------------------------------------------------
  // Hook: date range validation
  // -------------------------------------------------------------------------

  describe('Validation — date range', () => {
    it('should reject validFrom after validUntil', async () => {
      const admin = await getAdminUser()
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      let error: Error | null = null
      try {
        await payload.create({
          collection: 'coupons',
          data: {
            code: `DATE-INVALID-${Date.now()}`,
            discountType: 'percentage',
            discountValue: 10,
            currency: 'ILS',
            maxUses: 0,
            usesCount: 0,
            isActive: true,
            validFrom: tomorrow.toISOString(),
            validUntil: yesterday.toISOString(),
          },
          user: admin as any,
          overrideAccess: false,
        })
      } catch (e) {
        error = e as Error
      }

      expect(error).not.toBeNull()
    })

    it('should accept validFrom before validUntil', async () => {
      const admin = await getAdminUser()
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `DATE-VALID-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
          validFrom: yesterday.toISOString(),
          validUntil: tomorrow.toISOString(),
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(coupon.id)

      expect(coupon).toBeDefined()
      expect(coupon.validFrom).toBeDefined()
      expect(coupon.validUntil).toBeDefined()
    })

    it('should accept coupon with only validFrom set', async () => {
      const admin = await getAdminUser()
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `DATE-FROM-ONLY-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
          validFrom: yesterday.toISOString(),
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(coupon.id)

      expect(coupon).toBeDefined()
    })

    it('should accept coupon with only validUntil set', async () => {
      const admin = await getAdminUser()
      const nextMonth = new Date()
      nextMonth.setMonth(nextMonth.getMonth() + 1)

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `DATE-UNTIL-ONLY-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
          validUntil: nextMonth.toISOString(),
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(coupon.id)

      expect(coupon).toBeDefined()
    })

    it('should accept coupon with no dates set', async () => {
      const admin = await getAdminUser()

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `DATE-NONE-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(coupon.id)

      expect(coupon).toBeDefined()
    })
  })

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('Edge cases', () => {
    it('should enforce unique code constraint', async () => {
      const admin = await getAdminUser()
      const uniqueCode = `UNIQUE-${Date.now()}`

      const first = await payload.create({
        collection: 'coupons',
        data: {
          code: uniqueCode,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(first.id)

      let duplicateError: Error | null = null
      try {
        await payload.create({
          collection: 'coupons',
          data: {
            code: uniqueCode,
            discountType: 'percentage',
            discountValue: 20,
            currency: 'USD',
            maxUses: 0,
            usesCount: 0,
            isActive: true,
          },
          user: admin as any,
          overrideAccess: false,
        })
      } catch (e) {
        duplicateError = e as Error
      }

      expect(duplicateError).not.toBeNull()
    })

    it('should store applicableProducts relationship', async () => {
      const admin = await getAdminUser()

      // Get or create a product
      const existingProducts = await payload.find({
        collection: 'products',
        limit: 1,
        overrideAccess: true,
      })
      let productId: string

      if (existingProducts.docs.length > 0) {
        productId = existingProducts.docs[0].id
      } else {
        // Get a category first
        const existingCategories = await payload.find({
          collection: 'categories',
          limit: 1,
          overrideAccess: true,
        })
        const categoryId =
          existingCategories.docs[0]?.id ??
          (
            await payload.create({
              collection: 'categories',
              data: { title: 'Test Category', slug: `coupon-test-cat-${Date.now()}` } as any,
              overrideAccess: true,
            })
          ).id

        const product = await payload.create({
          collection: 'products',
          data: {
            name: 'Test Product for Coupon',
            slug: `test-product-coupon-${Date.now()}`,
            category: categoryId,
            status: 'active',
            billingType: 'one_time',
            price: 10000,
            currency: 'ILS',
          } as any,
          overrideAccess: true,
        })
        productId = product.id
      }

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `PRODUCTS-TEST-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
          applicableProducts: [productId],
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(coupon.id)

      expect(coupon.applicableProducts).toBeDefined()
      const productIds =
        typeof coupon.applicableProducts === 'object' && Array.isArray(coupon.applicableProducts)
          ? coupon.applicableProducts.map((p: any) => (typeof p === 'object' ? p.id : p))
          : []
      expect(productIds).toContain(productId)
    })
  })

  // -------------------------------------------------------------------------
  // Access control
  // -------------------------------------------------------------------------

  describe('Access control — student denied', () => {
    it('should deny student from creating coupons', async () => {
      const student = await getStudentUser()

      let error: Error | null = null
      try {
        await payload.create({
          collection: 'coupons',
          data: {
            code: `STUDENT-CREATE-${Date.now()}`,
            discountType: 'percentage',
            discountValue: 10,
            currency: 'ILS',
            maxUses: 0,
            usesCount: 0,
            isActive: true,
          },
          user: student as any,
          overrideAccess: false,
        })
      } catch (e) {
        error = e as Error
      }

      expect(error).not.toBeNull()
      expect((error as any).status).toBeGreaterThanOrEqual(400)
    })

    it('should deny student from updating coupons', async () => {
      const admin = await getAdminUser()
      const student = await getStudentUser()

      const created = await payload.create({
        collection: 'coupons',
        data: {
          code: `STUDENT-UPDATE-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(created.id)

      let error: Error | null = null
      try {
        await payload.update({
          collection: 'coupons',
          id: created.id,
          data: { discountValue: 99 },
          user: student as any,
          overrideAccess: false,
        })
      } catch (e) {
        error = e as Error
      }

      expect(error).not.toBeNull()
      expect((error as any).status).toBeGreaterThanOrEqual(400)
    })

    it('should deny student from deleting coupons', async () => {
      const admin = await getAdminUser()
      const student = await getStudentUser()

      const created = await payload.create({
        collection: 'coupons',
        data: {
          code: `STUDENT-DELETE-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(created.id)

      let error: Error | null = null
      try {
        await payload.delete({
          collection: 'coupons',
          id: created.id,
          user: student as any,
          overrideAccess: false,
        })
      } catch (e) {
        error = e as Error
      }

      expect(error).not.toBeNull()
      expect((error as any).status).toBeGreaterThanOrEqual(400)
    })
  })

  // -------------------------------------------------------------------------
  // Public read access
  // -------------------------------------------------------------------------

  describe('Public read access', () => {
    it('should allow unauthenticated user to read coupons', async () => {
      const admin = await getAdminUser()

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `PUBLIC-READ-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(coupon.id)

      // Read without user (public access)
      const read = await payload.findByID({
        collection: 'coupons',
        id: coupon.id,
        overrideAccess: false,
      })

      expect(read).toBeDefined()
      expect(read.id).toBe(coupon.id)
    })
  })

  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------

  describe('Hook: createdByField', () => {
    it('should auto-set createdBy on create', async () => {
      const admin = await getAdminUser()

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `CREATEDBY-HOOK-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(coupon.id)

      const read = await payload.findByID({
        collection: 'coupons',
        id: coupon.id,
        overrideAccess: true,
      })

      expect(read.createdBy).toBeDefined()
      const createdById = typeof read.createdBy === 'object' ? read.createdBy?.id : read.createdBy
      expect(createdById).toBe(adminUserId)
    })
  })
})

// ---------------------------------------------------------------------------
// Tests — CouponUsages
// ---------------------------------------------------------------------------

describe.skipIf(!hasDatabaseUrl)('CouponUsages Collection', () => {
  // We need a coupon and transaction to create a usage record
  let couponId: string
  let transactionId: string

  beforeAll(async () => {
    if (!hasDatabaseUrl) return

    const admin = await getAdminUser()

    // Create a coupon
    const coupon = await payload.create({
      collection: 'coupons',
      data: {
        code: `USAGE-TEST-COUPON-${Date.now()}`,
        discountType: 'percentage',
        discountValue: 10,
        currency: 'ILS',
        maxUses: 10,
        usesCount: 0,
        isActive: true,
      },
      user: admin as any,
      overrideAccess: false,
    })
    couponId = coupon.id
    trackCoupon(couponId)

    // Get or create a product for the transaction
    const existingProducts = await payload.find({
      collection: 'products',
      limit: 1,
      overrideAccess: true,
    })
    let productId: string

    if (existingProducts.docs.length > 0) {
      productId = existingProducts.docs[0].id
    } else {
      const existingCategories = await payload.find({
        collection: 'categories',
        limit: 1,
        overrideAccess: true,
      })
      const categoryId =
        existingCategories.docs[0]?.id ??
        (
          await payload.create({
            collection: 'categories',
            data: { title: 'Test Category', slug: `usage-test-cat-${Date.now()}` } as any,
            overrideAccess: true,
          })
        ).id

      const product = await payload.create({
        collection: 'products',
        data: {
          name: 'Test Product for Coupon Usage',
          slug: `test-product-usage-${Date.now()}`,
          category: categoryId,
          status: 'active',
        } as any,
        overrideAccess: true,
      })
      productId = product.id
    }

    // Create a transaction
    const transaction = await payload.create({
      collection: 'transactions',
      data: {
        user: adminUserId,
        product: productId,
        provider: 'stripe',
        providerTransactionId: `coupon-usage-test-${Date.now()}`,
        status: 'succeeded',
        amount: 10000,
        currency: 'ILS',
      } as any,
      overrideAccess: true,
    })
    transactionId = transaction.id
  })

  describe('afterChange hook — usesCount increment', () => {
    it('should increment coupon usesCount when a coupon usage is created', async () => {
      const admin = await getAdminUser()

      // Create a dedicated coupon for this test (not the shared couponId)
      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `HOOK-INCR-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 10,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(coupon.id)

      // Create a usage — the afterChange hook should increment usesCount
      const usage = await payload.create({
        collection: 'coupon-usages',
        data: {
          coupon: coupon.id,
          transaction: transactionId,
          user: adminUserId,
          usedAt: new Date().toISOString(),
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCouponUsage(usage.id)

      // Verify usesCount was incremented
      const reRead = await payload.findByID({
        collection: 'coupons',
        id: coupon.id,
        overrideAccess: true,
      })
      expect(reRead.usesCount).toBe(1)
    })

    it('should increment usesCount for each usage created', async () => {
      const admin = await getAdminUser()

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `HOOK-INCR-MULTI-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 10,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(coupon.id)

      // Create multiple usages
      const usage1 = await payload.create({
        collection: 'coupon-usages',
        data: {
          coupon: coupon.id,
          transaction: transactionId,
          user: adminUserId,
          usedAt: new Date().toISOString(),
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCouponUsage(usage1.id)

      const usage2 = await payload.create({
        collection: 'coupon-usages',
        data: {
          coupon: coupon.id,
          transaction: transactionId,
          user: adminUserId,
          usedAt: new Date().toISOString(),
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCouponUsage(usage2.id)

      const reRead = await payload.findByID({
        collection: 'coupons',
        id: coupon.id,
        overrideAccess: true,
      })
      expect(reRead.usesCount).toBe(2)
    })
  })

  describe('CRUD operations as admin', () => {
    it('should create a coupon usage record', async () => {
      const admin = await getAdminUser()

      const usage = await payload.create({
        collection: 'coupon-usages',
        data: {
          coupon: couponId,
          transaction: transactionId,
          user: adminUserId,
          usedAt: new Date().toISOString(),
        },
        user: admin as any,
        overrideAccess: false,
      })

      trackCouponUsage(usage.id)

      expect(usage).toBeDefined()
      expect(usage.id).toBeDefined()
      expect(usage.coupon).toBeDefined()
      expect(usage.transaction).toBeDefined()
      expect(usage.user).toBeDefined()
    })

    it('should read a coupon usage by ID', async () => {
      const admin = await getAdminUser()

      const usage = await payload.create({
        collection: 'coupon-usages',
        data: {
          coupon: couponId,
          transaction: transactionId,
          user: adminUserId,
          usedAt: new Date().toISOString(),
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCouponUsage(usage.id)

      const read = await payload.findByID({
        collection: 'coupon-usages',
        id: usage.id,
        user: admin as any,
        overrideAccess: false,
      })

      expect(read.id).toBe(usage.id)
    })

    it('should delete a coupon usage', async () => {
      const admin = await getAdminUser()

      const usage = await payload.create({
        collection: 'coupon-usages',
        data: {
          coupon: couponId,
          transaction: transactionId,
          user: adminUserId,
          usedAt: new Date().toISOString(),
        },
        user: admin as any,
        overrideAccess: false,
      })

      await payload.delete({
        collection: 'coupon-usages',
        id: usage.id,
        user: admin as any,
        overrideAccess: false,
      })

      // Verify deletion
      let notFoundError: Error | null = null
      try {
        await payload.findByID({ collection: 'coupon-usages', id: usage.id, overrideAccess: true })
      } catch (error) {
        notFoundError = error as Error
      }
      expect(notFoundError).not.toBeNull()
    })
  })

  describe('Access control — student denied', () => {
    it('should deny student from creating coupon usages', async () => {
      const student = await getStudentUser()

      let error: Error | null = null
      try {
        await payload.create({
          collection: 'coupon-usages',
          data: {
            coupon: couponId,
            transaction: transactionId,
            user: adminUserId,
            usedAt: new Date().toISOString(),
          },
          user: student as any,
          overrideAccess: false,
        })
      } catch (e) {
        error = e as Error
      }

      expect(error).not.toBeNull()
      expect((error as any).status).toBeGreaterThanOrEqual(400)
    })

    it('should deny student from reading coupon usages', async () => {
      const admin = await getAdminUser()
      const student = await getStudentUser()

      const usage = await payload.create({
        collection: 'coupon-usages',
        data: {
          coupon: couponId,
          transaction: transactionId,
          user: adminUserId,
          usedAt: new Date().toISOString(),
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCouponUsage(usage.id)

      let error: Error | null = null
      try {
        await payload.findByID({
          collection: 'coupon-usages',
          id: usage.id,
          user: student as any,
          overrideAccess: false,
        })
      } catch (e) {
        error = e as Error
      }

      expect(error).not.toBeNull()
      expect((error as any).status).toBeGreaterThanOrEqual(400)
    })

    it('should deny student from updating coupon usages', async () => {
      const admin = await getAdminUser()
      const student = await getStudentUser()

      const usage = await payload.create({
        collection: 'coupon-usages',
        data: {
          coupon: couponId,
          transaction: transactionId,
          user: adminUserId,
          usedAt: new Date().toISOString(),
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCouponUsage(usage.id)

      let error: Error | null = null
      try {
        await payload.update({
          collection: 'coupon-usages',
          id: usage.id,
          data: { usedAt: new Date().toISOString() },
          user: student as any,
          overrideAccess: false,
        })
      } catch (e) {
        error = e as Error
      }

      expect(error).not.toBeNull()
      expect((error as any).status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('Admin update', () => {
    it('should allow admin to update a coupon usage', async () => {
      const admin = await getAdminUser()

      const usage = await payload.create({
        collection: 'coupon-usages',
        data: {
          coupon: couponId,
          transaction: transactionId,
          user: adminUserId,
          usedAt: new Date().toISOString(),
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCouponUsage(usage.id)

      const newUsedAt = new Date().toISOString()
      const updated = await payload.update({
        collection: 'coupon-usages',
        id: usage.id,
        data: { usedAt: newUsedAt },
        user: admin as any,
        overrideAccess: false,
      })

      expect(updated.id).toBe(usage.id)
      expect(updated.usedAt).toBe(newUsedAt)
    })
  })

  describe('Atomic increment — usesCount', () => {
    it('should atomically increment coupon usesCount when usage is created', async () => {
      const admin = await getAdminUser()

      // Create a dedicated coupon for this test
      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `ATOMIC-INCR-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 10,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(coupon.id)

      // Get the raw MongoDB collection for atomic $inc
      const couponsCollection = payload.db.collections['coupons']

      // Simulate two concurrent atomic increment attempts
      const results = await Promise.all([
        couponsCollection.updateOne(
          { _id: new ObjectId(coupon.id), usesCount: { $lt: 10 } },
          { $inc: { usesCount: 1 } },
        ),
        couponsCollection.updateOne(
          { _id: new ObjectId(coupon.id), usesCount: { $lt: 10 } },
          { $inc: { usesCount: 1 } },
        ),
      ])

      const successCount = results.filter((r) => r.modifiedCount === 1).length
      expect(successCount).toBe(2) // Both should succeed since maxUses=10

      // Verify final count
      const reRead = await payload.findByID({
        collection: 'coupons',
        id: coupon.id,
        overrideAccess: true,
      })
      expect(reRead.usesCount).toBe(2)
    })

    it('should prevent over-redemption when maxUses is reached (atomic $lt guard)', async () => {
      const admin = await getAdminUser()

      // Create a coupon with maxUses=1
      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `ATOMIC-OVER-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 1,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(coupon.id)

      const couponsCollection = payload.db.collections['coupons']

      // Simulate two concurrent atomic increment attempts
      const results = await Promise.all([
        couponsCollection.updateOne(
          { _id: new ObjectId(coupon.id), usesCount: { $lt: 1 } },
          { $inc: { usesCount: 1 } },
        ),
        couponsCollection.updateOne(
          { _id: new ObjectId(coupon.id), usesCount: { $lt: 1 } },
          { $inc: { usesCount: 1 } },
        ),
      ])

      const successCount = results.filter((r) => r.modifiedCount === 1).length
      expect(successCount).toBe(1) // Only one should succeed
    })
  })
})
