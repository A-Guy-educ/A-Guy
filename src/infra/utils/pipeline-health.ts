/**
 * @fileType utility
 * @domain infra
 * @pattern pipeline-health
 * @ai-summary Pipeline health monitoring utility for Cody pipeline stages
 */

import { z } from 'zod'

// ============================================================================
// Stage Names - defined locally to avoid coupling with scripts/cody/stages/registry.ts
// ============================================================================

/**
 * All valid pipeline stage names in the Cody pipeline.
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
 * Health status of a pipeline stage.
 */
export interface HealthStatus {
  stage: string
  status: 'healthy' | 'degraded' | 'failed' | 'unknown'
  timestamp: string
  message?: string
}

/**
 * Full pipeline health report.
 */
export interface Report {
  stages: HealthStatus[]
  overallHealth: number
  generatedAt: string
}

/**
 * Retry strategy configuration for failed stages.
 */
export interface RetryStrategy {
  maxRetries: number
  backoffMs: number
  strategyType: 'fixed' | 'exponential' | 'linear'
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * Zod schema for validating stage names.
 */
export const stageNameSchema = z.enum(STAGE_NAMES)

/**
 * Zod schema for validating HealthStatus.
 */
export const healthStatusSchema = z.object({
  stage: z.string(),
  status: z.enum(['healthy', 'degraded', 'failed', 'unknown']),
  timestamp: z.string().datetime(),
  message: z.string().optional(),
})

/**
 * Zod schema for validating RetryStrategy.
 */
export const retryStrategySchema = z.object({
  maxRetries: z.number().int().nonnegative(),
  backoffMs: z.number().int().positive(),
  strategyType: z.enum(['fixed', 'exponential', 'linear']),
})

/**
 * Zod schema for validating stage input in methods.
 */
export const stageInputSchema = z.string().min(1, 'Stage name is required')

// ============================================================================
// Default Timeout Values (in milliseconds)
// ============================================================================

/**
 * Default timeout values per pipeline stage (in milliseconds).
 */
const DEFAULT_TIMEOUTS: Record<StageName, number> = {
  taskify: 10 * 60 * 1000, // 10 minutes
  gap: 15 * 60 * 1000, // 15 minutes
  clarify: 10 * 60 * 1000, // 10 minutes
  architect: 15 * 60 * 1000, // 15 minutes
  'plan-gap': 10 * 60 * 1000, // 10 minutes
  test: 10 * 60 * 1000, // 10 minutes
  build: 15 * 60 * 1000, // 15 minutes
  commit: 5 * 60 * 1000, // 5 minutes
  review: 10 * 60 * 1000, // 10 minutes
  fix: 10 * 60 * 1000, // 10 minutes
  verify: 15 * 60 * 1000, // 15 minutes
  docs: 5 * 60 * 1000, // 5 minutes
  pr: 5 * 60 * 1000, // 5 minutes
}

/**
 * Default timeout for unknown stages (5 minutes).
 */
const DEFAULT_TIMEOUT = 5 * 60 * 1000

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Returns the default timeout for a given pipeline stage.
 * @param stage - The pipeline stage name
 * @returns Timeout in milliseconds
 */
export function getStageTimeout(stage: string): number {
  // Validate input
  const parsed = stageInputSchema.safeParse(stage)
  if (!parsed.success) {
    return DEFAULT_TIMEOUT
  }

  // Check if stage is valid
  const isValidStage = STAGE_NAMES.includes(stage as StageName)
  if (!isValidStage) {
    return DEFAULT_TIMEOUT
  }

  return DEFAULT_TIMEOUTS[stage as StageName]
}

/**
 * Retry strategy by stage category.
 */
const STAGE_RETRY_STRATEGIES: Record<string, RetryStrategy> = {
  // Agent stages - exponential backoff
  taskify: { maxRetries: 3, backoffMs: 5000, strategyType: 'exponential' },
  gap: { maxRetries: 3, backoffMs: 5000, strategyType: 'exponential' },
  clarify: { maxRetries: 3, backoffMs: 5000, strategyType: 'exponential' },
  architect: { maxRetries: 3, backoffMs: 5000, strategyType: 'exponential' },
  'plan-gap': { maxRetries: 3, backoffMs: 5000, strategyType: 'exponential' },
  // Build stages - fixed backoff
  test: { maxRetries: 2, backoffMs: 2000, strategyType: 'fixed' },
  build: { maxRetries: 2, backoffMs: 2000, strategyType: 'fixed' },
  commit: { maxRetries: 2, backoffMs: 2000, strategyType: 'fixed' },
  // Review stages - linear backoff
  review: { maxRetries: 3, backoffMs: 3000, strategyType: 'linear' },
  fix: { maxRetries: 3, backoffMs: 3000, strategyType: 'linear' },
  verify: { maxRetries: 3, backoffMs: 3000, strategyType: 'linear' },
  // Post-processing - fixed backoff
  docs: { maxRetries: 2, backoffMs: 1000, strategyType: 'fixed' },
  pr: { maxRetries: 2, backoffMs: 1000, strategyType: 'fixed' },
}

/**
 * Default retry strategy for unknown stages.
 */
const DEFAULT_RETRY_STRATEGY: RetryStrategy = {
  maxRetries: 2,
  backoffMs: 2000,
  strategyType: 'fixed',
}

// ============================================================================
// PipelineHealthReport Class
// ============================================================================

/**
 * Pipeline health monitoring class for checking stage health,
 * generating reports, and recommending retry strategies.
 */
export class PipelineHealthReport {
  private stageHealthData: Map<string, HealthStatus>

