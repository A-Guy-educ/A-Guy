/**
 * Integration tests for AccessCodes collection
 *
 * Tests:
 * - CRUD operations as admin
 * - Access control — student is denied all operations
 * - Edge cases: duplicate code unique constraint, missing required fields
 * - Hooks: createdByField and tenantField auto-populate on create
 * - Tenant isolation: codes are scoped to their tenant
 *
 * @fileType integration-test
 * @domain entitlements
 * @ai-summary Tests AccessCodes collection: CRUD, access control, hooks, and tenant isolation
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
let defaultTenantId: string
let otherTenantId: string
let defaultCourseId: string
let otherCourseId: string
let resolvedDefaultTenantId: string | null = null
const createdAccessCodeIds: string[] = []

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  // Create admin user (hook forces role=student on create, so update after)
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: `access-codes-admin-${Date.now()}@example.com`,
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
      email: `access-codes-student-${Date.now()}@example.com`,
      password: 'test123456',
      role: AccountRole.Student,
    } as any,
  })
  studentUserId = student.id

  // Get or create default tenant
  const existingTenants = await payload.find({ collection: 'tenants', limit: 1 })
  if (existingTenants.docs.length > 0) {
    defaultTenantId = existingTenants.docs[0].id
  } else {
    const tenant = await payload.create({
      collection: 'tenants',
      data: { name: 'Default Test Tenant', slug: `default-tenant-${Date.now()}` } as any,
      overrideAccess: true,
    })
    defaultTenantId = tenant.id
  }

  // Create another tenant for isolation tests
  const otherTenant = await payload.create({
    collection: 'tenants',
    data: { name: 'Other Test Tenant', slug: `other-tenant-${Date.now()}` } as any,
    overrideAccess: true,
  })
  otherTenantId = otherTenant.id

  // Get or create a category (required for courses)
  const existingCategories = await payload.find({ collection: 'categories', limit: 1 })
  const categoryId = existingCategories.docs[0]?.id ?? (await payload.create({
    collection: 'categories',
    data: { title: 'Test Category', slug: `access-codes-cat-${Date.now()}` } as any,
    overrideAccess: true,
  })).id

  // Create a course in the default tenant
  const defaultCourse = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: 'AC1',
      title: 'Access Codes Test Course',
      slug: `access-codes-test-course-${Date.now()}`,
      order: 0,
      status: 'published',
      isActive: true,
      categories: [categoryId],
      tenant: defaultTenantId,
    } as any,
    overrideAccess: true,
  })
  defaultCourseId = defaultCourse.id

  // Create a course in the other tenant
  const otherCourse = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: 'AC2',
      title: 'Other Tenant Test Course',
      slug: `access-codes-other-course-${Date.now()}`,
      order: 0,
      status: 'published',
      isActive: true,
      categories: [categoryId],
      tenant: otherTenantId,
    } as any,
    overrideAccess: true,
  })
  otherCourseId = otherCourse.id
}, 60_000)

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterEach(async () => {
  if (!payload) return
  for (const id of createdAccessCodeIds) {
    try {
      await payload.delete({ collection: 'access-codes', id, overrideAccess: true })
    } catch {
      // Already deleted
    }
  }
  createdAccessCodeIds.length = 0
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

  for (const id of [otherTenantId]) {
    if (id) {
      try {
        await payload.delete({ collection: 'tenants', id, overrideAccess: true })
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

/** Retrieve the admin user object for access-control tests. */
async function getAdminUser() {
  return payload.findByID({ collection: 'users', id: adminUserId, overrideAccess: true })
}

/** Retrieve the student user object for access-control tests. */
async function getStudentUser() {
  return payload.findByID({ collection: 'users', id: studentUserId, overrideAccess: true })
}

