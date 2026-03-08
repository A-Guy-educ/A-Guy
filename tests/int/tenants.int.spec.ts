/**
 * Integration tests for Tenants collection
 *
 * Tests:
 * - Create tenant with name and slug
 * - Enforce unique slugs
 * - Admin can CRUD tenants
 * - Non-admin cannot create tenants
 * - Default tenant cannot be deleted
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { AccountRole } from '@/server/payload/collections/Users/roles'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let adminUserId: string
let studentUserId: string
const createdTenantIds: string[] = []

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  // Create admin user
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: `tenants-admin-${Date.now()}@example.com`,
      password: 'test123456',
      role: AccountRole.Admin,
    },
  })
  adminUserId = admin.id

  // Create student user
  const student = await payload.create({
    collection: 'users',
    data: {
      email: `tenants-student-${Date.now()}@example.com`,
      password: 'test123456',
      role: AccountRole.Student,
    },
  })
  studentUserId = student.id
})

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return

  // Clean up created tenants (in reverse order to avoid dependency issues)
  for (const tenantId of [...createdTenantIds].reverse()) {
    try {
      await payload.delete({
        collection: 'tenants',
        id: tenantId,
        overrideAccess: true,
      })
    } catch {
      // May already be deleted or protected
    }
  }

  // Clean up test users
  for (const userId of [adminUserId, studentUserId]) {
    if (userId) {
      await payload.delete({
        collection: 'users',
        id: userId,
        overrideAccess: true,
      })
    }
  }

  if (payload.db?.destroy) {
    await payload.db.destroy()
  }
})

describe.skipIf(!hasDatabaseUrl)('Tenants Collection', () => {
  describe('CRUD operations', () => {
    it('should create a tenant with name and slug', async () => {
      const slug = `test-tenant-crud-${Date.now()}`
      const tenant = await payload.create({
        collection: 'tenants',
        data: {
          name: 'CRUD Test Tenant',
          slug,
        },
        overrideAccess: true,
      })

      createdTenantIds.push(tenant.id)

      expect(tenant).toBeDefined()
      expect(tenant.id).toBeDefined()
      expect(tenant.name).toBe('CRUD Test Tenant')
      expect(tenant.slug).toBe(slug)
      expect(tenant.status).toBe('active') // default value
    })

    it('should read a tenant by ID', async () => {
      const tenantId = createdTenantIds[0]
      const tenant = await payload.findByID({
        collection: 'tenants',
        id: tenantId,
        overrideAccess: true,
      })

      expect(tenant).toBeDefined()
      expect(tenant.name).toBe('CRUD Test Tenant')
    })

    it('should update a tenant', async () => {
      const tenantId = createdTenantIds[0]
      const updated = await payload.update({
        collection: 'tenants',
        id: tenantId,
        data: {
          name: 'Updated Tenant Name',
          status: 'archived',
        },
        overrideAccess: true,
      })

      expect(updated.name).toBe('Updated Tenant Name')
      expect(updated.status).toBe('archived')
    })

    it('should delete a tenant', async () => {
      // Create a tenant specifically for deletion
      const tenant = await payload.create({
        collection: 'tenants',
        data: {
          name: 'Tenant To Delete',
          slug: `delete-me-${Date.now()}`,
        },
        overrideAccess: true,
      })

      await payload.delete({
        collection: 'tenants',
        id: tenant.id,
        overrideAccess: true,
      })

      // Verify it was deleted
      let notFoundError: Error | null = null
      try {
        await payload.findByID({
          collection: 'tenants',
          id: tenant.id,
          overrideAccess: true,
        })
      } catch (error: any) {
        notFoundError = error
      }

      expect(notFoundError).not.toBeNull()
    })
  })

  describe('Unique slug enforcement', () => {
    it('should enforce unique slugs', async () => {
      const slug = `unique-slug-${Date.now()}`

      const tenant1 = await payload.create({
        collection: 'tenants',
        data: {
          name: 'First Tenant',
          slug,
        },
        overrideAccess: true,
      })
      createdTenantIds.push(tenant1.id)

      // Try creating another tenant with the same slug
      let duplicateError: Error | null = null
      try {
        const tenant2 = await payload.create({
          collection: 'tenants',
          data: {
            name: 'Second Tenant',
            slug, // same slug
          },
          overrideAccess: true,
        })
        createdTenantIds.push(tenant2.id)
      } catch (error: any) {
        duplicateError = error
      }

      expect(duplicateError).not.toBeNull()
    })
  })

  describe('Access control', () => {
    it('should allow admin to create tenants', async () => {
      const adminUser = await payload.findByID({
        collection: 'users',
        id: adminUserId,
        overrideAccess: true,
      })

      const tenant = await payload.create({
        collection: 'tenants',
        data: {
          name: 'Admin Created Tenant',
          slug: `admin-tenant-${Date.now()}`,
        },
        user: adminUser as any,
        overrideAccess: false,
      })

      createdTenantIds.push(tenant.id)

      expect(tenant).toBeDefined()
      expect(tenant.name).toBe('Admin Created Tenant')
    })

    it('should allow admin to read tenants', async () => {
      const adminUser = await payload.findByID({
        collection: 'users',
        id: adminUserId,
        overrideAccess: true,
      })

      const results = await payload.find({
        collection: 'tenants',
        user: adminUser as any,
        overrideAccess: false,
      })

      expect(results.docs.length).toBeGreaterThanOrEqual(1)
    })

    it('should allow admin to update tenants', async () => {
      const adminUser = await payload.findByID({
        collection: 'users',
        id: adminUserId,
        overrideAccess: true,
      })

      const tenantId = createdTenantIds[createdTenantIds.length - 1]
      const updated = await payload.update({
        collection: 'tenants',
        id: tenantId,
        data: {
          name: 'Admin Updated Tenant',
        },
        user: adminUser as any,
        overrideAccess: false,
      })

      expect(updated.name).toBe('Admin Updated Tenant')
    })

    it('should prevent non-admin from creating tenants', async () => {
      const studentUser = await payload.findByID({
        collection: 'users',
        id: studentUserId,
        overrideAccess: true,
      })

      let accessError: Error | null = null
      try {
        const tenant = await payload.create({
          collection: 'tenants',
          data: {
            name: 'Student Tenant',
            slug: `student-tenant-${Date.now()}`,
          },
          user: studentUser as any,
          overrideAccess: false,
        })
        createdTenantIds.push(tenant.id)
      } catch (error: any) {
        accessError = error
      }

      expect(accessError).not.toBeNull()
    })

    it('should prevent non-admin from reading tenants', async () => {
      const studentUser = await payload.findByID({
        collection: 'users',
        id: studentUserId,
        overrideAccess: true,
      })

      // Payload's adminOnly access may throw Forbidden or return empty results
      try {
        const results = await payload.find({
          collection: 'tenants',
          user: studentUser as any,
          overrideAccess: false,
        })

        // If it returns results, they should be empty
        expect(results.docs).toHaveLength(0)
      } catch (error: any) {
        // Payload throws Forbidden (403) for adminOnly access
        expect(error.status).toBe(403)
      }
    })

    it('should prevent non-admin from updating tenants', async () => {
      const studentUser = await payload.findByID({
        collection: 'users',
        id: studentUserId,
        overrideAccess: true,
      })

      const tenantId = createdTenantIds[0]

      let accessError: Error | null = null
      try {
        await payload.update({
          collection: 'tenants',
          id: tenantId,
          data: {
            name: 'Hacked Tenant',
          },
          user: studentUser as any,
          overrideAccess: false,
        })
      } catch (error: any) {
        accessError = error
      }

      expect(accessError).not.toBeNull()
    })
  })

  describe('Hooks', () => {
    it('should prevent deleting the default tenant', async () => {
      const defaultSlug = process.env.DEFAULT_TENANT_SLUG

      if (!defaultSlug) {
        // If DEFAULT_TENANT_SLUG is not set, verify the hook throws
        const tenant = await payload.create({
          collection: 'tenants',
          data: {
            name: 'Hook Test Tenant',
            slug: `hook-test-${Date.now()}`,
          },
          overrideAccess: true,
        })

        // Without DEFAULT_TENANT_SLUG env var, the hook throws
        let hookError: Error | null = null
        try {
          await payload.delete({
            collection: 'tenants',
            id: tenant.id,
            overrideAccess: true,
          })
        } catch (error: any) {
          hookError = error
        }

        // The beforeDelete hook requires DEFAULT_TENANT_SLUG
        expect(hookError).not.toBeNull()
        expect(hookError?.message).toMatch(/DEFAULT_TENANT_SLUG/i)
        return
      }

      // Find or create the default tenant
      const existing = await payload.find({
        collection: 'tenants',
        where: {
          slug: { equals: defaultSlug },
        },
        overrideAccess: true,
      })

      let defaultTenantId: string
      if (existing.docs.length > 0) {
        defaultTenantId = existing.docs[0].id
      } else {
        const tenant = await payload.create({
          collection: 'tenants',
          data: {
            name: 'Default Tenant',
            slug: defaultSlug,
          },
          overrideAccess: true,
        })
        defaultTenantId = tenant.id
        createdTenantIds.push(tenant.id)
      }

      // Try to delete the default tenant
      let deleteError: Error | null = null
      try {
        await payload.delete({
          collection: 'tenants',
          id: defaultTenantId,
          overrideAccess: true,
        })
      } catch (error: any) {
        deleteError = error
      }

      expect(deleteError).not.toBeNull()
      expect(deleteError?.message).toMatch(/default tenant/i)
    })
  })
})
