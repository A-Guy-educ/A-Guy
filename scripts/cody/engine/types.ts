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
   * Called when agent exits 0 but doesn't produce the expected output file.
   * Returns the fallback content to write, or null to proceed with normal retry/fail.
   */
  fallbackOnMissingOutput?: (ctx: PipelineContext) => string | null
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
  profile: 'standard' | 'lightweight'
  backend: RunnerBackend
  // Set by resolve-profile post-action to signal engine to rebuild pipeline
  pipelineNeedsRebuild?: boolean
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

// Commit-audit-history action
export type CommitAuditHistoryAction = {
  type: 'commit-audit-history'
}

// Parallel-post-action - runs multiple actions concurrently
export type ParallelPostAction = {
  type: 'parallel'
  actions: PostAction[]
}

// Post-action discriminated union
export type PostAction =
  | ValidateTaskJsonAction
  | ResolveProfileAction
  | CheckGateAction
  | CommitTaskFilesAction
  | ArchiveRerunFeedbackAction
  | ValidatePlanExistsAction
  | ValidateBuildContentAction
  | RunTscAction
  | RunUnitTestsAction
  | RunQualityWithAutofixAction
  | CommitAuditHistoryAction
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
