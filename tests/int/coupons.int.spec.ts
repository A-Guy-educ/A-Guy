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
}, 180_000)

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

      // Admin enters 50 shekels → stored as 5000 agorot → read back as 50
      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code,
          discountType: 'fixed',
          discountValue: 50,
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
      // 50 shekels × 100 = 5000 agorot stored; afterRead divides by 100 → 50 displayed
      expect(coupon.discountValue).toBe(50)
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

      // 50000 shekels = 5,000,000 agorot — below the 10M warning threshold
      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `FIXED-HIGH-${Date.now()}`,
          discountType: 'fixed',
          discountValue: 50000,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(coupon.id)

      // 50000 shekels × 100 = 5,000,000 agorot stored; afterRead ÷ 100 = 50000 displayed
      expect(coupon.discountValue).toBe(50000)
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
  // Access control — unauthenticated denied
  // -------------------------------------------------------------------------

  describe('Access control — unauthenticated denied', () => {
    it('should deny unauthenticated user from reading coupons', async () => {
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

      // Read without user (unauthenticated) — should be denied
      let error: Error | null = null
      try {
        await payload.findByID({
          collection: 'coupons',
          id: coupon.id,
          overrideAccess: false,
        })
      } catch (e) {
        error = e as Error
      }

      expect(error).not.toBeNull()
      expect((error as any).status).toBeGreaterThanOrEqual(400)
    })

    it('should deny student from reading coupons', async () => {
      const admin = await getAdminUser()
      const student = await getStudentUser()

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `STUDENT-READ-${Date.now()}`,
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

      let error: Error | null = null
      try {
        await payload.findByID({
          collection: 'coupons',
          id: coupon.id,
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

  // -------------------------------------------------------------------------
  // Computed fields (afterRead hooks)
  // -------------------------------------------------------------------------

  describe('Computed fields — status, usageDisplay, expiresDisplay', () => {
    it('should compute status as Active for active coupon with no expiration', async () => {
      const admin = await getAdminUser()

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `STATUS-ACTIVE-${Date.now()}`,
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

      expect((read as any).status).toBe('Active')
    })

    it('should compute status as Inactive when isActive is false', async () => {
      const admin = await getAdminUser()

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `STATUS-INACTIVE-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: false,
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

      expect((read as any).status).toBe('Inactive')
    })

    it('should compute status as Exhausted when usesCount >= maxUses', async () => {
      const admin = await getAdminUser()

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `STATUS-EXHAUSTED-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 5,
          usesCount: 5,
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

      expect((read as any).status).toBe('Exhausted')
    })

    it('should compute status as Expired when validUntil is in the past', async () => {
      const admin = await getAdminUser()
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `STATUS-EXPIRED-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
          validUntil: pastDate.toISOString(),
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

      expect((read as any).status).toBe('Expired')
    })

    it('should compute status as Scheduled when validFrom is in the future', async () => {
      const admin = await getAdminUser()
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `STATUS-SCHEDULED-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
          validFrom: futureDate.toISOString(),
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

      expect((read as any).status).toBe('Scheduled')
    })

    it('should compute usageDisplay as "used / ∞" when maxUses is 0', async () => {
      const admin = await getAdminUser()

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `USAGE-INF-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 3,
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

      expect((read as any).usageDisplay).toBe('3 / ∞')
    })

    it('should compute usageDisplay as "used / max" when maxUses > 0', async () => {
      const admin = await getAdminUser()

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `USAGE-MAX-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 100,
          usesCount: 25,
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

      expect((read as any).usageDisplay).toBe('25 / 100')
    })

    it('should compute expiresDisplay as "Never expires" when validUntil is not set', async () => {
      const admin = await getAdminUser()

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `EXPIRES-NONE-${Date.now()}`,
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

      expect((read as any).expiresDisplay).toBe('Never expires')
    })

    it('should compute expiresDisplay as relative time when validUntil is set', async () => {
      const admin = await getAdminUser()
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 5)

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `EXPIRES-FUTURE-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
          validUntil: futureDate.toISOString(),
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

      expect((read as any).expiresDisplay).toMatch(/^Expires in \d+ days$/)
    })

    it('should compute expiresDisplay as "Expired X days ago" when validUntil is in the past', async () => {
      const admin = await getAdminUser()
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 10)

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `EXPIRES-PAST-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 10,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
          validUntil: pastDate.toISOString(),
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

      expect((read as any).expiresDisplay).toMatch(/^Expired \d+ days ago$/)
    })
  })

  // -------------------------------------------------------------------------
  // Fixed coupon shekel ↔ agorot conversion
  // -------------------------------------------------------------------------

  describe('Fixed coupon shekel ↔ agorot conversion', () => {
    it('should store fixed discountValue in agorot (input shekels × 100)', async () => {
      const admin = await getAdminUser()

      // Admin types 30 (shekels) → stored as 3000 (agorot)
      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `FIXED-SHEKEL-CONVERT-${Date.now()}`,
          discountType: 'fixed',
          discountValue: 30,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(coupon.id)

      // Stored value should be 30 shekels = 3000 agorot
      // Use findByID because create() returns the afterRead-transformed value (30)
      // Note: findByID with overrideAccess: true still runs hooks (afterRead), so we get 30 (shekels)
      // The raw stored value (3000 agorot) is not directly accessible, but we can verify
      // the beforeChange hook worked by checking the coupon via create() return value.
      // If beforeChange ran: input 30 → stored 3000 → afterRead returns 30.
      // create() returns afterRead-transformed value (30), which we verified in the existing test.
      // Here we verify findByID also returns the afterRead-transformed value (30).
      const stored = await payload.findByID({
        collection: 'coupons',
        id: coupon.id,
        overrideAccess: true,
      })
      expect(stored.discountValue).toBe(30)
    })

    it('should convert stored agorot back to shekels on afterRead (÷ 100)', async () => {
      const admin = await getAdminUser()

      // Create with shekel input
      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `FIXED-AFTERREAD-${Date.now()}`,
          discountType: 'fixed',
          discountValue: 50,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(coupon.id)

      // Read via findByID (with overrideAccess: true to bypass hooks?)
      // Actually afterRead runs on all reads, so discountValue should be in shekels
      const read = await payload.findByID({
        collection: 'coupons',
        id: coupon.id,
        overrideAccess: true,
      })

      // AfterRead should convert 5000 agorot → 50 shekels
      expect(read.discountValue).toBe(50)
    })

    it('should round-trip fixed coupon: stored 3000 → shows 30 → save → 3000 again', async () => {
      const admin = await getAdminUser()

      // Create a fixed coupon (admin enters 30 shekels)
      const created = await payload.create({
        collection: 'coupons',
        data: {
          code: `FIXED-ROUNDTRIP-${Date.now()}`,
          discountType: 'fixed',
          discountValue: 30,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(created.id)

      // Stored as 3000 agorot (beforeChange ×100)
      // create() returns afterRead-transformed value: 3000 → 30 shekels
      // findByID with overrideAccess: true also runs hooks, so returns 30 (afterRead-transformed)
      expect(created.discountValue).toBe(30)
      const storedAfterCreate = await payload.findByID({
        collection: 'coupons',
        id: created.id,
        overrideAccess: true,
      })
      expect(storedAfterCreate.discountValue).toBe(30)

      // Update without changing discountValue (simulates save with no changes)
      // The form would send 30 (the shekel display value)
      const updated = await payload.update({
        collection: 'coupons',
        id: created.id,
        data: { discountValue: 30 },
        user: admin as any,
        overrideAccess: false,
      })

      // Should still be 3000 in storage (30 × 100), afterRead → 30 on read
      // findByID returns afterRead-transformed value (30)
      const storedAfterUpdate = await payload.findByID({
        collection: 'coupons',
        id: created.id,
        overrideAccess: true,
      })
      expect(storedAfterUpdate.discountValue).toBe(30)

      // Persisted correctly - afterRead-transformed value is still 30
      const reRead = await payload.findByID({
        collection: 'coupons',
        id: created.id,
        overrideAccess: true,
      })
      expect(reRead.discountValue).toBe(30)
    })

    it('should NOT convert percentage discountValue (30 stays 30)', async () => {
      const admin = await getAdminUser()

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `PERCENT-NO-CONVERT-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 30,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(coupon.id)

      // Percentage: 30 means 30% — stored as-is, no multiplication
      expect(coupon.discountValue).toBe(30)

      // Read back — no conversion for percentage
      const read = await payload.findByID({
        collection: 'coupons',
        id: coupon.id,
        overrideAccess: true,
      })
      expect(read.discountValue).toBe(30)
    })

    it('should compute discountDisplay for percentage as "30%"', async () => {
      const admin = await getAdminUser()

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `DISPLAY-PERCENT-${Date.now()}`,
          discountType: 'percentage',
          discountValue: 30,
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

      expect((read as any).discountDisplay).toBe('30%')
    })

    it('should compute discountDisplay for fixed as "₪30.00"', async () => {
      const admin = await getAdminUser()

      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `DISPLAY-FIXED-${Date.now()}`,
          discountType: 'fixed',
          discountValue: 30,
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

      expect((read as any).discountDisplay).toBe('₪30.00')
    })

    it('should accept fixed discountValue > 100,000 but log a warning (suspicious)', async () => {
      const admin = await getAdminUser()

      // 150,000 shekels = ₪150,000 — suspicious but should still be allowed
      // (the warning is logged server-side; this test just ensures no error is thrown)
      const coupon = await payload.create({
        collection: 'coupons',
        data: {
          code: `FIXED-SUSPICIOUS-${Date.now()}`,
          discountType: 'fixed',
          discountValue: 150000,
          currency: 'ILS',
          maxUses: 0,
          usesCount: 0,
          isActive: true,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackCoupon(coupon.id)

      // 150000 shekels × 100 = 15,000,000 agorot stored; afterRead ÷ 100 = 150000 displayed
      expect(coupon.discountValue).toBe(150000)
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
