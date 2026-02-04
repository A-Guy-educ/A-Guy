/**
 * Runtime Config Unit Tests
 *
 * @fileType unit-test
 * @domain config.runtime
 * @pattern tenant-scoped, secrets-only
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */

import { encryptSecret } from '@/infra/config/config-crypto'
import {
  clearConfigCache,
  getCacheMetadata,
  getSecret,
  getSecretKeys,
  isConfigLoaded,
  loadRuntimeConfig,
  reloadRuntimeConfig,
} from '@/infra/config/runtime'
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

// Setup: Ensure tests run in a server-like environment (no window)
const originalWindow = globalThis.window
const originalEnv = process.env

beforeAll(() => {
  // @ts-ignore: Deleting window for server-like environment in tests
  delete globalThis.window
  // Set required CONFIG_MASTER_KEY for encryption tests
  process.env = { ...originalEnv, CONFIG_MASTER_KEY: '0123456789abcdef0123456789abcdef' }
})

afterAll(() => {
  globalThis.window = originalWindow
  process.env = originalEnv
})

// Mock Payload with minimal required properties - using any for test compatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPayload: any = {
  find: vi.fn(() => Promise.resolve({ docs: [] })),
  logger: { info: vi.fn(), warn: vi.fn() },
}

const TEST_TENANT_ID = 'test-tenant-123'

