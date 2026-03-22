/**
 * @fileType orchestrator
 * @domain cody | pipeline | orchestrator
 * @pattern real-time-orchestration
 * @ai-summary Real-time pipeline orchestrator that intercepts stage execution and makes decisions on errors
 */

import type {
  PipelineContext,
  PipelineStateV2,
  StageDefinition,
  StageResult,
} from '../engine/types'
import type { StageName } from '../stages/registry'
import { logger } from '../logger'

// ============================================================================
// Decision Types
// ============================================================================

export type Decision =
  | { action: 'retry'; reason: string; delayMs?: number }
  | { action: 'skip'; reason: string }
  | { action: 'escalate'; reason: string; error: Error }
  | { action: 'halt'; reason: string; error: Error }
  | { action: 'continue'; reason: string }

/**
 * Error categories that determine how the orchestrator handles failures
 */
export type ErrorCategory =
  /** Technical errors that are safe to retry (timeouts, network, transient) */
  | 'technical'
  /** Business logic errors requiring human judgment (edge cases, bad data) */
  | 'business_logic'
  /** Data quality issues that should halt the pipeline */
  | 'data_quality'
  /** Validation failures from quality gates */
  | 'validation'
  /** Unknown error category */
  | 'unknown'

export interface ErrorClassification {
  category: ErrorCategory
  reason: string
  retryable: boolean
  shouldEscalate: boolean
}

export interface OrchestratorContext {
  taskId: string
  taskDir: string
  stageName: StageName
  attempt: number
  maxAttempts: number
  error: Error | StageResult
  previousErrors: Error[]
  startTime: number
}

export interface RetryPolicy {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

export interface EscalationConfig {
  slackWebhookUrl?: string
  githubIssue?: {
    owner: string
    repo: string
    issueNumber: number
  }
  notifyOnFirstFailure: boolean
  notifyOnMaxRetries: boolean
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
}

const DEFAULT_ESCALATION_CONFIG: EscalationConfig = {
  notifyOnFirstFailure: false,
  notifyOnMaxRetries: true,
}

// ============================================================================
// Error Classification Patterns
// ============================================================================

const TECHNICAL_ERROR_PATTERNS = [
  /timeout/i,
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /ENOTFOUND/i,
  /ETIMEDOUT/i,
  /network/i,
  /socket/i,
  /EPIPE/i,
  /temporary failure/i,
  /temporary error/i,
  /rate limit/i,
  /429/,
  /503/,
  /502/,
  /504/,
]

const VALIDATION_ERROR_PATTERNS = [
  /tsc.*error/i,
  /typescript.*error/i,
  /lint.*error/i,
  /eslint/i,
  /prettier/i,
  /format/i,
  /test.*fail/i,
  /vitest.*fail/i,
  /assertion/i,
  /expect/i,
]

const DATA_QUALITY_ERROR_PATTERNS = [
  /invalid.*json/i,
  /parse.*error/i,
  /schema.*violation/i,
  /missing.*required/i,
  /constraint.*violation/i,
  /empty.*response/i,
  /malformed/i,
]

// ============================================================================
// Pipeline Orchestrator
// ============================================================================

export class PipelineOrchestrator {
  private retryPolicy: RetryPolicy
  private escalationConfig: EscalationConfig
  private errorLog: Map<string, Error[]> = new Map()
  private decisionLog: Decision[] = []
  private notifyCallbacks: Array<(notification: EscalationNotification) => Promise<void>> = []

