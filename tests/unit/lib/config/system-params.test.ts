/**
 * SystemParams Unit Tests
 *
 * @fileType unit-test
 * @domain config.system-params
 * @pattern type-safe-accessor
 */

import { clearConfigCache, loadRuntimeConfig } from '@/infra/config/runtime'
import { SystemParams } from '@/infra/config/system-params'
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

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
  logger: { info: vi.fn(), warn: vi.fn() },
}

const TEST_TENANT_ID = 'test-tenant-123'

describe('SystemParams', () => {
  beforeEach(() => {
    // CRITICAL: Clear cache before each test to ensure idempotent function is re-evaluated
    clearConfigCache()
    vi.clearAllMocks()
    // Default mock implementation returns empty
    mockPayload.find.mockResolvedValue({ docs: [] })
  })

  describe('getPdfConversionMaxSegmentPages', () => {
    test('should return default value (2) when not configured', async () => {
      await loadRuntimeConfig(mockPayload, TEST_TENANT_ID)

      expect(SystemParams.getPdfConversionMaxSegmentPages(TEST_TENANT_ID)).toBe(2)
    })

    test('should return configured value from DB', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          {
            key: 'pdf_conversion_max_segment_pages',
            kind: 'system_param',
            value: '5',
            enabled: true,
            tenant: { id: TEST_TENANT_ID },
          },
        ],
      })
      await loadRuntimeConfig(mockPayload, TEST_TENANT_ID)

      expect(SystemParams.getPdfConversionMaxSegmentPages(TEST_TENANT_ID)).toBe(5)
    })
  })

  describe('getPdfConversionMaxExercisesPerSegment', () => {
    test('should return default value (1000) when not configured', async () => {
      await loadRuntimeConfig(mockPayload, TEST_TENANT_ID)

      expect(SystemParams.getPdfConversionMaxExercisesPerSegment(TEST_TENANT_ID)).toBe(1000)
    })

    test('should return configured value from DB', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          {
            key: 'pdf_conversion_max_exercises_per_segment',
            kind: 'system_param',
            value: '500',
            enabled: true,
            tenant: { id: TEST_TENANT_ID },
          },
        ],
      })
      await loadRuntimeConfig(mockPayload, TEST_TENANT_ID)

      expect(SystemParams.getPdfConversionMaxExercisesPerSegment(TEST_TENANT_ID)).toBe(500)
    })
  })

  describe('getPdfConversionMaxPromptSizeBytes', () => {
    test('should return default value (51200) when not configured', async () => {
      await loadRuntimeConfig(mockPayload, TEST_TENANT_ID)

      expect(SystemParams.getPdfConversionMaxPromptSizeBytes(TEST_TENANT_ID)).toBe(51200)
    })

    test('should return configured value from DB', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          {
            key: 'pdf_conversion_max_prompt_size_bytes',
            kind: 'system_param',
            value: '102400',
            enabled: true,
            tenant: { id: TEST_TENANT_ID },
          },
        ],
      })
      await loadRuntimeConfig(mockPayload, TEST_TENANT_ID)

      expect(SystemParams.getPdfConversionMaxPromptSizeBytes(TEST_TENANT_ID)).toBe(102400)
    })
  })
})
