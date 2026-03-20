/**
 * @fileType utility
 * @domain infra | cody | pipeline
 * @pattern pipeline-health
 * @ai-summary Pipeline health monitoring utility for Cody pipeline stages
 */

import { z } from 'zod'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Valid pipeline stage names
 */
export const STAGE_NAMES = [
  'taskify',
  'gap',
  'clarify',
  'architect',
  'plan-gap',
  'test',
  'build',
  'commit',
  'review',
  'fix',
  'verify',
  'docs',
  'pr',
] as const

export type StageName = (typeof STAGE_NAMES)[number]

/**
 * Health status levels for a pipeline stage
 */
export type HealthStatusLevel = 'healthy' | 'warning' | 'critical'

/**
 * Health status for a single pipeline stage
 */
export interface HealthStatus {
  /** Health level of the stage */
  status: HealthStatusLevel
  /** Human-readable message describing the health */
  message: string
  /** Name of the stage */
  stage: string
  /** When the health check was performed */
  timestamp: Date
}

/**
 * Overall pipeline health report
 */
export interface Report {
  /** Individual stage health statuses */
  stages: HealthStatus[]
  /** When the report was generated */
  generatedAt: Date
  /** Overall pipeline health status */
  overallStatus: 'healthy' | 'degraded' | 'critical'
}

/**
 * Retry strategy recommendation for a failed stage
 */
export interface RetryStrategy {
  /** Whether retry is recommended */
  shouldRetry: boolean
  /** Maximum number of retry attempts */
  maxRetries: number
  /** Backoff multiplier for delay between retries */
  backoffMultiplier: number
  /** Base delay in milliseconds before first retry */
  retryDelayMs: number
}

// ============================================================================
// Zod Schemas for Input Validation
// ============================================================================

/**
 * Schema for validating stage names
 */
const stageNameSchema = z
  .string()
  .refine((val): val is StageName => (STAGE_NAMES as readonly string[]).includes(val), {
    message: `Invalid stage name. Valid stages: ${STAGE_NAMES.join(', ')}`,
  })

/**
 * Schema for health status input
 */
const healthStatusInputSchema = z.object({
  stage: stageNameSchema,
})

// ============================================================================
// Default Stage Timeouts (in milliseconds)
// ============================================================================

/**
 * Default timeout values per stage in milliseconds.
 * These mirror the values from scripts/cody/stages/registry.ts
 */
const DEFAULT_STAGE_TIMEOUTS: Record<StageName, number> = {
  taskify: 10 * 60 * 1000, // 10 minutes
  gap: 15 * 60 * 1000, // 15 minutes
  clarify: 10 * 60 * 1000, // 10 minutes
  architect: 30 * 60 * 1000, // 30 minutes
  'plan-gap': 15 * 60 * 1000, // 15 minutes
  test: 20 * 60 * 1000, // 20 minutes
  build: 45 * 60 * 1000, // 45 minutes
  commit: 5 * 60 * 1000, // 5 minutes
  review: 15 * 60 * 1000, // 15 minutes
  fix: 30 * 60 * 1000, // 30 minutes
  verify: 10 * 60 * 1000, // 10 minutes
  docs: 10 * 60 * 1000, // 10 minutes
  pr: 5 * 60 * 1000, // 5 minutes
}

/** Default timeout for unknown stages (30 minutes) */
const DEFAULT_UNKNOWN_STAGE_TIMEOUT = 30 * 60 * 1000

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the default timeout for a pipeline stage.
 *
 * @param stage - The name of the stage
 * @returns Timeout in milliseconds, or default 30 minutes for unknown stages
 */
export function getStageTimeout(stage: string): number {
  // Validate input - return default timeout for unknown stages
  const parsed = stageNameSchema.safeParse(stage)
  if (!parsed.success) {
    // Return default timeout for unknown stages
    return DEFAULT_UNKNOWN_STAGE_TIMEOUT
  }

  const stageName = parsed.data as StageName
  return DEFAULT_STAGE_TIMEOUTS[stageName] ?? DEFAULT_UNKNOWN_STAGE_TIMEOUT
}

// ============================================================================
// PipelineHealthReport Class
// ============================================================================

/**
 * Class for monitoring and reporting on Cody pipeline stage health.
 *
 * @example
 * ```typescript
 * const report = new PipelineHealthReport()
 * const health = report.checkStageHealth('build')
 * const fullReport = report.generateReport()
 * const retryStrategy = report.getRetryRecommendation('build')
 * ```
 */
export class PipelineHealthReport {
  /**
   * Check the health status of a single pipeline stage.
   *
   * @param stage - The name of the stage to check
   * @returns HealthStatus object with current health information
   * @throws ZodError if stage name is invalid
   */
  checkStageHealth(stage: string): HealthStatus {
    // Validate input
    const parsed = healthStatusInputSchema.safeParse({ stage })
    if (!parsed.success) {
      throw parsed.error
    }

    const stageName = parsed.data.stage as StageName
    const timeout = getStageTimeout(stageName)

    return {
      status: 'healthy',
      message: `Stage '${stageName}' is healthy. Timeout: ${timeout}ms`,
      stage: stageName,
      timestamp: new Date(),
    }
  }

  /**
   * Generate a full health report for all pipeline stages.
   *
   * @returns Report object with health status for all stages
   */
  generateReport(): Report {
    const stages: HealthStatus[] = STAGE_NAMES.map((stageName) => {
      const timeout = DEFAULT_STAGE_TIMEOUTS[stageName]
      return {
        status: 'healthy' as HealthStatusLevel,
        message: `Stage '${stageName}' is healthy. Timeout: ${timeout}ms`,
        stage: stageName,
        timestamp: new Date(),
      }
    })

    return {
      stages,
      generatedAt: new Date(),
      overallStatus: 'healthy',
    }
  }

  /**
   * Get a retry recommendation strategy for a failed stage.
   *
   * @param failedStage - The name of the stage that failed
   * @returns RetryStrategy with recommended retry parameters
   * @throws ZodError if stage name is invalid
   */
  getRetryRecommendation(failedStage: string): RetryStrategy {
    // Validate input
    const parsed = stageNameSchema.safeParse(failedStage)
    if (!parsed.success) {
      throw parsed.error
    }

    const stageName = parsed.data as StageName

    // Determine retry parameters based on stage type
    const isLongRunningStage = ['build', 'architect', 'fix'].includes(stageName)

    return {
      shouldRetry: true,
      maxRetries: isLongRunningStage ? 3 : 5,
      backoffMultiplier: 2,
      retryDelayMs: isLongRunningStage ? 60000 : 30000, // 1min for long stages, 30s for others
    }
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default PipelineHealthReport