  constructor(
    retryPolicy: Partial<RetryPolicy> = {},
    escalationConfig: Partial<EscalationConfig> = {},
  ) {
    this.retryPolicy = { ...DEFAULT_RETRY_POLICY, ...retryPolicy }
    this.escalationConfig = { ...DEFAULT_ESCALATION_CONFIG, ...escalationConfig }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Classify an error to determine how to handle it
   */
  classifyError(error: Error | string, context: OrchestratorContext): ErrorClassification {
    const errorMessage = error instanceof Error ? error.message : error

    // Check technical errors first
    for (const pattern of TECHNICAL_ERROR_PATTERNS) {
      if (pattern.test(errorMessage)) {
        return {
          category: 'technical',
          reason: `Matched technical error pattern: ${pattern.source}`,
          retryable: true,
          shouldEscalate: false,
        }
      }
    }

    // Check validation errors
    for (const pattern of VALIDATION_ERROR_PATTERNS) {
      if (pattern.test(errorMessage)) {
        return {
          category: 'validation',
          reason: `Matched validation error pattern: ${pattern.source}`,
          retryable: true,
          shouldEscalate: context.attempt >= 2, // Escalate after 2+ attempts
        }
      }
    }

    // Check data quality errors
    for (const pattern of DATA_QUALITY_ERROR_PATTERNS) {
      if (pattern.test(errorMessage)) {
        return {
          category: 'data_quality',
          reason: `Matched data quality error pattern: ${pattern.source}`,
          retryable: false,
          shouldEscalate: true,
        }
      }
    }

    // Default to business logic - requires human judgment
    return {
      category: 'unknown',
      reason: 'Unclassified error - requires human judgment',
      retryable: false,
      shouldEscalate: true,
    }
  }

  /**
   * Make a decision on how to handle a stage failure
   */
  decide(context: OrchestratorContext, classification: ErrorClassification): Decision {
    const { stageName, attempt, maxAttempts, error } = context

    // Log the error
    this.logError(stageName, error)

    // Log the decision
    const decision = this.computeDecision(context, classification)
    this.logDecision(decision)

    logger.info(
      `  🎯 Orchestrator decision for ${stageName}: ${decision.action} - ${decision.reason}`,
    )

    return decision
  }

  /**
   * Get the next retry delay using exponential backoff
   */
  getRetryDelay(attempt: number): number {
    const delay =
      this.retryPolicy.baseDelayMs * Math.pow(this.retryPolicy.backoffMultiplier, attempt - 1)
    return Math.min(delay, this.retryPolicy.maxDelayMs)
  }

  /**
   * Register a notification callback (e.g., Slack, GitHub issue comment)
   */
  onNotify(callback: (notification: EscalationNotification) => Promise<void>): void {
    this.notifyCallbacks.push(callback)
  }

  /**
   * Send escalation notification
   */
  async escalate(notification: EscalationNotification): Promise<void> {
    logger.info(`  📢 Escalating: ${notification.title}`)

    for (const callback of this.notifyCallbacks) {
      try {
        await callback(notification)
      } catch (err) {
        logger.error({ err }, 'Escalation notification failed')
      }
    }
  }

  /**
   * Get orchestrator stats for debugging
   */
  getStats(): OrchestratorStats {
    const stageStats: Record<string, StageStats> = {}

    for (const [stageName, errors] of this.errorLog.entries()) {
      stageStats[stageName] = {
        totalErrors: errors.length,
        errorTypes: this.categorizeErrors(errors, stageName),
        lastError: errors[errors.length - 1]?.message,
      }
    }

    return {
      totalDecisions: this.decisionLog.length,
      decisionsByAction: this.countDecisionsByAction(),
      stageStats,
    }
  }

  /**
   * Clear error history (useful for reruns)
   */
  reset(): void {
    this.errorLog.clear()
    this.decisionLog = []
  }

  // ============================================================================
  // Internal Methods
  // ============================================================================

  private computeDecision(
    context: OrchestratorContext,
    classification: ErrorClassification,
  ): Decision {
    const { stageName, attempt, maxAttempts, error } = context

    // Data quality errors should halt immediately
    if (classification.category === 'data_quality') {
      return {
        action: 'halt',
        reason: `Data quality error: ${classification.reason}`,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }

    // Check if we've exceeded max attempts
    if (attempt >= maxAttempts) {
      if (classification.shouldEscalate) {
        return {
          action: 'escalate',
          reason: `Max attempts (${maxAttempts}) exceeded, escalating for human review`,
          error: error instanceof Error ? error : new Error(String(error)),
        }
      }
      return {
        action: 'halt',
        reason: `Max attempts (${maxAttempts}) exceeded, non-retryable error`,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }

    // Technical errors: retry with backoff
    if (classification.category === 'technical' && classification.retryable) {
      const delayMs = this.getRetryDelay(attempt)
      return {
        action: 'retry',
        reason: `Technical error, will retry with ${delayMs}ms backoff: ${classification.reason}`,
        delayMs,
      }
    }

    // Validation errors: retry up to 2 times, then escalate
    if (classification.category === 'validation' && classification.retryable) {
      if (attempt >= 2) {
        return {
          action: 'escalate',
          reason: `Validation failed after ${attempt} attempts, escalating for human review`,
          error: error instanceof Error ? error : new Error(String(error)),
        }
      }
      return {
        action: 'retry',
        reason: `Validation error, retrying: ${classification.reason}`,
      }
    }

    // Unknown/business logic errors: escalate for human judgment
    if (classification.shouldEscalate || !classification.retryable) {
      return {
        action: 'escalate',
        reason: `Requires human judgment: ${classification.reason}`,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }

    // Default: continue (shouldn't reach here normally)
    return {
      action: 'continue',
      reason: 'No specific decision, continuing pipeline',
    }
  }

  private logError(stageName: StageName, error: Error | StageResult): void {
    const errors = this.errorLog.get(stageName) || []
    const errorObj = error instanceof Error ? error : new Error(error.reason || 'Unknown error')
    errors.push(errorObj)
    this.errorLog.set(stageName, errors)
  }

  private logDecision(decision: Decision): void {
    this.decisionLog.push(decision)
  }

  private categorizeErrors(errors: Error[], stageName: string): Record<string, number> {
    const counts: Record<string, number> = {}

    for (const error of errors) {
      const classification = this.classifyError(error.message, {
        taskId: '',
        taskDir: '',
        stageName: stageName as StageName,
        attempt: 0,
        maxAttempts: 0,
        error,
        previousErrors: [],
        startTime: 0,
      })

      counts[classification.category] = (counts[classification.category] || 0) + 1
    }

    return counts
  }

  private countDecisionsByAction(): Record<string, number> {
    const counts: Record<string, number> = {}

    for (const decision of this.decisionLog) {
      counts[decision.action] = (counts[decision.action] || 0) + 1
    }

    return counts
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface EscalationNotification {
  stageName: StageName
  title: string
  message: string
  error?: string
  context: {
    taskId: string
    taskDir: string
    attempt: number
    maxAttempts: number
  }
  timestamp: string
}

export interface OrchestratorStats {
  totalDecisions: number
  decisionsByAction: Record<string, number>
  stageStats: Record<string, StageStats>
}

export interface StageStats {
  totalErrors: number
  errorTypes: Record<string, number>
  lastError?: string
}

// ============================================================================
// Orchestrator Integration Hooks
// ============================================================================

export interface OrchestratorHooks {
  orchestrator: PipelineOrchestrator
  onDecision?: (
    decision: Decision,
    context: OrchestratorContext,
    classification: ErrorClassification,
  ) => Promise<Decision | null>
  onEscalation?: (notification: EscalationNotification) => Promise<void>
}

/**
 * Create a default orchestrator with sensible defaults
 */
export function createDefaultOrchestrator(): PipelineOrchestrator {
  return new PipelineOrchestrator()
}

/**
 * Create orchestrator hooks that integrate with the state machine
 */
export function createOrchestratorHooks(
  orchestrator: PipelineOrchestrator,
  options?: {
    onDecision?: OrchestratorHooks['onDecision']
    onEscalation?: OrchestratorHooks['onEscalation']
  },
): OrchestratorHooks {
  return {
    orchestrator,
    onDecision: options?.onDecision,
    onEscalation: options?.onEscalation,
  }
}

// ============================================================================
// Orchestrator-aware error wrapper
// ============================================================================

export class OrchestratedError extends Error {
  public readonly originalError: Error
  public readonly decision: Decision
  public readonly classification: ErrorClassification

  constructor(
    message: string,
    originalError: Error,
    decision: Decision,
    classification: ErrorClassification,
  ) {
    super(message)
    this.name = 'OrchestratedError'
    this.originalError = originalError
    this.decision = decision
    this.classification = classification
  }
}
