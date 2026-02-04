/**
 * Runtime Config Integration Tests
 *
 * @fileType integration-test
 * @domain config.runtime
 * @pattern integration, tenant-scoped, secrets
 */

import { clearConfigCache, getSecret, loadRuntimeConfig } from '@/infra/config/runtime'
import { getDefaultTenantId } from '@/server/repos/tenant/get-default-tenant'
import config from '@payload-config'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

const TEST_TENANT_SLUG = 'config-runtime-test-tenant'

describe('Runtime Config Integration (Tenant-Scoped Secrets)', () => {
  let payload: Awaited<ReturnType<typeof getPayload>>
  let testTenantId: string

  beforeAll(async () => {
    payload = await getPayload({ config })

    // Get or create test tenant
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: TEST_TENANT_SLUG } },
    })
    if (tenants.docs.length > 0) {
      testTenantId = tenants.docs[0].id
    } else {
      const created = await payload.create({
        collection: 'tenants',
        data: { name: 'Config Runtime Test Tenant', slug: TEST_TENANT_SLUG },
        overrideAccess: true,
      })
      testTenantId = created.id
    }
  })

  afterAll(async () => {
    clearConfigCache()
    // Cleanup test entries
    try {
      await payload.delete({
        collection: 'config_secrets',
        where: {
          and: [{ key: { like: 'test_runtime_' } }, { tenant: { equals: testTenantId } }],
        },
      })
    } catch {
      // Ignore cleanup errors
    }
  })

  test('should load tenant-scoped secrets from real DB', async () => {
    // Create test entries for tenant
    await payload.create({
      collection: 'config_secrets',
      draft: false,
      data: {
        key: 'test_runtime_secret',
        value: 'integration-test-secret',
        enabled: true,
        tenant: testTenantId,
      },
      overrideAccess: true,
    })

    // Load config for specific tenant
    const result = await loadRuntimeConfig(payload, testTenantId)

    expect(result.success).toBe(true)
    expect(result.secretsLoaded).toBeGreaterThan(0)

    // Verify tenant-scoped values
    expect(getSecret('test_runtime_secret', { tenantId: testTenantId })).toBe(
      'integration-test-secret',
    )
  })

  test('should isolate tenant configs', async () => {
    // Create entry for test tenant
    await payload.create({
      collection: 'config_secrets',
      draft: false,
      data: {
        key: 'test_runtime_isolated',
        value: 'tenant-specific-secret',
        enabled: true,
        tenant: testTenantId,
      },
      overrideAccess: true,
    })

    await loadRuntimeConfig(payload, testTenantId)

    // Should find the value for our tenant
    expect(getSecret('test_runtime_isolated', { tenantId: testTenantId })).toBe(
      'tenant-specific-secret',
    )

    // Should throw for different tenant (default tenant)
    const defaultTenantId = await getDefaultTenantId(payload)
    expect(() => getSecret('test_runtime_isolated', { tenantId: defaultTenantId })).toThrow()
  })

  test('should not load disabled entries', async () => {
    // Create enabled entry
    await payload.create({
      collection: 'config_secrets',
      draft: false,
      data: {
        key: 'test_runtime_enabled',
        value: 'enabled-secret',
        enabled: true,
        tenant: testTenantId,
      },
      overrideAccess: true,
    })

    // Create disabled entry
    await payload.create({
      collection: 'config_secrets',
      draft: false,
      data: {
        key: 'test_runtime_disabled',
        value: 'disabled-secret',
        enabled: false,
        tenant: testTenantId,
      },
      overrideAccess: true,
    })

    await loadRuntimeConfig(payload, testTenantId)

    // Enabled should be loaded
    expect(getSecret('test_runtime_enabled', { tenantId: testTenantId })).toBe('enabled-secret')

    // Disabled should NOT be loaded (throw error)
    expect(() => getSecret('test_runtime_disabled', { tenantId: testTenantId })).toThrow()
  })

  test('should return default value when key not found', async () => {
    await loadRuntimeConfig(payload, testTenantId)

    expect(getSecret('nonexistent_key', { tenantId: testTenantId, defaultValue: 'default' })).toBe(
      'default',
    )
  })

  test('should return empty string when throwIfNotFound is false', async () => {
    await loadRuntimeConfig(payload, testTenantId)

    expect(getSecret('nonexistent', { tenantId: testTenantId, throwIfNotFound: false })).toBe('')
  })
})
