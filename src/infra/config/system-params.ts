/**
 * System Parameters
 *
 * @fileType wrapper
 * @domain config.system-params
 * @pattern type-safe-accessor
 * @ai-summary Type-safe accessors for system parameters stored in ConfigEntries
 *
 * These parameters are application constants that can be managed at runtime
 * by admins via the ConfigEntries collection with kind="system_param".
 *
 * Defaults match src/server/config/constants.ts values.
 */

import { getVariable } from './runtime/runtime-config'

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
  getPdfConversionMaxSegmentPages(tenantId?: string): number {
    const raw = getVariable(tenantId, 'pdf_conversion_max_segment_pages', {
      defaultValue: '2',
      throwIfNotFound: false,
    })
    return parseInt(raw || '2', 10)
  },

  /**
   * Maximum exercises allowed per PDF segment (truncates if exceeded)
   *
   * @param tenantId - Optional tenant ID (uses default if not provided)
   * @default 1000
   * @returns Max exercises per segment
   */
  getPdfConversionMaxExercisesPerSegment(tenantId?: string): number {
    const raw = getVariable(tenantId, 'pdf_conversion_max_exercises_per_segment', {
      defaultValue: '1000',
      throwIfNotFound: false,
    })
    return parseInt(raw || '1000', 10)
  },

  /**
   * Maximum allowed size for extractor/verifier prompts in bytes
   *
   * @param tenantId - Optional tenant ID (uses default if not provided)
   * @default 51200 (50KB)
   * @returns Max prompt size in bytes
   */
  getPdfConversionMaxPromptSizeBytes(tenantId?: string): number {
    const raw = getVariable(tenantId, 'pdf_conversion_max_prompt_size_bytes', {
      defaultValue: '51200',
      throwIfNotFound: false,
    })
    return parseInt(raw || '51200', 10)
  },
}

// Standalone exports for backward compatibility with existing code
export function getPdfConversionMaxSegmentPages(tenantId?: string): number {
  return SystemParams.getPdfConversionMaxSegmentPages(tenantId)
}

export function getPdfConversionMaxExercisesPerSegment(tenantId?: string): number {
  return SystemParams.getPdfConversionMaxExercisesPerSegment(tenantId)
}

export function getPdfConversionMaxPromptSizeBytes(tenantId?: string): number {
  return SystemParams.getPdfConversionMaxPromptSizeBytes(tenantId)
}
