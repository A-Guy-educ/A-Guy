// @vitest-environment node
/**
 * Config Auto-Loading Integration Tests
 *
 * @fileType integration-test
 * @domain config
 * @pattern auto-loading, lazy-loading
 * @ai-summary Integration tests for automatic config loading in SSR contexts
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- Test file requires any for PayloadRequest typing */

import { ConfigDomain } from '@/infra/config/config-constants'
import type { Tenant, User } from '@/payload-types'
import config from '@payload-config'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

// Test data
const TEST_ADMIN_EMAIL = 'config-auto-load-test-admin@example.com'
const TEST_ADMIN_PASSWORD = 'test-password-min-32-chars!!'
const TEST_TENANT_SLUG = 'config-auto-load-test-tenant'

describe('Config Auto-Loading (SSR-compatible)', () => {
  let payload: Awaited<ReturnType<typeof getPayload>>
  let adminUser: User
  let tenant: Tenant

  beforeAll(async () => {
    payload = await getPayload({ config })

    // Create or find admin user for tests
    try {
      const users = await payload.find({
        collection: 'users',
        where: { email: { equals: TEST_ADMIN_EMAIL } },
      })
      if (users.docs.length > 0) {
        adminUser = users.docs[0]
      } else {
        adminUser = await payload.create({
          collection: 'users',
          data: {
            email: TEST_ADMIN_EMAIL,
            password: TEST_ADMIN_PASSWORD,
            role: 'admin',
          },
        })
      }
    } catch {
      const users = await payload.find({
        collection: 'users',
        where: { email: { equals: TEST_ADMIN_EMAIL } },
      })
      adminUser = users.docs[0]
    }

    // Create or find test tenant
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: TEST_TENANT_SLUG } },
    })
    if (tenants.docs.length > 0) {
      tenant = tenants.docs[0]
    } else {
      tenant = await payload.create({
        collection: 'tenants',
        data: { name: 'Config Auto Load Test Tenant', slug: TEST_TENANT_SLUG },
        overrideAccess: true,
      })
    }

    // Create test config value for interactive_demo
    try {
      const existing = await payload.find({
        collection: 'config_values',
        where: {
          and: [
            { domain: { equals: ConfigDomain.InteractiveDemo } },
            { tenant: { equals: tenant.id } },
          ],
        },
        limit: 1,
      })

      if (existing.docs.length === 0) {
        await payload.create({
          collection: 'config_values',
          data: {
            domain: ConfigDomain.InteractiveDemo,
            tenant: tenant.id,
            config: { enabled: true },
            description: 'Test interactive demo config',
          },
          req: { user: adminUser } as any,
        })
      }
    } catch (error) {
      console.warn('Failed to create test config:', error)
    }
  })

  afterAll(async () => {
    // Cleanup test data
    try {
      await payload.delete({
        collection: 'config_values',
        where: {
          and: [
            { domain: { equals: ConfigDomain.InteractiveDemo } },
            { tenant: { equals: tenant.id } },
          ],
        },
      })
    } catch {
      // Ignore cleanup errors
    }

    // Close DB connection to prevent connection leaks
    if (payload.db?.destroy) {
      await payload.db.destroy()
    }
  })

  describe('Automatic Config Loading', () => {
    test('should auto-load config when calling getConfigDomain without prior loadConfigValues', async () => {
      // Clear cache to simulate fresh SSR request
      const { clearConfigValuesCache, getConfigDomain } =
        await import('@/infra/config/runtime/config-values')

      await clearConfigValuesCache()

      // Call getConfigDomain WITHOUT explicitly calling loadConfigValues first
      // This simulates what happens in SSR when the lesson page is rendered
      // The system should auto-configure lazy loading and load config
      const config = await getConfigDomain(ConfigDomain.InteractiveDemo, {
        tenantId: tenant.id,
        throwIfNotFound: false,
      })

      // Should successfully return config without throwing an error
      expect(config).toBeDefined()
      expect(config).toEqual({ enabled: true })
    })

    test('should work with getInteractiveDemoConfig without prior loadConfigValues', async () => {
      // Clear cache to simulate fresh SSR request
      const { clearConfigValuesCache } = await import('@/infra/config/runtime/config-values')
      const { getInteractiveDemoConfig } = await import('@/server/config/interactive-demo-config')

      await clearConfigValuesCache()

      // Call getInteractiveDemoConfig WITHOUT explicitly calling loadConfigValues first
      // The system should auto-configure and load config
      const config = await getInteractiveDemoConfig(tenant.id)

      // Should successfully return config without throwing an error
      expect(config).toBeDefined()
      expect(config.enabled).toBe(true)
    })

    test('should handle missing config gracefully with auto-loading', async () => {
      // Clear cache to simulate fresh SSR request
      const { clearConfigValuesCache, getConfigDomain } =
        await import('@/infra/config/runtime/config-values')

      await clearConfigValuesCache()

      // Try to get a non-existent domain
      const config = await getConfigDomain('nonexistent' as ConfigDomain, {
        tenantId: tenant.id,
        throwIfNotFound: false,
      })

      // Should return empty object, not throw
      expect(config).toEqual({})
    })

    test('should be concurrency-safe when multiple requests auto-load simultaneously', async () => {
      // Clear cache to simulate fresh SSR request
      const { clearConfigValuesCache, getConfigDomain } =
        await import('@/infra/config/runtime/config-values')

      await clearConfigValuesCache()

      // Simulate multiple concurrent requests accessing config
      const promises = [
        getConfigDomain(ConfigDomain.InteractiveDemo, {
          tenantId: tenant.id,
          throwIfNotFound: false,
        }),
        getConfigDomain(ConfigDomain.InteractiveDemo, {
          tenantId: tenant.id,
          throwIfNotFound: false,
        }),
        getConfigDomain(ConfigDomain.InteractiveDemo, {
          tenantId: tenant.id,
          throwIfNotFound: false,
        }),
      ]

      // All should succeed without race conditions
      const results = await Promise.all(promises)

      results.forEach((result) => {
        expect(result).toBeDefined()
        expect(result).toEqual({ enabled: true })
      })
    })

    test('should handle tenant-specific config resolution with auto-loading', async () => {
      // Create a second tenant with different config
      const tenant2 = await payload.create({
        collection: 'tenants',
        data: { name: 'Auto Load Test Tenant 2', slug: 'config-auto-load-test-tenant-2' },
        overrideAccess: true,
      })

      try {
        // Create config for second tenant with different value
        await payload.create({
          collection: 'config_values',
          data: {
            domain: ConfigDomain.InteractiveDemo,
            tenant: tenant2.id,
            config: { enabled: false },
            description: 'Test interactive demo config for tenant 2',
          },
          req: { user: adminUser } as any,
        })

        // Clear cache
        const { clearConfigValuesCache } = await import('@/infra/config/runtime/config-values')
        const { getInteractiveDemoConfig } = await import('@/server/config/interactive-demo-config')

        await clearConfigValuesCache()

        // Get config for both tenants
        const config1 = await getInteractiveDemoConfig(tenant.id)
        const config2 = await getInteractiveDemoConfig(tenant2.id)

        // Should return correct tenant-specific values
        expect(config1.enabled).toBe(true)
        expect(config2.enabled).toBe(false)
      } finally {
        // Cleanup tenant 2
        await payload.delete({
          collection: 'config_values',
          where: {
            and: [
              { domain: { equals: ConfigDomain.InteractiveDemo } },
              { tenant: { equals: tenant2.id } },
            ],
          },
        })
        await payload.delete({ collection: 'tenants', id: tenant2.id })
      }
    })
  })

  describe('Error Handling', () => {
    test('should NOT throw when lazy loading auto-configures', async () => {
      // Clear cache
      const { clearConfigValuesCache, getConfigDomain } =
        await import('@/infra/config/runtime/config-values')

      await clearConfigValuesCache()

      // Try to access config - should auto-configure and succeed
      const config = await getConfigDomain(ConfigDomain.InteractiveDemo, {
        tenantId: tenant.id,
        throwIfNotFound: false,
      })

      // Should return config or empty object, not throw
      expect(config).toBeDefined()
    })

    test('should return defaults when config loading fails gracefully', async () => {
      const { clearConfigValuesCache } = await import('@/infra/config/runtime/config-values')
      const { getInteractiveDemoConfig } = await import('@/server/config/interactive-demo-config')

      await clearConfigValuesCache()

      // Even if lazy loading encounters issues, getInteractiveDemoConfig
      // should return defaults instead of throwing
      const config = await getInteractiveDemoConfig(tenant.id)

      expect(config).toBeDefined()
      expect(typeof config.enabled).toBe('boolean')
    })
  })
})
