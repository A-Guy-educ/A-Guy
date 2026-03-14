/**
 * @fileType types
 * @domain cody | engine
 * @pattern state-machine
 * @ai-summary Core types for the Cody pipeline state machine architecture
 */

import { z } from 'zod'

// ============================================================================
// Stage Types
// ============================================================================

export type StageType = 'agent' | 'scripted' | 'git' | 'gate'

export type StageOutcome = 'completed' | 'failed' | 'paused' | 'timed_out' | 'skipped'

export interface StageResult {
  outcome: StageOutcome
  reason?: string
  retries: number
  outputFile?: string
  /** Token usage for this stage */
  tokenUsage?: { input: number; output: number; cacheRead: number }
  /** Cost in USD for this stage */
  cost?: number
  /** OpenCode session ID for this stage */
  sessionId?: string
}

// ============================================================================
// Stage Definition
// ============================================================================

export interface SkipResult {
  shouldSkip: boolean
  reason?: string
}

// Re-export ValidationResult from agent-runner
import type { ValidationResult } from '../agent-runner'
export type { ValidationResult }

/**
 * Optional preExecute hook that runs before the handler.
 * Used by build stage for ensureFeatureBranch.
 */
export type StagePreExecute = (ctx: PipelineContext) => Promise<void>

export interface StageDefinition {
  name: string
  type: StageType
  timeout: number
  maxRetries: number
  shouldSkip?: (ctx: PipelineContext) => SkipResult
  validator?: (outputFile: string) => ValidationResult
  postActions?: PostAction[]
  advisory?: boolean
  preExecute?: StagePreExecute
  /**
   * Minimum complexity score (1-100) for this stage to run.
   * Informational only — actual routing uses STAGE_COMPLEXITY_THRESHOLDS
   * in skip-conditions.ts. Keep in sync with STAGE_COMPLEXITY_THRESHOLDS.
   */
  minComplexity?: number
  /**
   * Called when agent exits 0 but doesn't produce the expected output file.
   * Returns the fallback content to write, or null to proceed with normal retry/fail.
   */
  fallbackOnMissingOutput?: (ctx: PipelineContext) => string | null
  /**
   * Override the agent name used by opencode. Defaults to stage name.
   * Used when a stage should run a different agent (e.g., fix stage runs build agent).
   */
  agentName?: string
}

// ============================================================================
// Pipeline Definition
// ============================================================================

export type PipelineStep = string | { parallel: string[] }

export interface PipelineDefinition {
  stages: Map<string, StageDefinition>
  order: PipelineStep[]
}

// ============================================================================
// Pipeline Context
// ============================================================================

import type { CodyInput } from '../cody-utils'
import type { TaskDefinition } from '../pipeline-utils'
import type { RunnerBackend } from '../runner-backend'

export interface PipelineContext {
  taskId: string
  taskDir: string
  input: CodyInput
  taskDef: TaskDefinition | null
  profile: 'standard' | 'lightweight' | 'turbo'
  backend: RunnerBackend
  // Set by resolve-profile post-action to signal engine to rebuild pipeline
  pipelineNeedsRebuild?: boolean
  /** URL of the running OpenCode server (e.g., 'http://localhost:4097') */
  serverUrl?: string
  /** Most recent agent stage's sessionID — downstream stages fork from this */
  lastSessionId?: string
  /** GitHub login of the person who triggered this run (from GITHUB_ACTOR env var) */
  actor?: string
}

// Note: NO controlMode field — each gate resolves it dynamically via
// resolveControlMode(ctx.taskDef, ctx.input.controlMode) (G42)

// ============================================================================
// Pipeline State V2 (status.json schema)
// ============================================================================

export interface StageStateV2 {
  state: 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'skipped' | 'paused'
  startedAt?: string
  completedAt?: string
  elapsed?: number
  retries: number
  outputFile?: string
  skipped?: string
  error?: string
  feedbackLoops?: number
  feedbackErrors?: string[]
  /** Current fix attempt number (for verify→fix loop) */
  fixAttempt?: number
  /** Maximum allowed fix attempts (for verify→fix loop) */
  maxFixAttempts?: number
  /** Whether the review stage found issues that need fixing */
  issuesFound?: boolean
  /** Review summary counts */
  reviewSummary?: {
    critical: number
    major: number
    minor: number
  }
  /** Token usage for cost tracking */
  tokenUsage?: { input: number; output: number; cacheRead: number }
  /** Cost in USD */
  cost?: number
  /** OpenCode session ID for rerun recovery */
  sessionId?: string
}

/** A single actor event in the pipeline audit trail */
export interface ActorEvent {
  /** Action type: pipeline-triggered, gate-approved, gate-rejected, stage-retried, etc. */
  action: string
  /** GitHub login of the person who performed the action */
  actor: string
  /** ISO timestamp */
  timestamp: string
  /** Stage name, if action is stage-specific */
  stage?: string
}

export interface PipelineStateV2 {
  version: 2
  taskId: string
  mode: string
  pipeline: string
  startedAt: string
  updatedAt: string
  completedAt?: string
  totalElapsed?: number
  state: 'running' | 'completed' | 'failed' | 'timeout' | 'paused'
  cursor: string | null
  stages: Record<string, StageStateV2>
  /** GitHub issue number that triggered this pipeline run */
  issueNumber?: number
  /** Git branch name created for this task (set after ensureFeatureBranch) */
  branchName?: string
  /** Total accumulated cost across all stages in USD */
  totalCost?: number
  /** GitHub login of the person who triggered this pipeline run */
  triggeredBy?: string
  /** Audit trail of actor actions. Capped at 50 entries (oldest dropped first). */
  actorHistory?: ActorEvent[]
}

