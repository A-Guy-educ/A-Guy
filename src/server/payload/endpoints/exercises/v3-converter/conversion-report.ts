/**
 * V3 Converter - Conversion Report
 *
 * Provides structured logging and warning types for conversion operations.
 * Ensures no raw sensitive content is logged (NFR-005).
 *
 * @fileType utility
 * @domain conversion
 * @pattern reporting
 */

import type { SegmentType } from './segmenter'

// ---------------------------------
// Warning Types
// ---------------------------------

export interface MappingWarning {
  segmentIndex: number
  segmentType: SegmentType
  chosenBlockType: string
  reasonCode: string
  fingerprint?: string
}

// Reason codes for mapping warnings
export const WARNING_CODES = {
  AMBIGUOUS_SEGMENT: 'AMBIGUOUS_SEGMENT',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  SANITIZATION_APPLIED: 'SANITIZATION_APPLIED',
  FALLBACK_TO_RICH_TEXT: 'FALLBACK_TO_RICH_TEXT',
  ASSET_CREATION_FAILED: 'ASSET_CREATION_FAILED',
  MEDIA_URL_INVALID: 'MEDIA_URL_INVALID',
  MAX_SEGMENTS_CAPPED: 'MAX_SEGMENTS_CAPPED',
  UNKNOWN_FORMAT: 'UNKNOWN_FORMAT',
} as const

// ---------------------------------
// Report Types
// ---------------------------------

export interface ConversionReport {
  correlationId: string
  segmentCount: number
  detectedFeatures: string[]
  blockTypes: string[]
  warnings: MappingWarning[]
  assetIds: string[]
  processingTimeMs: number
}

// ---------------------------------
// Report Factory
// ---------------------------------

/**
 * Create a conversion report from conversion results.
 * All parameters are optional to allow partial reporting.
 */
export function createConversionReport(params: {
  correlationId: string
  segmentCount?: number
  detectedFeatures?: string[]
  blockTypes?: string[]
  warnings?: MappingWarning[]
  assetIds?: string[]
  processingTimeMs?: number
}): ConversionReport {
  return {
    correlationId: params.correlationId,
    segmentCount: params.segmentCount || 0,
    detectedFeatures: params.detectedFeatures || [],
    blockTypes: params.blockTypes || [],
    warnings: params.warnings || [],
    assetIds: params.assetIds || [],
    processingTimeMs: params.processingTimeMs || 0,
  }
}

// ---------------------------------
// Fingerprinting (for logging without exposing content)
// ---------------------------------

/**
 * Create a short fingerprint of content for logging.
 * Uses a simple hash prefix - not cryptographic, just for identification.
 */
export function createFingerprint(content: string): string {
  // Simple hash for identification purposes
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  // Return hex prefix (first 8 characters)
  const hex = Math.abs(hash).toString(16).padStart(8, '0')
  return hex.substring(0, 8)
}

// ---------------------------------
// Logging
// ---------------------------------

/**
 * Create a structured warning from mapping results.
 * Includes fingerprint for identification but NOT raw content.
 */
export function createMappingWarning(params: {
  segmentIndex: number
  segmentType: SegmentType
  chosenBlockType: string
  reasonCode: string
  content?: string
}): MappingWarning {
  const warning: MappingWarning = {
    segmentIndex: params.segmentIndex,
    segmentType: params.segmentType,
    chosenBlockType: params.chosenBlockType,
    reasonCode: params.reasonCode,
  }

  // Add fingerprint if content provided (for identification)
  if (params.content) {
    warning.fingerprint = createFingerprint(params.content)
  }

  return warning
}

/**
 * Log conversion report with structured output.
 * Does NOT include raw content, only IDs, types, counts, and reason codes.
 */
export function logConversionReport(
  report: ConversionReport,
  logger: { info: (msg: string, meta?: Record<string, unknown>) => void },
): void {
  logger.info('V3 Conversion Report', {
    correlationId: report.correlationId,
    segmentCount: report.segmentCount,
    detectedFeatures: report.detectedFeatures,
    blockTypes: report.blockTypes,
    warningCount: report.warnings.length,
    warnings: report.warnings.map((w) => ({
      segmentIndex: w.segmentIndex,
      segmentType: w.segmentType,
      chosenBlockType: w.chosenBlockType,
      reasonCode: w.reasonCode,
      fingerprint: w.fingerprint,
    })),
    assetIds: report.assetIds,
    processingTimeMs: report.processingTimeMs,
  })
}

/**
 * Log a mapping warning.
 * Does NOT include raw content.
 */
export function logMappingWarning(
  warning: MappingWarning,
  logger: { warn: (msg: string, meta?: Record<string, unknown>) => void },
): void {
  logger.warn('V3 Mapping Warning', {
    segmentIndex: warning.segmentIndex,
    segmentType: warning.segmentType,
    chosenBlockType: warning.chosenBlockType,
    reasonCode: warning.reasonCode,
    fingerprint: warning.fingerprint,
  })
}
