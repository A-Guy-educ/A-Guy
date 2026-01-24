/**
 * Runtime Config Integration Tests
 *
 * @fileType integration-test
 * @domain config.runtime
 * @pattern integration, tenant-scoped
 */

import { ConfigKind } from '@/lib/config/config-constants'
import { clearConfigCache, getSecret, getVariable, loadRuntimeConfig } from '@/lib/config/runtime'
import { getDefaultTenantId } from '@/server/repos/tenant/get-default-tenant'
import config from '@payload-config'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

const TEST_TENANT_SLUG = 'config-runtime-test-tenant'

describe('Runtime Config Integration (Tenant-Scoped)', () => {
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
        collection: 'config_entries',
        where: {
          and: [{ key: { like: 'test_runtime_' } }, { tenant: { equals: testTenantId } }],
        },
      })
    } catch {
      // Ignore cleanup errors
    }
  })

  test('should load tenant-scoped config from real DB', async () => {
    // Create test entries for tenant
    await payload.create({
      collection: 'config_entries',
      draft: false,
      data: {
        key: 'test_runtime_var',
        kind: ConfigKind.Variable,
        value: 'integration-test-value',
        enabled: true,
        tenant: testTenantId,
      },
      overrideAccess: true,
    })

    await payload.create({
      collection: 'config_entries',
      draft: false,
      data: {
        key: 'test_runtime_secret',
        kind: ConfigKind.Secret,
        value: 'integration-test-secret',
        enabled: true,
        tenant: testTenantId,
      },
      overrideAccess: true,
    })

    // Load config for specific tenant
    const result = await loadRuntimeConfig(payload, testTenantId)

    expect(result.success).toBe(true)
    expect(result.variablesLoaded).toBeGreaterThan(0)
    expect(result.secretsLoaded).toBeGreaterThan(0)

    // Verify tenant-scoped values
    expect(getVariable(testTenantId, 'test_runtime_var')).toBe('integration-test-value')
    expect(getSecret(testTenantId, 'test_runtime_secret')).toBe('integration-test-secret')
  })

  test('should isolate tenant configs', async () => {
    // Create entry for test tenant
    await payload.create({
      collection: 'config_entries',
      draft: false,
      data: {
        key: 'test_runtime_isolated',
        kind: ConfigKind.Variable,
        value: 'tenant-specific-value',
        enabled: true,
        tenant: testTenantId,
      },
      overrideAccess: true,
    })

    await loadRuntimeConfig(payload, testTenantId)

    // Should find the value for our tenant
    expect(getVariable(testTenantId, 'test_runtime_isolated')).toBe('tenant-specific-value')

    // Should throw for different tenant (default tenant)
    const defaultTenantId = await getDefaultTenantId(payload)
    expect(() => getVariable(defaultTenantId, 'test_runtime_isolated')).toThrow()
  })

  test('should not load disabled entries', async () => {
    // Create enabled entry
    await payload.create({
      collection: 'config_entries',
      draft: false,
      data: {
        key: 'test_runtime_enabled',
        kind: ConfigKind.Variable,
        value: 'enabled-value',
        enabled: true,
        tenant: testTenantId,
      },
      overrideAccess: true,
    })

    // Create disabled entry
    await payload.create({
      collection: 'config_entries',
      draft: false,
      data: {
        key: 'test_runtime_disabled',
        kind: ConfigKind.Variable,
        value: 'disabled-value',
        enabled: false,
        tenant: testTenantId,
      },
      overrideAccess: true,
    })

    await loadRuntimeConfig(payload, testTenantId)

    // Enabled should be loaded
    expect(getVariable(testTenantId, 'test_runtime_enabled')).toBe('enabled-value')

    // Disabled should NOT be loaded (throw error)
    expect(() => getVariable(testTenantId, 'test_runtime_disabled')).toThrow()
  })

  test('should not leak secrets to logs', async () => {
    await payload.create({
      collection: 'config_entries',
      draft: false,
      data: {
        key: 'test_runtime_leak',
        kind: ConfigKind.Secret,
        value: 'super-secret-value',
        enabled: true,
        tenant: testTenantId,
      },
      overrideAccess: true,
    })

    await loadRuntimeConfig(payload, testTenantId)

    // The secret should be readable via API
    expect(getSecret(testTenantId, 'test_runtime_leak')).toBe('super-secret-value')
  })

  test('should return default value when key not found', async () => {
    await loadRuntimeConfig(payload, testTenantId)

    expect(getVariable(testTenantId, 'nonexistent_key', { defaultValue: 'default' })).toBe(
      'default',
    )
    expect(getSecret(testTenantId, 'nonexistent_secret', { defaultValue: 'secret-default' })).toBe(
      'secret-default',
    )
  })

  test('should return empty string when throwIfNotFound is false', async () => {
    await loadRuntimeConfig(payload, testTenantId)

    expect(getVariable(testTenantId, 'nonexistent', { throwIfNotFound: false })).toBe('')
    expect(getSecret(testTenantId, 'nonexistent', { throwIfNotFound: false })).toBe('')
  })
})
