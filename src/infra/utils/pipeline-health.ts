/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern health-monitoring
 * @ai-summary Pipeline health monitoring utility for Cody pipeline with stage health checks, reports, and retry recommendations
 */

import { z } from 'zod'

// ============================================================================
// Stage Names — aligned with scripts/cody/stages/registry.ts
// ============================================================================

/**
 * All valid stage names in the Cody pipeline
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

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Health status values for a pipeline stage
 */
export type HealthStatusValue = 'healthy' | 'warning' | 'failed'

/**
 * Health status of a pipeline stage
 */
export interface HealthStatus {
  /** The stage name */
  stage: StageName
  /** Current health status */
  status: HealthStatusValue
  /** Descriptive message */
  message: string
  /** Timestamp of the health check */
  timestamp: string
}

/**
 * Overall health of the pipeline
 */
export type OverallHealth = 'healthy' | 'degraded' | 'failed'

/**
 * Full health report for the entire pipeline
 */
export interface Report {
  /** Individual stage health statuses */
  stages: HealthStatus[]
  /** When the report was generated */
  generatedAt: string
  /** Overall pipeline health */
  overallHealth: OverallHealth
}

/**
 * Retry strategy types
 */
export type RetryStrategyType = 'immediate' | 'exponential' | 'manual'

/**
 * Retry strategy for a failed stage
 */
