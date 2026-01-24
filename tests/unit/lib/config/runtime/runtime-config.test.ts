/**
 * Runtime Config Unit Tests
 *
 * @fileType unit-test
 * @domain config.runtime
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */

import { encryptSecret } from '@/lib/config/config-crypto'
import {
  clearConfigCache,
  getCacheMetadata,
  getSecret,
  getSecretKeys,
  getVariable,
  getVariableKeys,
  isConfigLoaded,
  loadRuntimeConfig,
  reloadRuntimeConfig,
} from '@/lib/config/runtime'
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
  logger: { info: vi.fn() },
}

describe('Runtime Config', () => {
  beforeEach(() => {
    clearConfigCache()
    vi.clearAllMocks()
  })

  describe('loadRuntimeConfig', () => {
    test('should load variables and secrets from DB', async () => {
      const secretValue = 'secret-value'
      mockPayload.find.mockResolvedValue({
        docs: [
          { key: 'test_var', kind: 'variable', value: 'var-value', enabled: true },
          { key: 'test_secret', kind: 'secret', value: encryptSecret(secretValue), enabled: true },
        ],
      })

      const result = await loadRuntimeConfig(mockPayload)

      expect(result.success).toBe(true)
      expect(result.variablesLoaded).toBe(1)
      expect(result.secretsLoaded).toBe(1)
      expect(isConfigLoaded()).toBe(true)

      // Verify secret was decrypted
      expect(getSecret('test_secret')).toBe(secretValue)
    })

    test('should be idempotent and return cached result', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      const result1 = await loadRuntimeConfig(mockPayload)
      const result2 = await loadRuntimeConfig(mockPayload)

      // Should only call DB once
      expect(mockPayload.find).toHaveBeenCalledTimes(1)
      expect(result1.loadedAt).toEqual(result2.loadedAt)
      expect(result1).toEqual(result2)
    })

    test('should pass internalConfigLoad context flag', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      await loadRuntimeConfig(mockPayload)

      expect(mockPayload.find).toHaveBeenCalledWith(
        expect.objectContaining({
          overrideAccess: true,
          req: expect.objectContaining({
            context: expect.objectContaining({
              internalConfigLoad: true,
            }),
          }),
        }),
      )
    })

    test('should rethrow DB errors (not wrap them)', async () => {
      const dbError = new Error('DB connection failed')
      mockPayload.find.mockRejectedValue(dbError)

      await expect(loadRuntimeConfig(mockPayload)).rejects.toThrow('DB connection failed')
    })

    test('should collect decryption errors but continue loading', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          { key: 'valid_var', kind: 'variable', value: 'value', enabled: true },
          { key: 'bad_secret', kind: 'secret', value: 'not-encrypted', enabled: true },
        ],
      })

      const result = await loadRuntimeConfig(mockPayload)

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].key).toBe('bad_secret')
    })
  })

  describe('reloadRuntimeConfig', () => {
    test('should clear cache and reload', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      // First load
      await loadRuntimeConfig(mockPayload)
      expect(mockPayload.find).toHaveBeenCalledTimes(1)

      // Reload - should clear cache and call DB again
      await reloadRuntimeConfig(mockPayload)
      expect(mockPayload.find).toHaveBeenCalledTimes(2)
    })
  })

  describe('getVariable', () => {
    test('should return process.env override (exact key match)', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ key: 'MY_VAR', kind: 'variable', value: 'db-value', enabled: true }],
      })

      await loadRuntimeConfig(mockPayload)

      process.env.MY_VAR = 'env-override'
      expect(getVariable('MY_VAR')).toBe('env-override')
      delete process.env.MY_VAR
    })

    test('should return DB value when env not set', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ key: 'DB_VAR', kind: 'variable', value: 'db-value', enabled: true }],
      })

      await loadRuntimeConfig(mockPayload)
      expect(getVariable('DB_VAR')).toBe('db-value')
    })

    test('should NOT match if env key case differs', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ key: 'my_var', kind: 'variable', value: 'db-value', enabled: true }],
      })

      await loadRuntimeConfig(mockPayload)

      process.env.MY_VAR = 'env-override'
      expect(getVariable('my_var')).toBe('db-value')
      delete process.env.MY_VAR
    })

    test('should throw ConfigNotLoadedError if not loaded', () => {
      expect(() => getVariable('any_key')).toThrow('Runtime config has not been loaded')
    })

    test('should throw ConfigKeyNotFoundError if key missing', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      await loadRuntimeConfig(mockPayload)

      expect(() => getVariable('missing_key')).toThrow('Missing required variable: missing_key')
    })

    test('should return default value if provided', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      await loadRuntimeConfig(mockPayload)

      expect(getVariable('missing', { defaultValue: 'default' })).toBe('default')
    })
  })

  describe('getSecret', () => {
    test('should return decrypted secret', async () => {
      const secretValue = 'my-secret-password'
      mockPayload.find.mockResolvedValue({
        docs: [
          { key: 'MY_SECRET', kind: 'secret', value: encryptSecret(secretValue), enabled: true },
        ],
      })

      await loadRuntimeConfig(mockPayload)

      expect(getSecret('MY_SECRET')).toBe(secretValue)
    })

    test('should throw ConfigKeyNotFoundError if secret missing', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      await loadRuntimeConfig(mockPayload)

      expect(() => getSecret('missing_secret')).toThrow('Missing required secret: missing_secret')
    })
  })

  describe('utility functions', () => {
    test('getCacheMetadata should return null when not loaded', () => {
      expect(getCacheMetadata()).toBeNull()
    })

    test('getCacheMetadata should return metadata when loaded', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          { key: 'var1', kind: 'variable', value: 'val1', enabled: true },
          { key: 'secret1', kind: 'secret', value: encryptSecret('s1'), enabled: true },
        ],
      })

      await loadRuntimeConfig(mockPayload)

      const metadata = getCacheMetadata()
      expect(metadata).not.toBeNull()
      expect(metadata?.entryCount).toBe(2)
      expect(metadata?.variableCount).toBe(1)
      expect(metadata?.secretCount).toBe(1)
    })

    test('getVariableKeys should return keys', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          { key: 'key1', kind: 'variable', value: 'val1', enabled: true },
          { key: 'key2', kind: 'variable', value: 'val2', enabled: true },
        ],
      })

      await loadRuntimeConfig(mockPayload)

      const keys = getVariableKeys()
      expect(keys).toContain('key1')
      expect(keys).toContain('key2')
      expect(keys).toHaveLength(2)
    })

    test('getSecretKeys should return keys', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ key: 'secret1', kind: 'secret', value: encryptSecret('s1'), enabled: true }],
      })

      await loadRuntimeConfig(mockPayload)

      const keys = getSecretKeys()
      expect(keys).toContain('secret1')
      expect(keys).toHaveLength(1)
    })
  })
})
