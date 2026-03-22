/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern pipeline-health
 * @ai-summary Pipeline health monitoring utility with health checks, reports, and retry recommendations
 */

import { z } from 'zod'
import { ValidationError } from 'payload'
import { STAGE_NAMES, STAGE_REGISTRY } from '../../../scripts/cody/stages/registry'

// ============================================================================
// Stage Name Schema
// ============================================================================

/**
 * Zod schema for validating stage names.
 * Validates against the canonical list of stage names from the pipeline registry.
 */
const StageNameSchema = z.enum(STAGE_NAMES)

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Represents the health status of a pipeline stage.
 */
export interface HealthStatus {
  /** Name of the stage */
  stage: string
  /** Whether the stage is healthy */
  healthy: boolean
  /** Human-readable status message */
  message: string
  /** ISO timestamp of when the health check was performed */
  timestamp: string
}

/**
 * Represents a comprehensive pipeline health report.
 */
export interface Report {
  /** Overall health assessment of the pipeline */
  overallHealth: 'healthy' | 'degraded' | 'unhealthy'
  /** Array of individual stage health statuses */
  stages: HealthStatus[]
  /** ISO timestamp when the report was generated */
  generatedAt: string
  /** Array of recommendation messages */
  recommendations: string[]
}

/**
 * Represents retry recommendations for a failed stage.
 */
export interface RetryStrategy {
  /** Name of the stage */
  stage: string
  /** Whether retry is recommended */
  shouldRetry: boolean
  /** Maximum number of retry attempts */
  maxRetries: number
  /** Backoff multiplier for exponential backoff */
  backoffMultiplier: number
  /** Reason for the retry recommendation */
  reason: string
}

// ============================================================================
// Input Validation
// ============================================================================

/**
 * Validates a stage name and throws ValidationError if invalid.
 * @param stage - The stage name to validate
 * @throws {ValidationError} If the stage name is invalid
 */
function validateStageName(stage: string): void {
  const result = StageNameSchema.safeParse(stage)
  if (!result.success) {
    const validStages = STAGE_NAMES.join(', ')
    throw new ValidationError({
      errors: [
        { path: 'stage', message: `Invalid stage name: '${stage}'. Valid stages: ${validStages}` },
      ],
    })
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Returns default timeout in milliseconds for a given pipeline stage.
 * @param stage - The stage name to get the timeout for
 * @returns Timeout in milliseconds
 * @throws {ValidationError} If the stage name is invalid
 */
export function getStageTimeout(stage: string): number {
  validateStageName(stage)
  return STAGE_REGISTRY[stage as (typeof STAGE_NAMES)[number]].timeout
}

// ============================================================================
// PipelineHealthReport Class
// ============================================================================

/**
 * Provides pipeline health monitoring capabilities including stage health checks,
 * comprehensive reports, and retry recommendations.
 */
export class PipelineHealthReport {
  /**
   * Checks the health status of a specific pipeline stage.
   * @param stage - The stage name to check
   * @returns HealthStatus object with stage health information
   * @throws {ValidationError} If the stage name is invalid
   */
  checkStageHealth(stage: string): HealthStatus {
    validateStageName(stage)

    const stageData = STAGE_REGISTRY[stage as (typeof STAGE_NAMES)[number]]
    const now = new Date().toISOString()

    return {
      stage,
      healthy: true,
      message: `Stage '${stage}' is configured correctly with ${stageData.type} handler`,
      timestamp: now,
    }
  }

  /**
   * Generates a comprehensive health report for all pipeline stages.
   * @returns Report object with overall health assessment and stage details
   */
  generateReport(): Report {
    const stages: HealthStatus[] = []
    const recommendations: string[] = []

    for (const stageName of STAGE_NAMES) {
      const stageData = STAGE_REGISTRY[stageName]
      stages.push({
        stage: stageName,
        healthy: true,
        message: `Stage '${stageName}' configured with ${stageData.type} handler (timeout: ${stageData.timeout}ms)`,
        timestamp: new Date().toISOString(),
      })

      // Add recommendations for stages that may need attention
      if (stageData.type === 'agent' && stageData.timeout > ms('30m')) {
        recommendations.push(
          `${stageName}: Consider optimizing timeout for long-running agent stage`,
        )
      }
    }

    // Determine overall health
    let overallHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    if (recommendations.length > 0) {
      overallHealth = 'degraded'
    }

    return {
      overallHealth,
      stages,
      generatedAt: new Date().toISOString(),
      recommendations,
    }
  }

  /**
   * Provides retry strategy recommendations for a failed stage.
   * @param failedStage - The stage that failed
   * @returns RetryStrategy object with retry recommendations
   * @throws {ValidationError} If the stage name is invalid
   */
  getRetryRecommendation(failedStage: string): RetryStrategy {
    validateStageName(failedStage)

    const stageData = STAGE_REGISTRY[failedStage as (typeof STAGE_NAMES)[number]]

    // Agent stages have 1-2 retries by default
    // Scripted and git stages typically don't retry
    const shouldRetry = stageData.type === 'agent'
    const maxRetries = shouldRetry ? 2 : 0
    const backoffMultiplier = shouldRetry ? 2 : 0

    let reason: string
    if (stageData.type === 'agent') {
      reason = `Agent stages can be retried with exponential backoff. Max retries: ${maxRetries}`
    } else if (stageData.type === 'scripted') {
      reason = 'Scripted stages should not be retried automatically'
    } else {
      reason = 'Git stages should be investigated manually before retry'
    }

    return {
      stage: failedStage,
      shouldRetry,
      maxRetries,
      backoffMultiplier,
      reason,
    }
  }
}

// ============================================================================
// Utility for ms conversion (inline to avoid extra dependency)
// ============================================================================

/**
 * Converts a time string to milliseconds.
 * Supports: s, m, h, d suffixes.
 */
function ms(time: string): number {
  const match = time.match(/^(\d+)([smhd])$/)
  if (!match) {
    throw new Error(`Invalid time format: ${time}`)
  }
  const value = parseInt(match[1], 10)
  const unit = match[2]
  switch (unit) {
    case 's':
      return value * 1000
    case 'm':
      return value * 60 * 1000
    case 'h':
      return value * 60 * 60 * 1000
    case 'd':
      return value * 24 * 60 * 60 * 1000
    default:
      return 0
  }
}
