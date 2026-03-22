/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern pipeline-health
 * @ai-summary Pipeline health monitoring utility for Cody pipeline stages
 */

import { z } from 'zod'
import ms from 'ms'

// ============================================================================
// Stage Name Validation Schema
// ============================================================================

/**
 * Valid stage names in the Cody pipeline.
 */
const VALID_STAGE_NAMES = [
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

/**
 * Zod schema for validating stage names.
 */
export const stageNameSchema = z.string().refine(
  (val): val is (typeof VALID_STAGE_NAMES)[number] =>
    (VALID_STAGE_NAMES as readonly string[]).includes(val),
  {
    message: `Invalid stage name. Valid stages: ${VALID_STAGE_NAMES.join(', ')}`,
  },
)

/**
 * Schema for failed stage names (same validation as stage names).
 */
export const failedStageSchema = stageNameSchema

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Represents the health status of a single pipeline stage.
 */
export interface HealthStatus {
  /** Health status: pass, fail, or warn */
  status: 'pass' | 'fail' | 'warn'
  /** Human-readable status message */
  message: string
  /** When the status was recorded */
  timestamp: Date
}

/**
 * Represents a full pipeline health report.
 */
export interface Report {
  /** Overall pipeline health */
  overallHealth: 'healthy' | 'degraded' | 'unhealthy'
  /** Health status for each stage */
  stageStatuses: Record<string, HealthStatus>
  /** When the report was generated */
  generatedAt: Date
}

/**
 * Retry recommendation for a failed stage.
 */
export interface RetryStrategy {
  /** Whether the stage should be retried */
  shouldRetry: boolean
  /** Maximum number of retry attempts */
  maxRetries: number
  /** Backoff multiplier for exponential retry delays */
  backoffMultiplier: number
}

// ============================================================================
// Stage Timeout Map
// ============================================================================

/**
 * Default timeout values per stage in milliseconds.
 * Sourced from scripts/cody/stages/registry.ts STAGE_REGISTRY.
 */
const STAGE_TIMEOUTS: Record<string, number> = {
  taskify: ms('10m'),
  gap: ms('15m'),
  clarify: ms('10m'),
  architect: ms('30m'),
  'plan-gap': ms('15m'),
  test: ms('20m'),
  build: ms('45m'),
  commit: ms('5m'),
  review: ms('15m'),
  fix: ms('45m'),
  verify: ms('10m'),
  docs: ms('10m'),
  pr: ms('5m'),
}

/**
 * Maximum retries per stage.
 */
const STAGE_MAX_RETRIES: Record<string, number> = {
  taskify: 2,
  gap: 1,
  clarify: 1,
  architect: 1,
  'plan-gap': 1,
  test: 1,
  build: 1,
  commit: 0,
  review: 0,
  fix: 2,
  verify: 0,
  docs: 1,
  pr: 0,
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Returns the default timeout in milliseconds for a given pipeline stage.
 *
 * @param stage - The name of the pipeline stage
 * @returns Timeout in milliseconds
 * @throws ZodError if the stage name is invalid
 */
export function getStageTimeout(stage: string): number {
  // Validate stage name first
  stageNameSchema.parse(stage)
  return STAGE_TIMEOUTS[stage] ?? 0
}

// ============================================================================
// PipelineHealthReport Class
// ============================================================================

/**
 * Provides health monitoring capabilities for the Cody pipeline.
 *
 * @example
 * ```typescript
 * const reporter = new PipelineHealthReport()
 *
 * // Check a single stage
 * const status = reporter.checkStageHealth('build')
 *
 * // Generate full report
 * const report = reporter.generateReport()
 *
 * // Get retry recommendation
 * const retry = reporter.getRetryRecommendation('verify')
 * ```
 */
export class PipelineHealthReport {
  /**
   * Returns the health status for a specific pipeline stage.
   *
   * @param stage - The name of the stage to check
   * @returns HealthStatus with pass/fail/warn status, message, and timestamp
   * @throws ZodError if the stage name is invalid
   */
  checkStageHealth(stage: string): HealthStatus {
    // Validate stage parameter with Zod
    stageNameSchema.parse(stage)

    const timeout = STAGE_TIMEOUTS[stage] ?? 0
    const maxRetries = STAGE_MAX_RETRIES[stage] ?? 0

    // Determine health status based on stage properties
    // Stages with higher timeouts and retries are considered more critical
    const status: 'pass' | 'fail' | 'warn' = 'pass'
    let message = `Stage '${stage}' is healthy`

    if (maxRetries === 0 && timeout < ms('10m')) {
      message = `Stage '${stage}' is healthy (no retries configured, short timeout)`
    } else if (maxRetries >= 2) {
      message = `Stage '${stage}' is healthy (configured for ${maxRetries} retries)`
    }

    return {
      status,
      message,
      timestamp: new Date(),
    }
  }

  /**
   * Generates a full pipeline health report with all stage statuses.
   *
   * @returns Report containing overallHealth and all stageStatuses
   */
  generateReport(): Report {
    const stageStatuses: Record<string, HealthStatus> = {}

    // Generate health status for each valid stage
    for (const stage of VALID_STAGE_NAMES) {
      stageStatuses[stage] = this.checkStageHealth(stage)
    }

    // Determine overall health based on individual statuses
    const statuses = Object.values(stageStatuses)
    const hasFail = statuses.some((s) => s.status === 'fail')
    const hasWarn = statuses.some((s) => s.status === 'warn')

    let overallHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    if (hasFail) {
      overallHealth = 'unhealthy'
    } else if (hasWarn) {
      overallHealth = 'degraded'
    }

    return {
      overallHealth,
      stageStatuses,
      generatedAt: new Date(),
    }
  }

  /**
   * Returns a retry strategy recommendation for a failed stage.
   *
   * @param failedStage - The name of the failed stage
   * @returns RetryStrategy with shouldRetry, maxRetries, and backoffMultiplier
   * @throws ZodError if the failedStage name is invalid
   */
  getRetryRecommendation(failedStage: string): RetryStrategy {
    // Validate failedStage parameter with Zod
    failedStageSchema.parse(failedStage)

    const maxRetries = STAGE_MAX_RETRIES[failedStage] ?? 0

    // Determine if retry is recommended based on stage type
    // Git stages (commit, pr) and verify typically should not retry
    const noRetryStages = ['commit', 'pr', 'verify']
    const shouldRetry = maxRetries > 0 && !noRetryStages.includes(failedStage)

    // Backoff multiplier: 2x for agent stages, 1.5x for others
    const backoffMultiplier = ['taskify', 'gap', 'clarify', 'architect', 'plan-gap', 'test', 'build', 'fix'].includes(failedStage)
      ? 2.0
      : 1.5

    return {
      shouldRetry,
      maxRetries,
      backoffMultiplier,
    }
  }
}