describe('Runtime Config (Tenant-Scoped Secrets)', () => {
  beforeEach(() => {
    clearConfigCache()
    vi.clearAllMocks()
  })

  describe('loadRuntimeConfig', () => {
    test('should load secrets from DB for tenant', async () => {
      const secretValue = 'secret-value'
      mockPayload.find.mockResolvedValue({
        docs: [
          {
            key: 'test_secret',
            value: encryptSecret(secretValue),
            enabled: true,
            tenant: { id: TEST_TENANT_ID },
          },
        ],
      })

      const result = await loadRuntimeConfig(mockPayload, TEST_TENANT_ID)

      expect(result.success).toBe(true)
      expect(result.secretsLoaded).toBe(1)
      expect(isConfigLoaded()).toBe(true)

      // Verify secret was decrypted (tenant-scoped)
      expect(getSecret('test_secret', { tenantId: TEST_TENANT_ID })).toBe(secretValue)
    })

    test('should be idempotent and return cached result', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      const result1 = await loadRuntimeConfig(mockPayload, TEST_TENANT_ID)
      const result2 = await loadRuntimeConfig(mockPayload, TEST_TENANT_ID)

      // First call: tenant lookup, Second call: config entries (both cached after first load)
      expect(mockPayload.find).toHaveBeenCalledTimes(2)
      expect(result1.loadedAt).toEqual(result2.loadedAt)
      expect(result1).toEqual(result2)
    })

    test('should pass tenant filter and internalConfigLoad context flag', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      await loadRuntimeConfig(mockPayload, TEST_TENANT_ID)

      // Verify the config secrets query has the correct filter
      const configQueryCall = mockPayload.find.mock.calls.find(
        (call: any[]) => call[0]?.collection === 'config_secrets',
      )
      expect(configQueryCall).toBeDefined()
      expect(configQueryCall[0]).toMatchObject({
        where: expect.objectContaining({
          tenant: { equals: TEST_TENANT_ID },
        }),
        overrideAccess: true,
        req: expect.objectContaining({
          context: expect.objectContaining({
            internalConfigLoad: true,
          }),
        }),
      })
    })

    test('should rethrow DB errors (not wrap them)', async () => {
      const dbError = new Error('DB connection failed')
      mockPayload.find.mockRejectedValue(dbError)

      await expect(loadRuntimeConfig(mockPayload, TEST_TENANT_ID)).rejects.toThrow(
        'DB connection failed',
      )
    })

    test('should collect decryption errors but continue loading', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          {
            key: 'valid_secret',
            value: encryptSecret('valid-value'),
            enabled: true,
            tenant: { id: TEST_TENANT_ID },
          },
          {
            key: 'bad_secret',
            value: 'not-encrypted',
            enabled: true,
            tenant: { id: TEST_TENANT_ID },
          },
        ],
      })

      const result = await loadRuntimeConfig(mockPayload, TEST_TENANT_ID)

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].key).toBe('bad_secret')
      expect(result.errors[0].tenantId).toBe(TEST_TENANT_ID)
    })
  })

  describe('reloadRuntimeConfig', () => {
    test('should clear cache and reload', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      // First load: 2 calls (tenant + config)
      await loadRuntimeConfig(mockPayload, TEST_TENANT_ID)
      expect(mockPayload.find).toHaveBeenCalledTimes(2)

      // Reload - should clear cache and call DB again (tenant + config)
      await reloadRuntimeConfig(mockPayload)
      expect(mockPayload.find).toHaveBeenCalledTimes(4)
    })
  })

  describe('getSecret (tenant-scoped)', () => {
    test('should return decrypted secret for tenant', async () => {
      const secretValue = 'my-secret-password'
      mockPayload.find.mockResolvedValue({
        docs: [
          {
            key: 'MY_SECRET',
            value: encryptSecret(secretValue),
            enabled: true,
            tenant: { id: TEST_TENANT_ID },
          },
        ],
      })

      await loadRuntimeConfig(mockPayload, TEST_TENANT_ID)

      expect(getSecret('MY_SECRET', { tenantId: TEST_TENANT_ID })).toBe(secretValue)
    })

    test('should throw ConfigKeyNotFoundError if secret missing', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      await loadRuntimeConfig(mockPayload, TEST_TENANT_ID)

      expect(() => getSecret('missing_secret', { tenantId: TEST_TENANT_ID })).toThrow(
        `Missing secret "missing_secret" for tenant ${TEST_TENANT_ID}`,
      )
    })

    test('should return default value if provided', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      await loadRuntimeConfig(mockPayload, TEST_TENANT_ID)

      expect(getSecret('missing', { tenantId: TEST_TENANT_ID, defaultValue: 'default' })).toBe(
        'default',
      )
    })

    test('should return empty string when throwIfNotFound is false', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      await loadRuntimeConfig(mockPayload, TEST_TENANT_ID)

      expect(getSecret('missing', { tenantId: TEST_TENANT_ID, throwIfNotFound: false })).toBe('')
    })

    test('should throw for different tenant', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          {
            key: 'shared_key',
            value: encryptSecret('tenant-value'),
            enabled: true,
            tenant: { id: TEST_TENANT_ID },
          },
        ],
      })

      await loadRuntimeConfig(mockPayload, TEST_TENANT_ID)

      // Should find for correct tenant
      expect(getSecret('shared_key', { tenantId: TEST_TENANT_ID })).toBe('tenant-value')

      // Should throw for different tenant
      expect(() => getSecret('shared_key', { tenantId: 'other-tenant' })).toThrow()
    })
  })

  describe('utility functions (tenant-scoped)', () => {
    test('getCacheMetadata should return null when not loaded', () => {
      expect(getCacheMetadata()).toBeNull()
    })

    test('getCacheMetadata should return metadata when loaded', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          {
            key: 'secret1',
            value: encryptSecret('s1'),
            enabled: true,
            tenant: { id: TEST_TENANT_ID },
          },
          {
            key: 'secret2',
            value: encryptSecret('s2'),
            enabled: true,
            tenant: { id: TEST_TENANT_ID },
          },
        ],
      })

      await loadRuntimeConfig(mockPayload, TEST_TENANT_ID)

      const metadata = getCacheMetadata()
      expect(metadata).not.toBeNull()
      expect(metadata?.secretCount).toBe(2)
      expect(metadata?.tenantsLoaded).toBe(1)
    })

    test('getSecretKeys should return keys for tenant', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          {
            key: 'secret1',
            value: encryptSecret('s1'),
            enabled: true,
            tenant: { id: TEST_TENANT_ID },
          },
          {
            key: 'secret2',
            value: encryptSecret('s2'),
            enabled: true,
            tenant: { id: TEST_TENANT_ID },
          },
        ],
      })

      await loadRuntimeConfig(mockPayload, TEST_TENANT_ID)

      const keys = getSecretKeys(TEST_TENANT_ID)
      expect(keys).toContain('secret1')
      expect(keys).toContain('secret2')
      expect(keys).toHaveLength(2)
    })

    test('getSecretKeys should return empty array for unloaded tenant', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      await loadRuntimeConfig(mockPayload, TEST_TENANT_ID)

      const keys = getSecretKeys('other-tenant')
      expect(keys).toEqual([])
    })
  })
})
