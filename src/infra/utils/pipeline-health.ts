/**
 * @fileType utility
 * @domain infra
 * @pattern pipeline-health, zod-validation
 * @ai-summary Pipeline health monitoring utility for Cody pipeline stages
 */

import { z } from 'zod'

// =============================================================================
// TypeScript Interfaces
// =============================================================================

/**
 * Represents the health status of a pipeline stage
 */
export interface HealthStatus {
  /** Name of the stage */
  stage: string
  /** Whether the stage is healthy */
  isHealthy: boolean
  /** Timestamp of the last health check */
  lastCheck: Date
  /** Optional message providing additional context */
  message?: string
}

/**
 * Represents a comprehensive pipeline health report
 */
export interface Report {
  /** Timestamp when the report was generated */
  timestamp: Date
  /** Array of health statuses for all stages */
  stages: HealthStatus[]
  /** Overall health classification */
  overallHealth: 'healthy' | 'degraded' | 'unhealthy'
}

/**
 * Represents retry recommendations for a failed stage
 */
export interface RetryStrategy {
  /** Name of the stage */
  stage: string
  /** Recommended number of retry attempts */
  recommendedRetries: number
  /** Backoff multiplier for exponential backoff */
  backoffMultiplier: number
  /** Whether retrying is recommended */
  shouldRetry: boolean
}

// =============================================================================
// Zod Input Validation Schemas
// =============================================================================

/** Schema for validating stage names in checkStageHealth */
const checkStageHealthSchema = z.string().min(1, 'Stage name is required')

/** Schema for validating stage names in getRetryRecommendation */
const getRetryRecommendationSchema = z.string().min(1, 'Stage name is required')

// =============================================================================
// Known Pipeline Stages
// =============================================================================

/** Known pipeline stage names */
const KNOWN_STAGES = [
  'taskify',
  'gap',
  'architect',
  'plan-gap',
  'build',
  'review',
  'fix',
  'verify',
  'commit',
  'docs',
] as const

/** Type for known stage names */
type KnownStage = (typeof KNOWN_STAGES)[number]

/**
 * Default timeout values in milliseconds per stage name
 * These represent typical maximum execution times for each pipeline stage
 */
const STAGE_TIMEOUTS: Record<KnownStage, number> = {
  taskify: 30000, // 30 seconds
  gap: 60000, // 1 minute
  architect: 120000, // 2 minutes
  'plan-gap': 90000, // 1.5 minutes
  build: 300000, // 5 minutes
  review: 180000, // 3 minutes
  fix: 120000, // 2 minutes
  verify: 60000, // 1 minute
  commit: 30000, // 30 seconds
  docs: 60000, // 1 minute
}

/** Default timeout for unknown stages (in milliseconds) */
const DEFAULT_TIMEOUT = 60000 // 1 minute

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Returns the default timeout value for a given stage name
 * @param stage - The name of the pipeline stage
 * @returns Timeout value in milliseconds, or DEFAULT_TIMEOUT if stage is unknown
 */
export function getStageTimeout(stage: string): number {
  const normalizedStage = stage.toLowerCase() as KnownStage
  return STAGE_TIMEOUTS[normalizedStage] ?? DEFAULT_TIMEOUT
}

// =============================================================================
// PipelineHealthReport Class
// =============================================================================

/**
 * Class for monitoring Cody pipeline health
 */
export class PipelineHealthReport {
  /**
   * Known stages tracked by this health reporter
   */
  private readonly trackedStages: readonly string[] = KNOWN_STAGES

  /**
   * Check the health status of a pipeline stage
   * @param stage - The name of the stage to check
   * @returns HealthStatus object with current health information
   * @throws ZodError if stage name is invalid (empty string)
   */
  checkStageHealth(stage: string): HealthStatus {
    // Validate input
    const validatedStage = checkStageHealthSchema.parse(stage)

    // Normalize stage name
    const normalizedStage = validatedStage.toLowerCase()

    // Check if stage is known
    const isKnown = this.trackedStages.includes(normalizedStage as KnownStage)

    return {
      stage: normalizedStage,
      isHealthy: isKnown,
      lastCheck: new Date(),
      message: isKnown
        ? `Stage '${normalizedStage}' is healthy`
        : `Stage '${normalizedStage}' is unknown but may be healthy`,
    }
  }

  /**
   * Generate a comprehensive health report for all tracked stages
   * @returns Report object with health status of all stages
   */
  generateReport(): Report {
    const stageStatuses: HealthStatus[] = this.trackedStages.map((stage) =>
      this.checkStageHealth(stage),
    )

    // Determine overall health
    const healthyCount = stageStatuses.filter((s) => s.isHealthy).length
    const totalCount = stageStatuses.length
    const healthyRatio = healthyCount / totalCount

    let overallHealth: 'healthy' | 'degraded' | 'unhealthy'
    if (healthyRatio === 1) {
      overallHealth = 'healthy'
    } else if (healthyRatio >= 0.5) {
      overallHealth = 'degraded'
    } else {
      overallHealth = 'unhealthy'
    }

    return {
      timestamp: new Date(),
      stages: stageStatuses,
      overallHealth,
    }
  }

  /**
   * Get retry strategy recommendations for a failed stage
   * @param failedStage - The name of the failed stage
   * @returns RetryStrategy with retry recommendations
   * @throws ZodError if stage name is invalid (empty string)
   */
  getRetryRecommendation(failedStage: string): RetryStrategy {
    // Validate input
    const validatedStage = getRetryRecommendationSchema.parse(failedStage)

    // Normalize stage name
    const normalizedStage = validatedStage.toLowerCase()

    // Check if stage is known
    const isKnownStage = this.trackedStages.includes(normalizedStage as KnownStage)

    // Provide different recommendations based on whether stage is known
    if (isKnownStage) {
      return {
        stage: normalizedStage,
        recommendedRetries: 3,
        backoffMultiplier: 2,
        shouldRetry: true,
      }
    }

    return {
      stage: normalizedStage,
      recommendedRetries: 1,
      backoffMultiplier: 1.5,
      shouldRetry: false,
    }
  }
}
