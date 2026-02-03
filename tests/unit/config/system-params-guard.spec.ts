/**
 * Unit Tests for System Params Config Loading Guard
 *
 * Validates that system params throw ConfigNotLoadedError when accessed
 * before loadRuntimeConfig() has been called.
 */
import { ConfigNotLoadedError } from '@/infra/config/runtime/errors'
import {
  clearConfigCache,
  getSystemParam,
  isConfigLoaded,
} from '@/infra/config/runtime/runtime-config'
import { getPdfConversionMaxPromptSizeBytes } from '@/infra/config/system-params'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('System Params Config Guard', () => {
  beforeEach(() => {
    // Ensure config cache is cleared before each test
    clearConfigCache()
  })

  afterEach(() => {
    // Clean up after each test
    clearConfigCache()
  })

  it('should throw ConfigNotLoadedError when getSystemParam is called without loading config', () => {
    expect(isConfigLoaded()).toBe(false)

    expect(() => {
      getSystemParam('pdf_conversion_max_prompt_size_bytes', { throwIfNotFound: false })
    }).toThrow(ConfigNotLoadedError)
  })

  it('should throw ConfigNotLoadedError when getPdfConversionMaxPromptSizeBytes is called without loading config', () => {
    expect(isConfigLoaded()).toBe(false)

    expect(() => {
      getPdfConversionMaxPromptSizeBytes('some-tenant-id')
    }).toThrow(ConfigNotLoadedError)
  })

  it('should have correct error message', () => {
    expect(isConfigLoaded()).toBe(false)

    try {
      getSystemParam('any_key', { throwIfNotFound: false })
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigNotLoadedError)
      expect((error as Error).message).toContain('loadRuntimeConfig()')
    }
  })
})