  /**
   * Creates a new PipelineHealthReport instance.
   * @param initialData - Optional initial stage health data
   */
  constructor(initialData?: Record<string, HealthStatus>) {
    this.stageHealthData = new Map<string, HealthStatus>()
    if (initialData) {
      Object.entries(initialData).forEach(([stage, status]) => {
        this.stageHealthData.set(stage, status)
      })
    }
  }

  /**
   * Checks the health of a specific pipeline stage.
   * @param stage - The pipeline stage name to check
   * @returns HealthStatus object for the stage
   */
  checkStageHealth(stage: string): HealthStatus {
    // Validate input
    const parsed = stageInputSchema.safeParse(stage)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      throw new Error(`Invalid stage name: ${firstIssue?.message || 'validation failed'}`)
    }

    // Return existing data if available
    const existing = this.stageHealthData.get(stage)
    if (existing) {
      return existing
    }

    // Default: return healthy status
    return {
      stage,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Generates a full pipeline health report.
   * @returns Report object with all stage statuses
   */
  generateReport(): Report {
    const stages: HealthStatus[] = []

    // Collect health for all known stages
    STAGE_NAMES.forEach((stageName) => {
      const health = this.stageHealthData.get(stageName) || {
        stage: stageName,
        status: 'unknown' as const,
        timestamp: new Date().toISOString(),
      }
      stages.push(health)
    })

    // Calculate overall health percentage
    const healthyCount = stages.filter(
      (s) => s.status === 'healthy' || s.status === 'degraded',
    ).length
    const overallHealth = Math.round((healthyCount / stages.length) * 100)

    return {
      stages,
      overallHealth,
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * Gets a retry recommendation for a failed stage.
   * @param failedStage - The stage that failed
   * @returns RetryStrategy configuration
   */
  getRetryRecommendation(failedStage: string): RetryStrategy {
    // Validate input
    const parsed = stageInputSchema.safeParse(failedStage)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      throw new Error(`Invalid stage name: ${firstIssue?.message || 'validation failed'}`)
    }

    // Return strategy for known stage
    const strategy = STAGE_RETRY_STRATEGIES[failedStage]
    if (strategy) {
      return strategy
    }

    // Return default for unknown stage
    return DEFAULT_RETRY_STRATEGY
  }
}
