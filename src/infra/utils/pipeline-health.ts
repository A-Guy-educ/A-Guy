/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern pipeline-health
 * @ai-summary Pipeline health monitoring utility for Cody pipeline stages
 */

import { z } from 'zod'
import {
  getStageTimeout as getRegistryTimeout,
  STAGE_NAMES,
  isValidStageName,
} from '../../../scripts/cody/stages/registry'

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Represents the health status of a pipeline stage.
 */
export interface HealthStatus {
  /** The name of the pipeline stage */
  stage: string
  /** Whether the stage is currently healthy */
  isHealthy: boolean
  /** Timestamp of the last health check */
  lastChecked: Date
  /** Optional error message if the stage is unhealthy */
  errorMessage?: string
}

/**
 * Represents a comprehensive pipeline health report.
 */
export interface Report {
  /** Overall pipeline health status */
  overallStatus: 'healthy' | 'degraded' | 'unhealthy'
  /** Individual health status for each stage */
  stageStatuses: HealthStatus[]
  /** Timestamp when the report was generated */
  generatedAt: Date
}

/**
 * Represents retry strategy recommendations for a failed stage.
 */
export interface RetryStrategy {
  /** Maximum number of retry attempts */
  maxRetries: number
  /** Multiplier for exponential backoff */
  backoffMultiplier: number
  /** Base delay in milliseconds before retrying */
  retryDelay: number
  /** The stage this strategy applies to */
  stage: string
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * Schema for validating stage name inputs.
 * Validates that the input is a non-empty string that matches a known stage name.
 */
export const stageNameSchema = z
  .string()
  .min(1, 'Stage name must be a non-empty string')
  .refine((val): val is (typeof STAGE_NAMES)[number] => isValidStageName(val), {
    message: `Invalid stage name. Valid stages: ${STAGE_NAMES.join(', ')}`,
  })

/**
 * Schema for validating failed stage inputs.
 * Uses same validation as stageNameSchema since failedStage has same requirements.
 */
export const failedStageSchema = stageNameSchema

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the timeout for a stage in milliseconds.
 * Re-exports from the stage registry with validation.
 *
 * @param stage - The name of the stage
 * @returns Timeout in milliseconds, or fallback to 'build' stage timeout if unknown
 */
export function getStageTimeout(stage: string): number {
  if (isValidStageName(stage)) {
    return getRegistryTimeout(stage)
  }
  // Fallback to build stage timeout for unknown stages
  return getRegistryTimeout('build')
}

// ============================================================================
// PipelineHealthReport Class
// ============================================================================

/**
 * Provides pipeline health monitoring capabilities for Cody pipeline stages.
 * Maintains in-memory health state for all pipeline stages.
 */
export class PipelineHealthReport {
  private stageHealth: Map<string, HealthStatus>

  constructor() {
    // Initialize all stages as healthy
    this.stageHealth = new Map()
    for (const stageName of STAGE_NAMES) {
      this.stageHealth.set(stageName, {
        stage: stageName,
        isHealthy: true,
        lastChecked: new Date(),
      })
    }
  }

  /**
   * Check the health status of a specific pipeline stage.
   *
   * @param stage - The name of the stage to check
   * @returns The health status of the specified stage
   * @throws ZodError if the stage name is invalid
   */
  checkStageHealth(stage: string): HealthStatus {
    // Validate input - will throw ZodError if invalid
    stageNameSchema.parse(stage)

    const status = this.stageHealth.get(stage)
    if (!status) {
      // Unknown stage - return unhealthy status
      return {
        stage,
        isHealthy: false,
        lastChecked: new Date(),
        errorMessage: 'Unknown stage',
      }
    }
    return { ...status }
  }

  /**
   * Generate a comprehensive pipeline health report.
   *
   * @returns A report containing overall status and individual stage statuses
   */
  generateReport(): Report {
    const stageStatuses: HealthStatus[] = []
    let unhealthyCount = 0

    for (const stageName of STAGE_NAMES) {
      const status = this.stageHealth.get(stageName)
      if (status) {
        stageStatuses.push({ ...status })
        if (!status.isHealthy) {
          unhealthyCount++
        }
      }
    }

    // Calculate overall status based on number of unhealthy stages
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy'
    if (unhealthyCount === 0) {
      overallStatus = 'healthy'
    } else if (unhealthyCount <= 2) {
      overallStatus = 'degraded'
    } else {
      overallStatus = 'unhealthy'
    }

    return {
      overallStatus,
      stageStatuses,
      generatedAt: new Date(),
    }
  }

  /**
   * Get retry strategy recommendations for a failed stage.
   *
   * @param failedStage - The name of the failed stage
   * @returns Retry strategy for the specified stage
   * @throws ZodError if the stage name is invalid
   */
  getRetryRecommendation(failedStage: string): RetryStrategy {
    // Validate input - will throw ZodError if invalid
    failedStageSchema.parse(failedStage)

    // Get the timeout for this stage to base retry delay on
    const timeout = getStageTimeout(failedStage)

    // Default retry strategy based on stage timeout
    // Use 10% of timeout as base delay, with exponential backoff
    const baseDelay = Math.max(timeout * 0.1, 1000) // Minimum 1 second

    return {
      maxRetries: 3,
      backoffMultiplier: 2,
      retryDelay: baseDelay,
      stage: failedStage,
    }
  }
}