// Zod schema for PipelineStateV2
export const PipelineStateV2Schema: z.ZodType<PipelineStateV2> = z.object({
  version: z.literal(2),
  taskId: z.string(),
  mode: z.string(),
  pipeline: z.string(),
  startedAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
  totalElapsed: z.number().optional(),
  state: z.enum(['running', 'completed', 'failed', 'timeout', 'paused']),
  cursor: z.string().nullable(),
  issueNumber: z.number().optional(),
  branchName: z.string().optional(),
  totalCost: z.number().optional(),
  stages: z.record(
    z.string(),
    z.object({
      state: z.enum(['pending', 'running', 'completed', 'failed', 'timeout', 'skipped', 'paused']),
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
      elapsed: z.number().optional(),
      retries: z.number(),
      outputFile: z.string().optional(),
      skipped: z.string().optional(),
      error: z.string().optional(),
      feedbackLoops: z.number().optional(),
      feedbackErrors: z.array(z.string()).optional(),
      fixAttempt: z.number().optional(),
      maxFixAttempts: z.number().optional(),
      issuesFound: z.boolean().optional(),
      reviewSummary: z
        .object({
          critical: z.number(),
          major: z.number(),
          minor: z.number(),
        })
        .optional(),
      tokenUsage: z
        .object({
          input: z.number(),
          output: z.number(),
          cacheRead: z.number(),
        })
        .optional(),
      cost: z.number().optional(),
      sessionId: z.string().optional(),
    }),
  ),
})

/**
 * Type guard to validate v2 status.json format
 */
export function isPipelineStateV2(obj: unknown): obj is PipelineStateV2 {
  if (!obj || typeof obj !== 'object') return false
  const result = PipelineStateV2Schema.safeParse(obj)
  return result.success
}

// ============================================================================
// Post-Action Types
// ============================================================================

// Validate-task-json action
export type ValidateTaskJsonAction = {
  type: 'validate-task-json'
}

// Set-classification-labels action
export type SetClassificationLabelsAction = {
  type: 'set-classification-labels'
}

// Resolve-profile action
export type ResolveProfileAction = {
  type: 'resolve-profile'
}

// Check-gate action
export type CheckGateAction = {
  type: 'check-gate'
  gate: string
  includeArtifact?: string // e.g., 'plan.md' for architect gate
}

// Commit-task-files action
export type CommitTaskFilesAction = {
  type: 'commit-task-files'
  stagingStrategy: 'task-only' | 'tracked-only' | 'tracked+task'
  push: boolean
  ensureBranch: boolean
  cleanDirtyState?: boolean
  commitMessage?: string
  localOnly?: boolean // G18: only commit in local mode
}

// Archive-rerun-feedback action
export type ArchiveRerunFeedbackAction = {
  type: 'archive-rerun-feedback'
}

// Validate-plan-exists action
export type ValidatePlanExistsAction = {
  type: 'validate-plan-exists'
}

// Validate-build-content action
export type ValidateBuildContentAction = {
  type: 'validate-build-content'
}

// Run-tsc action
export type RunTscAction = {
  type: 'run-tsc'
}

// Run-unit-tests action
export type RunUnitTestsAction = {
  type: 'run-unit-tests'
}

// Run-quality-with-autofix action — feedback loop that retries with autofix agent
export type RunQualityWithAutofixAction = {
  type: 'run-quality-with-autofix'
  gates: Array<{ name: string; command: string; source: 'tsc' | 'lint' | 'format' | 'test' }>
  maxFeedbackLoops: number
}

// Validate-src-changes action — ensures build agent modified source files
export type ValidateSrcChangesAction = {
  type: 'validate-src-changes'
}

// Analyze-review-findings action - parses review.md to determine if fix needed
export type AnalyzeReviewFindingsAction = {
  type: 'analyze-review-findings'
}

// Clear-verify-failures action - clears previous verify failures for retry
export type ClearVerifyFailuresAction = {
  type: 'clear-verify-failures'
}

// Parallel-post-action - runs multiple actions concurrently
export type ParallelPostAction = {
  type: 'parallel'
  actions: PostAction[]
}

// Post-action discriminated union
export type PostAction =
  | ValidateTaskJsonAction
  | SetClassificationLabelsAction
  | ResolveProfileAction
  | CheckGateAction
  | CommitTaskFilesAction
  | ArchiveRerunFeedbackAction
  | ValidatePlanExistsAction
  | ValidateBuildContentAction
  | ValidateSrcChangesAction
  | RunTscAction
  | RunUnitTestsAction
  | RunQualityWithAutofixAction
  | AnalyzeReviewFindingsAction
  | ClearVerifyFailuresAction
  | ParallelPostAction

// ============================================================================
// Lifecycle Hooks
// ============================================================================

export interface LifecycleHooks {
  onStateChange?: (
    prevState: PipelineStateV2 | null,
    nextState: PipelineStateV2,
    ctx: PipelineContext,
  ) => void
}

// ============================================================================
// Pipeline Paused Error
// ============================================================================

/**
 * Thrown when the pipeline intentionally pauses (e.g., hard-stop / risk gate).
 * Caught in main() to post a ⏸️ comment instead of ✅ completed.
 */
export class PipelinePausedError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'PipelinePausedError'
  }
}

// ============================================================================
// Re-exports from other modules for convenience
// ============================================================================

// Re-export CodyInput for use throughout the engine
export type { CodyInput } from '../cody-utils'

// Re-export ControlMode and TaskDefinition from pipeline-utils
export type { ControlMode, TaskDefinition } from '../pipeline-utils'
