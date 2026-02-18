/**
 * System Parameters
 *
 * @fileType wrapper
 * @domain config.system-params
 * @pattern type-safe-accessor
 * @ai-summary Type-safe accessors for system parameters stored in ConfigValues
 *
 * These parameters are application constants that can be managed at runtime
 * by admins via the ConfigValues collection.
 *
 * Defaults match src/server/config/constants.ts values.
 */

import type { ConfigDomain } from './config-constants'
import { getConfigValueByKey } from './runtime/config-values'

const SYSTEM_PARAMS_DOMAIN: ConfigDomain = 'global'

/**
 * Get system param from ConfigValues (domain-grouped, non-secret configuration)
 */
async function getSystemParamValue(
  key: string,
  defaultValue?: string,
): Promise<string | undefined> {
  try {
    const value = await getConfigValueByKey<string>(SYSTEM_PARAMS_DOMAIN, key, {
      throwIfNotFound: false,
    })
    return value ?? defaultValue
  } catch {
    return defaultValue
  }
}

/**
 * System parameters accessors
 * Provide optional tenantId for multi-tenant scenarios; defaults to default tenant
 */
export const SystemParams = {
  // =========================================
  // PDF Conversion
  // =========================================

  /**
   * Maximum number of PDF pages per segment during PDF→Exercises conversion
   *
   * @param tenantId - Optional tenant ID (uses default if not provided)
   * @default 2
   * @returns Number of pages per segment
   */
  async getPdfConversionMaxSegmentPages(_tenantId?: string): Promise<number> {
    const raw = await getSystemParamValue('pdf_conversion_max_segment_pages', '2')
    return parseInt(raw || '2', 10)
  },

  /**
   * Maximum exercises allowed per PDF segment (truncates if exceeded)
   *
   * @param tenantId - Optional tenant ID (uses default if not provided)
   * @default 1000
   * @returns Max exercises per segment
   */
  async getPdfConversionMaxExercisesPerSegment(_tenantId?: string): Promise<number> {
    const raw = await getSystemParamValue('pdf_conversion_max_exercises_per_segment', '1000')
    return parseInt(raw || '1000', 10)
  },

  /**
   * Maximum allowed size for extractor/verifier prompts in bytes
   *
   * @param tenantId - Optional tenant ID (uses default if not provided)
   * @default 51200 (50KB)
   * @returns Max prompt size in bytes
   */
  async getPdfConversionMaxPromptSizeBytes(_tenantId?: string): Promise<number> {
    const raw = await getSystemParamValue('pdf_conversion_max_prompt_size_bytes', '51200')
    return parseInt(raw || '51200', 10)
  },
}

// =========================================
// Standalone exports for backward compatibility
// =========================================

export async function getPdfConversionMaxSegmentPages(tenantId?: string): Promise<number> {
  return SystemParams.getPdfConversionMaxSegmentPages(tenantId)
}

export async function getPdfConversionMaxExercisesPerSegment(tenantId?: string): Promise<number> {
  return SystemParams.getPdfConversionMaxExercisesPerSegment(tenantId)
}

export async function getPdfConversionMaxPromptSizeBytes(tenantId?: string): Promise<number> {
  return SystemParams.getPdfConversionMaxPromptSizeBytes(tenantId)
}

/**
 * Check if password (email/password) login is enabled.
 * When false, only Google OAuth is available.
 *
 * @default false
 */
export async function isPasswordLoginEnabled(): Promise<boolean> {
  try {
    const value = await getConfigValueByKey<string>(SYSTEM_PARAMS_DOMAIN, 'login.password', {
      throwIfNotFound: false,
    })
    return value === 'true'
  } catch {
    return false
  }
}

/**
 * @deprecated Kept for backward compatibility
 * System params are now stored in ConfigValues (domain: 'global')
 */
export function getSystemParam(
  _key: string,
  _options?: { tenantId?: string; defaultValue?: string; throwIfNotFound?: boolean },
): string {
  throw new Error(
    'getSystemParam() is deprecated. System params are now stored in ConfigValues (domain: "global"). Use getConfigValueByKey() instead.',
  )
}
