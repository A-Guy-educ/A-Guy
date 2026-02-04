/**
 * SystemParams Unit Tests
 *
 * @fileType unit-test
 * @domain config.system-params
 * @pattern type-safe-accessor
 */

import { clearConfigCache } from '@/infra/config/runtime'
import { clearConfigValuesCache, loadConfigValues } from '@/infra/config/runtime/config-values'
import { SystemParams } from '@/infra/config/system-params'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

// Setup: Ensure tests run in a server-like environment (no window)
const originalWindow = globalThis.window
const originalEnv = process.env

beforeAll(() => {
  // @ts-expect-error: Deleting window for server-like environment in tests
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
  find: vi.fn(),
  create: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn() },
}

const TEST_TENANT_ID = 'test-tenant-123'
const DEFAULT_TENANT_SLUG = 'default'

describe('SystemParams', () => {
  beforeEach(() => {
    // CRITICAL: Clear all caches before each test
    clearConfigCache()
    clearConfigValuesCache()
    vi.clearAllMocks()

    // Set the DEFAULT_TENANT_SLUG env var for getDefaultTenantId
    process.env.DEFAULT_TENANT_SLUG = DEFAULT_TENANT_SLUG

    // Default mock for getDefaultTenantId - returns existing tenant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPayload.find.mockImplementation(async (args: any) => {
      if (args.collection === 'tenants') {
        return {
          docs: [{ id: TEST_TENANT_ID, slug: DEFAULT_TENANT_SLUG, name: DEFAULT_TENANT_SLUG }],
        }
      }
      // Default for other collections
      return { docs: [] }
    })
  })

  afterEach(() => {
    delete process.env.DEFAULT_TENANT_SLUG
  })

  describe('getPdfConversionMaxSegmentPages', () => {
    test('should return default value (2) when not configured', async () => {
      // Load config values (empty - no mock data set for config_values)
      await loadConfigValues(mockPayload, TEST_TENANT_ID)

      expect(await SystemParams.getPdfConversionMaxSegmentPages(TEST_TENANT_ID)).toBe(2)
    })

    test('should return configured value from DB', async () => {
      // Override mock to return config for config_values collection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockPayload.find.mockImplementation(async (args: any) => {
        if (args.collection === 'tenants') {
          return {
            docs: [{ id: TEST_TENANT_ID, slug: DEFAULT_TENANT_SLUG, name: DEFAULT_TENANT_SLUG }],
          }
        }
        if (args.collection === 'config_values') {
          return {
            docs: [
              {
                domain: 'global',
                config: { pdf_conversion_max_segment_pages: '5' },
                tenant: { id: TEST_TENANT_ID },
              },
            ],
          }
        }
        return { docs: [] }
      })

      // Load config values which will use the mock
      await loadConfigValues(mockPayload, TEST_TENANT_ID)

      expect(await SystemParams.getPdfConversionMaxSegmentPages(TEST_TENANT_ID)).toBe(5)
    })
  })

  describe('getPdfConversionMaxExercisesPerSegment', () => {
    test('should return default value (1000) when not configured', async () => {
      await loadConfigValues(mockPayload, TEST_TENANT_ID)

      expect(await SystemParams.getPdfConversionMaxExercisesPerSegment(TEST_TENANT_ID)).toBe(1000)
    })

    test('should return configured value from DB', async () => {
      mockPayload.find.mockImplementation(async (args: any) => {
        if (args.collection === 'tenants') {
          return {
            docs: [{ id: TEST_TENANT_ID, slug: DEFAULT_TENANT_SLUG, name: DEFAULT_TENANT_SLUG }],
          }
        }
        if (args.collection === 'config_values') {
          return {
            docs: [
              {
                domain: 'global',
                config: { pdf_conversion_max_exercises_per_segment: '500' },
                tenant: { id: TEST_TENANT_ID },
              },
            ],
          }
        }
        return { docs: [] }
      })

      await loadConfigValues(mockPayload, TEST_TENANT_ID)

      expect(await SystemParams.getPdfConversionMaxExercisesPerSegment(TEST_TENANT_ID)).toBe(500)
    })
  })

  describe('getPdfConversionMaxPromptSizeBytes', () => {
    test('should return default value (51200) when not configured', async () => {
      await loadConfigValues(mockPayload, TEST_TENANT_ID)

      expect(await SystemParams.getPdfConversionMaxPromptSizeBytes(TEST_TENANT_ID)).toBe(51200)
    })

    test('should return configured value from DB', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockPayload.find.mockImplementation(async (args: any) => {
        if (args.collection === 'tenants') {
          return {
            docs: [{ id: TEST_TENANT_ID, slug: DEFAULT_TENANT_SLUG, name: DEFAULT_TENANT_SLUG }],
          }
        }
        if (args.collection === 'config_values') {
          return {
            docs: [
              {
                domain: 'global',
                config: { pdf_conversion_max_prompt_size_bytes: '102400' },
                tenant: { id: TEST_TENANT_ID },
              },
            ],
          }
        }
        return { docs: [] }
      })

      await loadConfigValues(mockPayload, TEST_TENANT_ID)

      expect(await SystemParams.getPdfConversionMaxPromptSizeBytes(TEST_TENANT_ID)).toBe(102400)
    })
  })
})
