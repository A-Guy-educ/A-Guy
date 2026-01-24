/**
 * Runtime Config Integration Tests
 *
 * @fileType integration-test
 * @domain config.runtime
 * @pattern integration
 */

import { ConfigKind } from '@/lib/config/config-constants'
import { clearConfigCache, getSecret, getVariable, loadRuntimeConfig } from '@/lib/config/runtime'
import config from '@payload-config'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

describe('Runtime Config Integration', () => {
  let payload: Awaited<ReturnType<typeof getPayload>>

  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  afterAll(async () => {
    clearConfigCache()
    // Cleanup test entries
    try {
      await payload.delete({
        collection: 'config_entries',
        where: { key: { like: 'test_runtime_' } },
      })
    } catch {
      // Ignore cleanup errors
    }
  })

  test('should load config from real DB', async () => {
    // Create test entries
    await payload.create({
      collection: 'config_entries',
      data: {
        key: 'test_runtime_var',
        kind: ConfigKind.Variable,
        value: 'integration-test-value',
        enabled: true,
      },
      overrideAccess: true,
    })

    await payload.create({
      collection: 'config_entries',
      data: {
        key: 'test_runtime_secret',
        kind: ConfigKind.Secret,
        value: 'integration-test-secret',
        enabled: true,
      },
      overrideAccess: true,
    })

    // Load config
    const result = await loadRuntimeConfig(payload)

    expect(result.success).toBe(true)
    expect(result.variablesLoaded).toBeGreaterThan(0)
    expect(result.secretsLoaded).toBeGreaterThan(0)

    // Verify values
    expect(getVariable('test_runtime_var')).toBe('integration-test-value')
    expect(getSecret('test_runtime_secret')).toBe('integration-test-secret')
  })

  test('should respect process.env override (exact key match)', async () => {
    // Create DB entry with exact key
    await payload.create({
      collection: 'config_entries',
      data: {
        key: 'test_runtime_override',
        kind: ConfigKind.Variable,
        value: 'db-value',
        enabled: true,
      },
      overrideAccess: true,
    })

    // Set env override with exact same key
    process.env.test_runtime_override = 'env-wins'

    await loadRuntimeConfig(payload)

    expect(getVariable('test_runtime_override')).toBe('env-wins')

    // Cleanup
    delete process.env.test_runtime_override
  })

  test('should not load disabled entries', async () => {
    // Create enabled entry
    await payload.create({
      collection: 'config_entries',
      data: {
        key: 'test_runtime_enabled',
        kind: ConfigKind.Variable,
        value: 'enabled-value',
        enabled: true,
      },
      overrideAccess: true,
    })

    // Create disabled entry
    await payload.create({
      collection: 'config_entries',
      data: {
        key: 'test_runtime_disabled',
        kind: ConfigKind.Variable,
        value: 'disabled-value',
        enabled: false,
      },
      overrideAccess: true,
    })

    await loadRuntimeConfig(payload)

    // Enabled should be loaded
    expect(getVariable('test_runtime_enabled')).toBe('enabled-value')

    // Disabled should NOT be loaded (throw error)
    expect(() => getVariable('test_runtime_disabled')).toThrow()
  })

  test('should not leak secrets to logs', async () => {
    await payload.create({
      collection: 'config_entries',
      data: {
        key: 'test_runtime_leak',
        kind: ConfigKind.Secret,
        value: 'super-secret-value',
        enabled: true,
      },
      overrideAccess: true,
    })

    await loadRuntimeConfig(payload)

    // The secret should be readable via API
    expect(getSecret('test_runtime_leak')).toBe('super-secret-value')
  })
})