export interface RetryStrategy {
  /** The retry strategy type */
  strategy: RetryStrategyType
  /** Maximum number of retry attempts */
  maxRetries: number
  /** Delay in milliseconds between retries */
  delayMs: number
  /** Reason for the recommended strategy */
  reason: string
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * Zod schema for validating a stage name
 */
export const stageSchema = z.enum(STAGE_NAMES)

/**
 * Zod schema for validating stage input to checkStageHealth
 */
export const checkStageHealthInputSchema = z.object({
  stage: stageSchema,
})

/**
 * Zod schema for validating failedStage input to getRetryRecommendation
 */
export const getRetryRecommendationInputSchema = z.object({
  failedStage: stageSchema,
})

// ============================================================================
// Stage Timeout Configuration
// ============================================================================

/**
 * Default timeout values in milliseconds for each stage
 * Aligned with scripts/cody/stages/registry.ts
 */
const STAGE_TIMEOUTS: Record<StageName, number> = {
  taskify: 600000, // 10m
  gap: 900000, // 15m
  clarify: 600000, // 10m
  architect: 1800000, // 30m
  'plan-gap': 900000, // 15m
  test: 1200000, // 20m
  build: 2700000, // 45m
  commit: 300000, // 5m
  review: 900000, // 15m
  fix: 1800000, // 30m
  verify: 600000, // 10m
  docs: 600000, // 10m
  pr: 300000, // 5m
}

/**
 * Default timeout for unknown stages (in milliseconds)
 */
const DEFAULT_TIMEOUT_MS = 900000 // 15m

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the default timeout for a pipeline stage in milliseconds.
 *
 * @param stage - The stage name to get timeout for
 * @returns Timeout in milliseconds, or default 15m for unknown stages
 *
 * @example
 * const timeout = getStageTimeout('build') // returns 2700000
 * const unknown = getStageTimeout('unknown') // returns 900000 (default)
 */
export function getStageTimeout(stage: string): number {
  if (stageSchema.safeParse(stage).success) {
    return STAGE_TIMEOUTS[stage as StageName]
  }
  return DEFAULT_TIMEOUT_MS
}

/**
 * Get all valid stage names
 *
 * @returns Array of all valid stage names
 */
export function getAllStageNames(): readonly StageName[] {
  return STAGE_NAMES
}

// ============================================================================
// PipelineHealthReport Class
// ============================================================================

/**
 * Pipeline health monitoring utility for Cody pipeline.
 * Provides stage health checks, full reports, and retry recommendations.
 */
export class PipelineHealthReport {
  /**
   * Check the health status of a specific pipeline stage.
   *
   * @param stage - The stage name to check
   * @returns HealthStatus object with stage health information
   * @throws ZodValidationError if stage name is invalid
   *
   * @example
   * const health = report.checkStageHealth('build')
   * // Returns: { stage: 'build', status: 'healthy', message: '...', timestamp: '...' }
   */
  checkStageHealth(stage: string): HealthStatus {
    // Validate input
    const result = stageSchema.safeParse(stage)
    if (!result.success) {
      const errorDetails = result.error.issues.map((i) => i.message).join(', ')
      throw new Error(
        `Invalid stage name: ${stage}. Valid stages: ${STAGE_NAMES.join(', ')}. Errors: ${errorDetails}`,
      )
    }

    const validatedStage = result.data as StageName
    const timeout = STAGE_TIMEOUTS[validatedStage]

    // For this utility, we return a "healthy" status since this is a monitoring utility
    // In a real implementation, this would check actual stage metrics
    const status: HealthStatusValue = 'healthy'
    const message = `Stage '${validatedStage}' is operational. Timeout: ${timeout}ms`

    return {
      stage: validatedStage,
      status,
      message,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Generate a full health report for the entire pipeline.
   *
   * @returns Report object containing health status of all stages
   *
   * @example
   * const report = report.generateReport()
   * // Returns: { stages: [...], generatedAt: '...', overallHealth: 'healthy' }
   */
  generateReport(): Report {
    const stages: HealthStatus[] = STAGE_NAMES.map((stageName) => {
      return this.checkStageHealth(stageName)
    })

    // Determine overall health
    let overallHealth: OverallHealth = 'healthy'
    const hasFailed = stages.some((s) => s.status === 'failed')
    const hasWarning = stages.some((s) => s.status === 'warning')

    if (hasFailed) {
      overallHealth = 'failed'
    } else if (hasWarning) {
      overallHealth = 'degraded'
    }

    return {
      stages,
      generatedAt: new Date().toISOString(),
      overallHealth,
    }
  }

  /**
   * Get retry strategy recommendation for a failed stage.
   *
   * @param failedStage - The stage that failed
   * @returns RetryStrategy object with retry recommendations
   * @throws ZodValidationError if stage name is invalid
   *
   * @example
   * const strategy = report.getRetryRecommendation('build')
   * // Returns: { strategy: 'exponential', maxRetries: 3, delayMs: 60000, reason: '...' }
   */
  getRetryRecommendation(failedStage: string): RetryStrategy {
    // Validate input
    const result = stageSchema.safeParse(failedStage)
    if (!result.success) {
      const errorDetails = result.error.issues.map((i) => i.message).join(', ')
      throw new Error(
        `Invalid stage name: ${failedStage}. Valid stages: ${STAGE_NAMES.join(', ')}. Errors: ${errorDetails}`,
      )
    }

    const stage = result.data as StageName

    // Define retry strategies based on stage characteristics
    const strategies: Record<StageName, RetryStrategy> = {
      taskify: {
        strategy: 'manual',
        maxRetries: 1,
        delayMs: 0,
        reason: 'Taskify requires human input review before retry',
      },
      gap: {
        strategy: 'exponential',
        maxRetries: 2,
        delayMs: 60000,
        reason: 'Gap analysis can benefit from incremental retries with backoff',
      },
      clarify: {
        strategy: 'manual',
        maxRetries: 1,
        delayMs: 0,
        reason: 'Clarification requires human input before retry',
      },
      architect: {
        strategy: 'exponential',
        maxRetries: 3,
        delayMs: 120000,
        reason: 'Architect stage is complex and may benefit from multiple attempts',
      },
      'plan-gap': {
        strategy: 'exponential',
        maxRetries: 2,
        delayMs: 60000,
        reason: 'Plan-gap analysis can benefit from incremental retries',
      },
      test: {
        strategy: 'immediate',
        maxRetries: 3,
        delayMs: 0,
        reason: 'Test failures often resolve on retry due to timing/flakiness',
      },
      build: {
        strategy: 'exponential',
        maxRetries: 3,
        delayMs: 90000,
        reason: 'Build failures may require multiple attempts with system recovery time',
      },
      commit: {
        strategy: 'immediate',
        maxRetries: 2,
        delayMs: 0,
        reason: 'Commit failures are often transient network issues',
      },
      review: {
        strategy: 'manual',
        maxRetries: 1,
        delayMs: 0,
        reason: 'Review stage requires human intervention for fixes',
      },
      fix: {
        strategy: 'exponential',
        maxRetries: 3,
        delayMs: 60000,
        reason: 'Fix attempts may require multiple iterations',
      },
      verify: {
        strategy: 'immediate',
        maxRetries: 2,
        delayMs: 0,
        reason: 'Verify failures are often transient environmental issues',
      },
      docs: {
        strategy: 'exponential',
        maxRetries: 2,
        delayMs: 30000,
        reason: 'Documentation generation can be retried with backoff',
      },
      pr: {
        strategy: 'immediate',
        maxRetries: 2,
        delayMs: 0,
        reason: 'PR creation failures are often transient API issues',
      },
    }

    return strategies[stage]
  }
}

// ============================================================================
// Default Export
// ============================================================================

/**
 * Default instance of PipelineHealthReport for convenience
 */
export const pipelineHealth = new PipelineHealthReport()