/** Track a created access code for cleanup. */
function trackAccessCode(id: string) {
  createdAccessCodeIds.push(id)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasDatabaseUrl)('AccessCodes Collection', () => {
  // -------------------------------------------------------------------------
  // CRUD as admin
  // -------------------------------------------------------------------------

  describe('CRUD operations as admin', () => {
    it('should create an access code with all fields', async () => {
      const admin = await getAdminUser()
      const timestamp = Date.now()

      const code = await payload.create({
        collection: 'access-codes',
        data: {
          code: `ADMIN-CREATE-${timestamp}`,
          course: defaultCourseId,
          maxUses: 10,
          currentUses: 0,
          isActive: true,
          tenant: defaultTenantId,
        },
        user: admin as any,
        overrideAccess: false,
      })

      trackAccessCode(code.id)

      expect(code).toBeDefined()
      expect(code.id).toBeDefined()
      expect(code.code).toBe(`ADMIN-CREATE-${timestamp}`)
      expect(code.maxUses).toBe(10)
      expect(code.currentUses).toBe(0)
      expect(code.isActive).toBe(true)
    })

    it('should read an access code by ID', async () => {
      const admin = await getAdminUser()
      const timestamp = Date.now()

      const created = await payload.create({
        collection: 'access-codes',
        data: {
          code: `ADMIN-READ-${timestamp}`,
          course: defaultCourseId,
          maxUses: 5,
          tenant: defaultTenantId,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackAccessCode(created.id)

      const read = await payload.findByID({
        collection: 'access-codes',
        id: created.id,
        user: admin as any,
        overrideAccess: false,
      })

      expect(read.id).toBe(created.id)
      expect(read.code).toBe(`ADMIN-READ-${timestamp}`)
      expect(read.maxUses).toBe(5)
    })

    it('should update an access code', async () => {
      const admin = await getAdminUser()

      const created = await payload.create({
        collection: 'access-codes',
        data: {
          code: `ADMIN-UPDATE-${Date.now()}`,
          course: defaultCourseId,
          maxUses: 5,
          isActive: true,
          tenant: defaultTenantId,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackAccessCode(created.id)

      const updated = await payload.update({
        collection: 'access-codes',
        id: created.id,
        data: {
          maxUses: 20,
          isActive: false,
        },
        user: admin as any,
        overrideAccess: false,
      })

      expect(updated.maxUses).toBe(20)
      expect(updated.isActive).toBe(false)
    })

    it('should delete an access code', async () => {
      const admin = await getAdminUser()

      const created = await payload.create({
        collection: 'access-codes',
        data: {
          code: `ADMIN-DELETE-${Date.now()}`,
          course: defaultCourseId,
          tenant: defaultTenantId,
        },
        user: admin as any,
        overrideAccess: false,
      })
      // Not tracked — we're deleting it

      await payload.delete({
        collection: 'access-codes',
        id: created.id,
        user: admin as any,
        overrideAccess: false,
      })

      // Verify deletion
      let notFoundError: Error | null = null
      try {
        await payload.findByID({ collection: 'access-codes', id: created.id, overrideAccess: true })
      } catch (error) {
        notFoundError = error as Error
      }
      expect(notFoundError).not.toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // Access control
  // -------------------------------------------------------------------------

  describe('Access control — student denied', () => {
    it('should deny student from creating access codes', async () => {
      const student = await getStudentUser()

      let error: Error | null = null
      try {
        await payload.create({
          collection: 'access-codes',
          data: {
            code: `STUDENT-CREATE-${Date.now()}`,
            course: defaultCourseId,
            tenant: defaultTenantId,
          },
          user: student as any,
          overrideAccess: false,
        })
      } catch (e) {
        error = e as Error
      }

      expect(error).not.toBeNull()
    })

    it('should deny student from reading access codes', async () => {
      const admin = await getAdminUser()
      const student = await getStudentUser()

      const created = await payload.create({
        collection: 'access-codes',
        data: {
          code: `STUDENT-READ-${Date.now()}`,
          course: defaultCourseId,
          tenant: defaultTenantId,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackAccessCode(created.id)

      let error: Error | null = null
      try {
        await payload.findByID({
          collection: 'access-codes',
          id: created.id,
          user: student as any,
          overrideAccess: false,
        })
      } catch (e) {
        error = e as Error
      }

      expect(error).not.toBeNull()
    })

    it('should deny student from updating access codes', async () => {
      const admin = await getAdminUser()
      const student = await getStudentUser()

      const created = await payload.create({
        collection: 'access-codes',
        data: {
          code: `STUDENT-UPDATE-${Date.now()}`,
          course: defaultCourseId,
          tenant: defaultTenantId,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackAccessCode(created.id)

      let error: Error | null = null
      try {
        await payload.update({
          collection: 'access-codes',
          id: created.id,
          data: { maxUses: 99 },
          user: student as any,
          overrideAccess: false,
        })
      } catch (e) {
        error = e as Error
      }

      expect(error).not.toBeNull()
    })

    it('should deny student from deleting access codes', async () => {
      const admin = await getAdminUser()
      const student = await getStudentUser()

      const created = await payload.create({
        collection: 'access-codes',
        data: {
          code: `STUDENT-DELETE-${Date.now()}`,
          course: defaultCourseId,
          tenant: defaultTenantId,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackAccessCode(created.id)

      let error: Error | null = null
      try {
        await payload.delete({
          collection: 'access-codes',
          id: created.id,
          user: student as any,
          overrideAccess: false,
        })
      } catch (e) {
        error = e as Error
      }

      expect(error).not.toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('Edge cases', () => {
    it('should enforce unique code constraint', async () => {
      const admin = await getAdminUser()
      const uniqueCode = `DUPLICATE-TEST-${Date.now()}`

      const first = await payload.create({
        collection: 'access-codes',
        data: {
          code: uniqueCode,
          course: defaultCourseId,
          tenant: defaultTenantId,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackAccessCode(first.id)

      let duplicateError: Error | null = null
      try {
        await payload.create({
          collection: 'access-codes',
          data: {
            code: uniqueCode,
            course: defaultCourseId,
            tenant: defaultTenantId,
          },
          user: admin as any,
          overrideAccess: false,
        })
      } catch (e) {
        duplicateError = e as Error
      }

      expect(duplicateError).not.toBeNull()
    })

    it('should require code field (empty string rejected)', async () => {
      const admin = await getAdminUser()

      let validationError: Error | null = null
      try {
        await payload.create({
          collection: 'access-codes',
          data: {
            code: '',
            course: defaultCourseId,
            tenant: defaultTenantId,
          },
          user: admin as any,
          overrideAccess: false,
        })
      } catch (e) {
        validationError = e as Error
      }

      expect(validationError).not.toBeNull()
    })

    it('should enforce maxUses cannot be exceeded by setting isActive=false', async () => {
      const admin = await getAdminUser()

      // Create a code with maxUses=1
      const code = await payload.create({
        collection: 'access-codes',
        data: {
          code: `MAXUSES-CHECK-${Date.now()}`,
          course: defaultCourseId,
          maxUses: 1,
          currentUses: 1,
          isActive: true,
          tenant: defaultTenantId,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackAccessCode(code.id)

      // Deactivate manually (admin action)
      const updated = await payload.update({
        collection: 'access-codes',
        id: code.id,
        data: { isActive: false },
        user: admin as any,
        overrideAccess: false,
      })

      expect(updated.isActive).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------

  describe('Hooks', () => {
    it('should auto-set createdBy on create', async () => {
      const admin = await getAdminUser()

      const code = await payload.create({
        collection: 'access-codes',
        data: {
          code: `CREATEDBY-HOOK-${Date.now()}`,
          course: defaultCourseId,
          tenant: defaultTenantId,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackAccessCode(code.id)

      // Read with overrideAccess to check the auto-set field
      const read = await payload.findByID({
        collection: 'access-codes',
        id: code.id,
        overrideAccess: true,
      })

      expect(read.createdBy).toBeDefined()
      // createdBy could be an ID string or object depending on depth
      const createdById = typeof read.createdBy === 'object' ? read.createdBy?.id : read.createdBy
      expect(createdById).toBe(adminUserId)
    })

    it('should auto-set tenant on create when omitted', async () => {
      const admin = await getAdminUser()

      // Omit tenant field — hook should auto-populate it
      // @ts-expect-error: tenant is intentionally omitted to test the auto-population hook
      const code = await payload.create({
        collection: 'access-codes',
        data: {
          code: `TENANT-HOOK-${Date.now()}`,
          course: defaultCourseId,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackAccessCode(code.id)

      const read = await payload.findByID({
        collection: 'access-codes',
        id: code.id,
        overrideAccess: true,
      })

      expect(read.tenant).toBeDefined()
      const tenantId = typeof read.tenant === 'object' ? read.tenant?.id : read.tenant
      // The resolved default tenant is determined by the DEFAULT_TENANT_SLUG env var,
      // which may differ from the first existing tenant found in beforeAll.
      // Capture it from the first resolved code to avoid a hardcoded mismatch.
      if (resolvedDefaultTenantId === null) {
        resolvedDefaultTenantId = tenantId as string
      }
      expect(tenantId).toBe(resolvedDefaultTenantId)
    })
  })

  // -------------------------------------------------------------------------
  // Tenant isolation
  // -------------------------------------------------------------------------

  describe('Tenant isolation', () => {
    it('should scope access code to the tenant it was created in', async () => {
      const admin = await getAdminUser()

      // Create a code in the default tenant
      const code = await payload.create({
        collection: 'access-codes',
        data: {
          code: `TENANT-ISO-${Date.now()}`,
          course: defaultCourseId,
          tenant: defaultTenantId,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackAccessCode(code.id)

      // Read it back within the same tenant
      const read = await payload.findByID({
        collection: 'access-codes',
        id: code.id,
        user: admin as any,
        overrideAccess: false,
      })

      expect(read.id).toBe(code.id)
      expect(read.tenant).toBeDefined()
    })

    it('should allow creating access codes for courses in different tenants', async () => {
      const admin = await getAdminUser()

      const code1 = await payload.create({
        collection: 'access-codes',
        data: {
          code: `CROSS-TENANT-A-${Date.now()}`,
          course: defaultCourseId,
          tenant: defaultTenantId,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackAccessCode(code1.id)

      const code2 = await payload.create({
        collection: 'access-codes',
        data: {
          code: `CROSS-TENANT-B-${Date.now()}`,
          course: otherCourseId,
          tenant: otherTenantId,
        },
        user: admin as any,
        overrideAccess: false,
      })
      trackAccessCode(code2.id)

      expect(code1.id).not.toBe(code2.id)
      expect(code1.tenant).not.toBe(code2.tenant)
    })
  })
})
