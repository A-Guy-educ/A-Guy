/**
 * Unit Tests for System Params Config Loading Guard
 *
 * Validates that system params work with lazy loading - they return defaults
 * when config is not loaded (rather than throwing).
 *
 * Note: SystemParams uses ConfigValues which has lazy loading support.
 * It will auto-load config on first access if setPayloadGetterForLazyLoading is configured.
 * If not configured, it returns defaults from getSystemParamValue.
 */
import { clearConfigValuesCache } from '@/infra/config/runtime/config-values'
import { getPdfConversionMaxPromptSizeBytes } from '@/infra/config/system-params'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('System Params Config Guard', () => {
  beforeEach(() => {
    // Ensure config values cache is cleared before each test
    clearConfigValuesCache()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    // Clean up after each test
    clearConfigValuesCache()
    vi.restoreAllMocks()
  })

  it('should return default value (51200) when config values are not loaded', async () => {
    // SystemParams uses ConfigValues with lazy loading
    // Without lazy loading configured, it returns the default value
    const result = await getPdfConversionMaxPromptSizeBytes('some-tenant-id')
    expect(result).toBe(51200)
  })
})
