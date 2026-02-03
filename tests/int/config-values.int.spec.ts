// @vitest-environment node
/**
 * ConfigValues Integration Tests
 *
 * @fileType integration-test
 * @domain config
 * @pattern domain-config, json-storage, tenant-scoped
 * @ai-summary Integration tests for ConfigValues collection and runtime loader
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- Test file requires any for PayloadRequest typing */

import { ConfigDomain } from '@/infra/config/config-constants'
import type { Tenant, User } from '@/payload-types'
import config from '@payload-config'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

// Test data
const TEST_ADMIN_EMAIL = 'config-values-test-admin@example.com'
const TEST_ADMIN_PASSWORD = 'test-password-min-32-chars!!'
const TEST_TENANT_1_SLUG = 'config-values-test-tenant-1'
const TEST_TENANT_2_SLUG = 'config-values-test-tenant-2'

describe('ConfigValues (Domain-Scoped Config)', () => {
  let payload: Awaited<ReturnType<typeof getPayload>>
  let adminUser: User
  let tenant1: Tenant
  let tenant2: Tenant

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

    // Create or find test tenant 1
    const tenants1 = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: TEST_TENANT_1_SLUG } },
    })
    if (tenants1.docs.length > 0) {
      tenant1 = tenants1.docs[0]
    } else {
      tenant1 = await payload.create({
        collection: 'tenants',
        data: { name: 'Config Values Test Tenant 1', slug: TEST_TENANT_1_SLUG },
        overrideAccess: true,
      })
    }

    // Create or find test tenant 2
    const tenants2 = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: TEST_TENANT_2_SLUG } },
    })
    if (tenants2.docs.length > 0) {
      tenant2 = tenants2.docs[0]
    } else {
      tenant2 = await payload.create({
        collection: 'tenants',
        data: { name: 'Config Values Test Tenant 2', slug: TEST_TENANT_2_SLUG },
        overrideAccess: true,
      })
    }
  })

  afterAll(async () => {
    // Cleanup test data with tenant filter
    try {
      const testTenantIds = [tenant1.id, tenant2.id]
      await payload.delete({
        collection: 'config_values',
        where: {
          and: [
            {
              domain: { in: [ConfigDomain.Chat, ConfigDomain.Global, ConfigDomain.PdfConversion] },
            },
            { tenant: { in: testTenantIds } },
          ],
        },
      })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('ConfigValues Collection', () => {
    // CV-1: Collection creation
    test('should create config values entry for domain', async () => {
      const result = (await payload.create({
        collection: 'config_values',
        draft: false,
        data: {
          domain: ConfigDomain.Chat,
          tenant: tenant1.id,
          config: {
            enabled: true,
            maxMessages: 100,
            model: 'gpt-4',
          },
          description: 'Chat configuration',
        },
        req: { user: adminUser } as any,
      })) as any

      expect(result.domain).toBe(ConfigDomain.Chat)
      expect(result.tenant).toBe(tenant1.id)
      expect(result.config).toEqual({
        enabled: true,
        maxMessages: 100,
        model: 'gpt-4',
      })
      expect(result.description).toBe('Chat configuration')
    })

    // CV-2: Domain enum validation
    test('should reject invalid domain', async () => {
      await expect(
        payload.create({
          collection: 'config_values',
          draft: false,
          data: {
            domain: 'invalid_domain' as any,
            tenant: tenant1.id,
            config: { key: 'value' },
          },
          req: { user: adminUser } as any,
        }),
      ).rejects.toThrow()
    })

    // CV-3: JSON storage
    test('should store and retrieve complex JSON config', async () => {
      const complexConfig = {
        enabled: true,
        nested: {
          level1: {
            level2: {
              value: 'deeply nested',
            },
          },
        },
        array: ['item1', 'item2', 'item3'],
        number: 42,
        boolean: true,
      }

      const result = (await payload.create({
        collection: 'config_values',
        draft: false,
        data: {
          domain: ConfigDomain.PdfConversion,
          tenant: tenant1.id,
          config: complexConfig,
        },
        req: { user: adminUser } as any,
      })) as any

      // Config should be stored and retrieved correctly
      expect(result.config).toEqual(complexConfig)
    })

    // CV-4: Partial config
    test('should allow partial config with missing keys', async () => {
      const result = (await payload.create({
        collection: 'config_values',
        draft: false,
        data: {
          domain: ConfigDomain.Global,
          tenant: tenant1.id,
          config: {
            siteName: 'Test Site',
            // Missing: description, features, etc.
          },
        },
        req: { user: adminUser } as any,
      })) as any

      expect(result.config).toEqual({
        siteName: 'Test Site',
      })
    })

    // CV-6: Tenant scoping
    test('should enforce tenant + domain uniqueness', async () => {
      // Create first entry for tenant1, chat domain
      await payload.create({
        collection: 'config_values',
        draft: false,
        data: {
          domain: ConfigDomain.Chat,
          tenant: tenant1.id,
          config: { setting: 'value1' },
        },
        req: { user: adminUser } as any,
      })

      // Try to create duplicate for same tenant and domain
      await expect(
        payload.create({
          collection: 'config_values',
          draft: false,
          data: {
            domain: ConfigDomain.Chat,
            tenant: tenant1.id,
            config: { setting: 'value2' },
          },
          req: { user: adminUser } as any,
        }),
      ).rejects.toThrow(/already exists for this tenant/)
    })

    test('should allow same domain under different tenants', async () => {
      const result1 = (await payload.create({
        collection: 'config_values',
        draft: false,
        data: {
          domain: ConfigDomain.Chat,
          tenant: tenant1.id,
          config: { tenant1Setting: 'value' },
        },
        req: { user: adminUser } as any,
      })) as any

      const result2 = (await payload.create({
        collection: 'config_values',
        draft: false,
        data: {
          domain: ConfigDomain.Chat,
          tenant: tenant2.id,
          config: { tenant2Setting: 'value' },
        },
        req: { user: adminUser } as any,
      })) as any

      expect(result1.id).not.toBe(result2.id)
      expect(result1.tenant).toBe(tenant1.id)
      expect(result2.tenant).toBe(tenant2.id)
    })

    // CV-8: Secret detection
    test('should log warning when config contains secret-like keys', async () => {
      const warnSpy = vi.spyOn(payload.logger || console, 'warn').mockImplementation(() => {})

      await payload.create({
        collection: 'config_values',
        draft: false,
        data: {
          domain: ConfigDomain.Global,
          tenant: tenant1.id,
          config: {
            normalSetting: 'value',
            apiKey: 'sk-secret-key',
            password: 'my-password',
            dbSecret: 'db-password-123',
          },
        },
        req: { user: adminUser } as any,
      })

      // Should have logged a warning about secret-like keys
      expect(warnSpy).toHaveBeenCalled()
      const warnCall = warnSpy.mock.calls[0][0] as Record<string, unknown>
      expect(warnCall.msg).toBe('Config values contain secret-like keys')
      expect(warnCall.keys).toContain('apiKey')
      expect(warnCall.keys).toContain('password')
      expect(warnCall.keys).toContain('dbSecret')

      warnSpy.mockRestore()
    })
  })

  describe('Runtime Config Values Loader', () => {
    // CV-5: Domain retrieval
    test('should load and retrieve config by domain', async () => {
      // Create test config
      await payload.create({
        collection: 'config_values',
        draft: false,
        data: {
          domain: ConfigDomain.Chat,
          tenant: tenant1.id,
          config: {
            model: 'gpt-4',
            temperature: 0.7,
          },
        },
        req: { user: adminUser } as any,
      })

      // Import and use the loader
      const { loadConfigValues, getConfigDomain, clearConfigValuesCache } =
        await import('@/infra/config/runtime/config-values')

      await clearConfigValuesCache()
      await loadConfigValues(payload, tenant1.id)

      const chatConfig = getConfigDomain(ConfigDomain.Chat, {
        tenantId: tenant1.id,
      })

      expect(chatConfig).toEqual({
        model: 'gpt-4',
        temperature: 0.7,
      })
    })

    // CV-9: Missing domain fallback
    test('should return empty object for missing domain', async () => {
      const { getConfigDomain, clearConfigValuesCache } =
        await import('@/infra/config/runtime/config-values')

      await clearConfigValuesCache()

      // Try to get a domain that doesn't exist
      const result = getConfigDomain('nonexistent' as ConfigDomain, {
        tenantId: tenant1.id,
        throwIfNotFound: false,
      })

      expect(result).toEqual({})
    })

    test('should throw for missing domain when throwIfNotFound is true', async () => {
      const { getConfigDomain, clearConfigValuesCache, loadConfigValues } =
        await import('@/infra/config/runtime/config-values')

      // Create fresh config without the domain
      await clearConfigValuesCache()
      await loadConfigValues(payload, tenant1.id)

      expect(() =>
        getConfigDomain('nonexistent' as ConfigDomain, {
          tenantId: tenant1.id,
          throwIfNotFound: true,
        }),
      ).toThrow()
    })
  })

  describe('ConfigValues Runtime API', () => {
    test('should get specific config value by key with dot notation', async () => {
      const { loadConfigValues, getConfigValueByKey, clearConfigValuesCache } =
        await import('@/infra/config/runtime/config-values')

      await clearConfigValuesCache()
      await loadConfigValues(payload, tenant1.id)

      // Get nested value using dot notation
      const result = getConfigValueByKey<string>(ConfigDomain.Chat, 'nested.level1.level2.value', {
        tenantId: tenant1.id,
        throwIfNotFound: false,
      })

      expect(result).toBe('deeply nested')
    })

    test('should support default values for missing keys', async () => {
      const { getConfigValueByKey, clearConfigValuesCache, loadConfigValues } =
        await import('@/infra/config/runtime/config-values')

      await clearConfigValuesCache()
      await loadConfigValues(payload, tenant1.id)

      const result = getConfigValueByKey(ConfigDomain.Chat, 'missingKey', {
        tenantId: tenant1.id,
        defaultValue: 'default-value',
      })

      expect(result).toBe('default-value')
    })
  })
})
