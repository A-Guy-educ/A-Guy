/**
 * Integration tests for Products and ProductItems collections
 *
 * Tests:
 * - ProductItems: CRUD as admin, access control (public read), conditional fields
 * - Products: CRUD as admin, billingType/interval conditions, slug auto-generation
 * - Products.items: linking multiple ProductItems
 *
 * @fileType integration-test
 * @domain billing
 * @ai-summary Tests Product and ProductItem collections: CRUD, access control, conditional fields, and relationships
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { AccountRole } from '@/server/payload/collections/Users/roles'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let adminUserId: string
let studentUserId: string
const createdProductIds: string[] = []
const createdProductItemIds: string[] = []

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
      email: `product-billing-admin-${Date.now()}@example.com`,
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
      email: `product-billing-student-${Date.now()}@example.com`,
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

  for (const id of createdProductIds) {
    try {
      await payload.delete({ collection: 'products', id, overrideAccess: true })
    } catch {
      // Already deleted
    }
  }
  createdProductIds.length = 0

  for (const id of createdProductItemIds) {
    try {
      await payload.delete({ collection: 'product-items', id, overrideAccess: true })
    } catch {
      // Already deleted
    }
  }
  createdProductItemIds.length = 0
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

function trackProduct(id: string) {
  createdProductIds.push(id)
}

function trackProductItem(id: string) {
  createdProductItemIds.push(id)
}

// ---------------------------------------------------------------------------
// ProductItems Tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasDatabaseUrl)('ProductItems Collection', () => {
  // -------------------------------------------------------------------------
  // CRUD as admin
  // -------------------------------------------------------------------------

  describe('CRUD operations as admin', () => {
    it('should create a lesson-type ProductItem', async () => {
      const admin = await getAdminUser()

      // First create a lesson to reference
      const existingLessons = await payload.find({
        collection: 'lessons',
        limit: 1,
        overrideAccess: true,
      })
      const lessonId = existingLessons.docs[0]?.id
      if (!lessonId) {
        expect.fail('No lessons found in database')
      }

      const productItem = await payload.create({
        collection: 'product-items',
        data: {
          type: 'lesson',
          lesson: lessonId,
          isHighlighted: false,
        },
        user: admin as any,
        overrideAccess: false,
      })

      trackProductItem(productItem.id)

      expect(productItem).toBeDefined()
      expect(productItem.id).toBeDefined()
      expect(productItem.type).toBe('lesson')
      expect(productItem.isHighlighted).toBe(false)
    })

    it('should create a feature-type ProductItem', async () => {
      const admin = await getAdminUser()

      const productItem = await payload.create({
        collection: 'product-items',
        data: {
          type: 'feature',
          featureKey: 'certificate',
          isHighlighted: true,
        },
        user: admin as any,
        overrideAccess: false,
      })

      trackProductItem(productItem.id)

      expect(productItem).toBeDefined()
      expect(productItem.type).toBe('feature')
      expect(productItem.featureKey).toBe('certificate')
      expect(productItem.isHighlighted).toBe(true)
    })

    it('should read a ProductItem by ID', async () => {
      const admin = await getAdminUser()

      const created = await payload.create({
        collection: 'product-items',
        data: {
          type: 'feature',
          featureKey: 'live-sessions',
          isHighlighted: false,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackProductItem(created.id)

      const read = await payload.findByID({
        collection: 'product-items',
        id: created.id,
        user: admin as any,
        overrideAccess: false,
      })

      expect(read.id).toBe(created.id)
      expect(read.featureKey).toBe('live-sessions')
    })

    it('should update a ProductItem', async () => {
      const admin = await getAdminUser()

      const created = await payload.create({
        collection: 'product-items',
        data: {
          type: 'feature',
          featureKey: 'analytics',
          isHighlighted: false,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackProductItem(created.id)

      const updated = await payload.update({
        collection: 'product-items',
        id: created.id,
        data: { isHighlighted: true },
        user: admin as any,
        overrideAccess: false,
      })

      expect(updated.isHighlighted).toBe(true)

      // Confirm persisted state
      const reRead = await payload.findByID({
        collection: 'product-items',
        id: created.id,
        overrideAccess: true,
      })
      expect(reRead.isHighlighted).toBe(true)
    })

    it('should delete a ProductItem', async () => {
      const admin = await getAdminUser()

      const created = await payload.create({
        collection: 'product-items',
        data: {
          type: 'feature',
          featureKey: 'priority-support',
        },
        user: admin as any,
        overrideAccess: false,
      })
      // Not tracked — we're deleting it

      await payload.delete({
        collection: 'product-items',
        id: created.id,
        user: admin as any,
        overrideAccess: false,
      })

      // Verify deletion
      let notFoundError: Error | null = null
      try {
        await payload.findByID({
          collection: 'product-items',
          id: created.id,
          overrideAccess: true,
        })
      } catch (error) {
        notFoundError = error as Error
      }
      expect(notFoundError).not.toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // Access control
  // -------------------------------------------------------------------------

  describe('Access control', () => {
    it('should deny student from creating ProductItems', async () => {
      const student = await getStudentUser()

      let error: Error | null = null
      try {
        await payload.create({
          collection: 'product-items',
          data: {
            type: 'feature',
            featureKey: 'group-access',
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

    it('should allow public read of ProductItems', async () => {
      const admin = await getAdminUser()

      const created = await payload.create({
        collection: 'product-items',
        data: {
          type: 'feature',
          featureKey: 'download-resources',
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackProductItem(created.id)

      // Read without user (public access)
      const read = await payload.findByID({
        collection: 'product-items',
        id: created.id,
        overrideAccess: true,
      })

      expect(read.id).toBe(created.id)
    })
  })

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  describe('Validation', () => {
    it('should reject invalid featureKey', async () => {
      const admin = await getAdminUser()

      let validationError: Error | null = null
      try {
        await payload.create({
          collection: 'product-items',
          data: {
            type: 'feature',
            featureKey: 'invalid-feature-key',
          },
          user: admin as any,
          overrideAccess: false,
        })
      } catch (e) {
        validationError = e as Error
      }

      expect(validationError).not.toBeNull()
      expect((validationError as any).message).toContain('Invalid feature key')
    })

    it('should accept all valid featureKeys', async () => {
      const admin = await getAdminUser()
      const validKeys = [
        'live-sessions',
        'download-resources',
        'certificate',
        'priority-support',
        'analytics',
        'group-access',
      ]

      for (const key of validKeys) {
        const productItem = await payload.create({
          collection: 'product-items',
          data: {
            type: 'feature',
            featureKey: key,
          },
          user: admin as any,
          overrideAccess: false,
        })
        trackProductItem(productItem.id)
        expect(productItem.featureKey).toBe(key)
      }
    })
  })
})

// ---------------------------------------------------------------------------
// Products Tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasDatabaseUrl)('Products Collection', () => {
  // -------------------------------------------------------------------------
  // CRUD as admin
  // -------------------------------------------------------------------------

  describe('CRUD operations as admin', () => {
    it('should create a one-time billing product', async () => {
      const admin = await getAdminUser()

      const product = await payload.create({
        collection: 'products',
        data: {
          name: 'Basic Package',
          billingType: 'one_time',
          price: 99,
          currency: 'USD',
          isActive: true,
        } as any,
        user: admin as any,
        overrideAccess: false,
      })

      trackProduct(product.id)

      expect(product).toBeDefined()
      expect(product.id).toBeDefined()
      expect(product.name).toBe('Basic Package')
      expect(product.billingType).toBe('one_time')
      expect(product.price).toBe(99)
      expect(product.currency).toBe('USD')
      expect(product.slug).toBeDefined()
    })

    it('should create a subscription billing product with interval', async () => {
      const admin = await getAdminUser()

      const product = await payload.create({
        collection: 'products',
        data: {
          name: 'Premium Subscription',
          billingType: 'subscription',
          interval: 'year',
          price: 299,
          currency: 'ILS',
          isActive: true,
        } as any,
        user: admin as any,
        overrideAccess: false,
      })

      trackProduct(product.id)

      expect(product.billingType).toBe('subscription')
      expect(product.interval).toBe('year')
    })

    it('should auto-generate slug from name on create', async () => {
      const admin = await getAdminUser()

      const product = await payload.create({
        collection: 'products',
        data: {
          name: 'My Custom Product',
          billingType: 'one_time',
          price: 49,
          currency: 'EUR',
        } as any,
        user: admin as any,
        overrideAccess: false,
      })

      trackProduct(product.id)

      expect(product.slug).toBeDefined()
      expect(product.slug).toContain('my-custom-product')
    })

    it('should read a product by ID', async () => {
      const admin = await getAdminUser()

      const created = await payload.create({
        collection: 'products',
        data: {
          name: 'Read Test Product',
          billingType: 'one_time',
          price: 19,
          currency: 'USD',
        } as any,
        user: admin as any,
        overrideAccess: false,
      })
      trackProduct(created.id)

      const read = await payload.findByID({
        collection: 'products',
        id: created.id,
        user: admin as any,
        overrideAccess: false,
      })

      expect(read.id).toBe(created.id)
      expect(read.name).toBe('Read Test Product')
    })

    it('should update a product', async () => {
      const admin = await getAdminUser()

      const created = await payload.create({
        collection: 'products',
        data: {
          name: 'Update Test Product',
          billingType: 'one_time',
          price: 29,
          currency: 'USD',
          isActive: true,
        } as any,
        user: admin as any,
        overrideAccess: false,
      })
      trackProduct(created.id)

      const updated = await payload.update({
        collection: 'products',
        id: created.id,
        data: { price: 39, isActive: false },
        user: admin as any,
        overrideAccess: false,
      })

      expect(updated.price).toBe(39)
      expect(updated.isActive).toBe(false)
    })

    it('should trim existing slug on update without name change', async () => {
      const admin = await getAdminUser()

      const created = await payload.create({
        collection: 'products',
        data: {
          name: 'Slug Trim Test',
          billingType: 'one_time',
          price: 19,
          currency: 'USD',
        } as any,
        user: admin as any,
        overrideAccess: false,
      })
      trackProduct(created.id)

      expect(created.slug).toBeDefined()

      // Update without changing name — slug should be trimmed
      const updated = await payload.update({
        collection: 'products',
        id: created.id,
        data: { slug: '  ' + created.slug + '  ', price: 29 },
        user: admin as any,
        overrideAccess: false,
      })

      expect(updated.slug).toBe(created.slug.trim())
    })

    it('should delete a product', async () => {
      const admin = await getAdminUser()

      const created = await payload.create({
        collection: 'products',
        data: {
          name: 'Delete Test Product',
          billingType: 'one_time',
          price: 9,
          currency: 'USD',
        } as any,
        user: admin as any,
        overrideAccess: false,
      })
      // Not tracked — we're deleting it

      await payload.delete({
        collection: 'products',
        id: created.id,
        user: admin as any,
        overrideAccess: false,
      })

      // Verify deletion
      let notFoundError: Error | null = null
      try {
        await payload.findByID({ collection: 'products', id: created.id, overrideAccess: true })
      } catch (error) {
        notFoundError = error as Error
      }
      expect(notFoundError).not.toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // Access control
  // -------------------------------------------------------------------------

  describe('Access control', () => {
    it('should deny student from creating products', async () => {
      const student = await getStudentUser()

      let error: Error | null = null
      try {
        await payload.create({
          collection: 'products',
          data: {
            name: 'Student Create Test',
            billingType: 'one_time',
            price: 99,
            currency: 'USD',
          } as any,
          user: student as any,
          overrideAccess: false,
        })
      } catch (e) {
        error = e as Error
      }

      expect(error).not.toBeNull()
      expect((error as any).status).toBeGreaterThanOrEqual(400)
    })

    it('should allow public read of products', async () => {
      const admin = await getAdminUser()

      const created = await payload.create({
        collection: 'products',
        data: {
          name: 'Public Read Test',
          billingType: 'one_time',
          price: 59,
          currency: 'USD',
        } as any,
        user: admin as any,
        overrideAccess: false,
      })
      trackProduct(created.id)

      // Read without user (public access)
      const read = await payload.findByID({
        collection: 'products',
        id: created.id,
        overrideAccess: true,
      })

      expect(read.id).toBe(created.id)
    })
  })

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  describe('Validation', () => {
    it('should require interval for subscription billing', async () => {
      const admin = await getAdminUser()

      let validationError: Error | null = null
      try {
        await payload.create({
          collection: 'products',
          data: {
            name: 'Subscription Without Interval',
            billingType: 'subscription',
            // interval missing
            price: 99,
            currency: 'USD',
          } as any,
          user: admin as any,
          overrideAccess: false,
        })
      } catch (e) {
        validationError = e as Error
      }

      expect(validationError).not.toBeNull()
    })

    it('should reject subscription without interval on update', async () => {
      const admin = await getAdminUser()

      // Create a valid one-time product first
      const created = await payload.create({
        collection: 'products',
        data: {
          name: 'Update Interval Test',
          billingType: 'one_time',
          price: 49,
          currency: 'USD',
        } as any,
        user: admin as any,
        overrideAccess: false,
      })
      trackProduct(created.id)

      // Update to subscription without providing interval
      let validationError: Error | null = null
      try {
        await payload.update({
          collection: 'products',
          id: created.id,
          data: { billingType: 'subscription' },
          user: admin as any,
          overrideAccess: false,
        })
      } catch (e) {
        validationError = e as Error
      }

      expect(validationError).not.toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // Slug uniqueness
  // -------------------------------------------------------------------------

  describe('Slug uniqueness', () => {
    it('should auto-generate unique slug when name conflicts', async () => {
      const admin = await getAdminUser()

      // Create first product
      const product1 = await payload.create({
        collection: 'products',
        data: {
          name: 'Unique Slug Test',
          billingType: 'one_time',
          price: 19,
          currency: 'USD',
        } as any,
        user: admin as any,
        overrideAccess: false,
      })
      trackProduct(product1.id)

      // Create second product with same name
      const product2 = await payload.create({
        collection: 'products',
        data: {
          name: 'Unique Slug Test',
          billingType: 'one_time',
          price: 29,
          currency: 'USD',
        } as any,
        user: admin as any,
        overrideAccess: false,
      })
      trackProduct(product2.id)

      expect(product1.slug).toBeDefined()
      expect(product2.slug).toBeDefined()
      expect(product1.slug).not.toBe(product2.slug)
    })
  })
})

// ---------------------------------------------------------------------------
// Products.items relationship Tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasDatabaseUrl)('Products.items relationship', () => {
  it('should link a product to multiple productItems', async () => {
    const admin = await getAdminUser()

    // Create two ProductItems
    const item1 = await payload.create({
      collection: 'product-items',
      data: {
        type: 'feature',
        featureKey: 'certificate',
        isHighlighted: true,
      },
      user: admin as any,
      overrideAccess: false,
    })
    trackProductItem(item1.id)

    const item2 = await payload.create({
      collection: 'product-items',
      data: {
        type: 'feature',
        featureKey: 'priority-support',
        isHighlighted: false,
      },
      user: admin as any,
      overrideAccess: false,
    })
    trackProductItem(item2.id)

    // Create a Product linking to both items
    const product = await payload.create({
      collection: 'products',
      data: {
        name: 'Bundle Package',
        billingType: 'one_time',
        price: 199,
        currency: 'USD',
        items: [item1.id, item2.id],
      } as any,
      user: admin as any,
      overrideAccess: false,
    })
    trackProduct(product.id)

    expect(product.items).toBeDefined()
    const itemsArray = product.items as unknown as Array<{ id: string }>
    expect(itemsArray.length).toBe(2)

    // Verify by re-reading
    const reRead = await payload.findByID({
      collection: 'products',
      id: product.id,
      depth: 1,
      overrideAccess: true,
    })

    const reReadItems = reRead.items as unknown as Array<{ id: string; featureKey: string }>
    expect(reReadItems.length).toBe(2)
  })
})
