/**
 * @fileType utility
 * @domain cody | pipeline
 * @ai-summary Pipeline health monitoring utility for the Cody pipeline system
 */

import { z } from 'zod'

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Represents the health status of a pipeline stage
 */
export interface HealthStatus {
  /** Name of the stage */
  stage: string
  /** Whether the stage is considered healthy */
  isHealthy: boolean
  /** Optional message providing additional context */
  message?: string
  /** ISO timestamp when the status was generated */
  timestamp: string
}

/**
 * Represents a comprehensive health report for all pipeline stages
 */
export interface Report {
  /** ISO timestamp when the report was generated */
  generatedAt: string
  /** List of health statuses for all stages */
  stages: HealthStatus[]
  /** Overall health status of the pipeline */
  overallHealthy: boolean
  /** Human-readable summary of the report */
  summary: string
}

/**
 * Represents retry recommendations for failed stages
 */
export interface RetryStrategy {
  /** Name of the stage that failed */
  stage: string
  /** Recommended number of retry attempts */
  recommendedRetries: number
  /** Multiplier for exponential backoff between retries */
  backoffMultiplier: number
  /** Whether retry is recommended */
  shouldRetry: boolean
  /** Optional reason for the recommendation */
  reason?: string
}

// ============================================================================
// Zod Schemas for Input Validation
// ============================================================================

/**
 * Valid pipeline stage names
 */
const VALID_STAGES = [
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

const stageNameSchema = z
  .string()
  .refine(
    (val): val is (typeof VALID_STAGES)[number] =>
      (VALID_STAGES as readonly string[]).includes(val),
    { message: `Invalid stage name. Valid stages: ${VALID_STAGES.join(', ')}` },
  )

const checkStageHealthSchema = z.object({
  stage: stageNameSchema,
})

const getRetryRecommendationSchema = z.object({
  failedStage: stageNameSchema,
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Default timeout values in milliseconds for each pipeline stage
 */
const STAGE_TIMEOUTS: Record<string, number> = {
  taskify: 10 * 60 * 1000, // 10 minutes
  gap: 15 * 60 * 1000, // 15 minutes
  clarify: 10 * 60 * 1000, // 10 minutes
  architect: 30 * 60 * 1000, // 30 minutes
  'plan-gap': 15 * 60 * 1000, // 15 minutes
  test: 20 * 60 * 1000, // 20 minutes
  build: 45 * 60 * 1000, // 45 minutes
  commit: 5 * 60 * 1000, // 5 minutes
  review: 15 * 60 * 1000, // 15 minutes
  fix: 45 * 60 * 1000, // 45 minutes
  verify: 10 * 60 * 1000, // 10 minutes
  docs: 10 * 60 * 1000, // 10 minutes
  pr: 5 * 60 * 1000, // 5 minutes
}

/**
 * Get the default timeout in milliseconds for a given pipeline stage.
 * @param stage - The name of the pipeline stage
 * @returns The timeout in milliseconds
 * @throws ZodError if the stage name is invalid
 */
export function getStageTimeout(stage: string): number {
  const result = stageNameSchema.safeParse(stage)
  if (!result.success) {
    throw result.error
  }
  return STAGE_TIMEOUTS[stage] ?? 0
}

// ============================================================================
// PipelineHealthReport Class
// ============================================================================

/**
 * Provides pipeline health monitoring capabilities for the Cody pipeline system.
 * Use this class to check stage health status, generate comprehensive reports,
 * and get retry recommendations for failed stages.
 */
export class PipelineHealthReport {
  /**
   * Default timeout values in milliseconds for each pipeline stage
   */
  private static readonly STAGE_TIMEOUTS = STAGE_TIMEOUTS

  /**
   * Valid stage names
   */
  private static readonly VALID_STAGES = VALID_STAGES

  /**
   * Check the health status of a given pipeline stage.
   * @param stage - The name of the stage to check
   * @returns The health status of the stage
   * @throws ZodError if the stage name is invalid
   */
  checkStageHealth(stage: string): HealthStatus {
    const result = checkStageHealthSchema.safeParse({ stage })
    if (!result.success) {
      throw result.error
    }

    const timestamp = new Date().toISOString()
    const timeout = STAGE_TIMEOUTS[stage]

    return {
      stage,
      isHealthy: true,
      message: `Stage is configured with a ${timeout / 60000} minute timeout`,
      timestamp,
    }
  }

  /**
   * Generate a comprehensive health report for all pipeline stages.
   * @returns A complete health report with status for all stages
   */
  generateReport(): Report {
    const generatedAt = new Date().toISOString()
    const stages: HealthStatus[] = []

    for (const stageName of VALID_STAGES) {
      const timeout = STAGE_TIMEOUTS[stageName]
      stages.push({
        stage: stageName,
        isHealthy: true,
        message: `Stage is configured with a ${timeout / 60000} minute timeout`,
        timestamp: generatedAt,
      })
    }

    const overallHealthy = stages.every((s) => s.isHealthy)
    const healthyCount = stages.filter((s) => s.isHealthy).length

    return {
      generatedAt,
      stages,
      overallHealthy,
      summary: `Pipeline health report: ${healthyCount}/${stages.length} stages are healthy`,
    }
  }

  /**
   * Get retry strategy recommendations for a failed stage.
   * @param failedStage - The name of the stage that failed
   * @returns The recommended retry strategy
   * @throws ZodError if the stage name is invalid
   */
  getRetryRecommendation(failedStage: string): RetryStrategy {
    const result = getRetryRecommendationSchema.safeParse({ failedStage })
    if (!result.success) {
      throw result.error
    }

    // Determine retry recommendations based on stage type
    const agentStages = [
      'taskify',
      'gap',
      'clarify',
      'architect',
      'plan-gap',
      'test',
      'build',
      'review',
      'fix',
      'docs',
    ]
    const gitStages = ['commit', 'pr']
    const scriptedStages = ['verify']

    let recommendedRetries: number
    let backoffMultiplier: number
    let reason: string

    if (agentStages.includes(failedStage)) {
      recommendedRetries = 2
      backoffMultiplier = 2
      reason = 'Agent stages may benefit from retry with exponential backoff'
    } else if (gitStages.includes(failedStage)) {
      recommendedRetries = 1
      backoffMultiplier = 1.5
      reason = 'Git operations should be retried with moderate backoff'
    } else if (scriptedStages.includes(failedStage)) {
      recommendedRetries = 3
      backoffMultiplier = 1.5
      reason = 'Scripted stages can be retried more aggressively'
    } else {
      recommendedRetries = 1
      backoffMultiplier = 2
      reason = 'Default retry recommendation'
    }

    return {
      stage: failedStage,
      recommendedRetries,
      backoffMultiplier,
      shouldRetry: recommendedRetries > 0,
      reason,
    }
  }
}
