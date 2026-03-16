/**
 * @fileType utility
 * @domain ci | cody | github
 * @pattern cody-pipeline | github-api | status-tracking
 * @ai-summary CI-specific utilities for the Cody pipeline: comment parsing, GitHub API helpers, status management
 */

import { logger } from './logger'
import * as fs from 'fs'
import * as path from 'path'

import { STAGE_NAMES } from './stages/registry'

// ============================================================================
// Types
// ============================================================================

export interface CodyInput {
  mode: 'spec' | 'impl' | 'rerun' | 'fix' | 'full' | 'status'
  taskId: string
  dryRun: boolean
  fromStage?: string
  feedback?: string
  issueNumber?: number
  triggerType?: 'dispatch' | 'comment'
  runId?: string
  runUrl?: string
  // For comment triggers: raw body to parse
  commentBody?: string
  // Local mode: use pnpm ocode run instead of opencode github run
  local?: boolean
  // Path to task description file (for auto-generating task-id and task.md)
  file?: string
  // Opt-in to run clarify stage (default: skip, auto-create clarified.md)
  clarify?: boolean
  // Control mode override: auto, risk-gated, hard-stop
  controlMode?: 'auto' | 'risk-gated' | 'hard-stop'
  // Pipeline version: branch, tag, or commit to overlay (overrides CODY_DEFAULT_VERSION)
  version?: string
  // Complexity score override (1-100) for testing/debugging
  complexityOverride?: number
  // Whether the trigger was from a PR comment (vs issue comment)
  isPullRequest?: boolean
  // Force create new PR (new branch) - ignores existing PR
  fresh?: boolean
  // Turbo mode: forces minimal pipeline (build→commit→verify→pr), CLI-only flag
  turbo?: boolean
  /** GitHub login of the person who triggered this pipeline run (from GITHUB_ACTOR env var) */
  actor?: string
  /** GitHub login of the person who created the issue (from ISSUE_CREATOR env var) */
  issueCreator?: string
}

export interface ActorEvent {
  action: string
  actor: string
  timestamp: string
  stage?: string
}

export interface CodyPipelineStatus {
  taskId: string
  mode: string
  pipeline: string
  startedAt: string
  updatedAt: string
  completedAt?: string
  totalElapsed?: number
  state: 'running' | 'completed' | 'failed' | 'timeout' | 'paused'
  currentStage: string | null
  stages: Record<string, StageStatus>
  triggeredBy: string
  issueNumber?: number
  runId?: string
  runUrl?: string
  controlMode?: 'auto' | 'risk-gated' | 'hard-stop'
  gatePoint?: string
  botCommentId?: number
  /** Total accumulated cost across all stages in USD */
  totalCost?: number
  /** GitHub login of the person who triggered this pipeline run */
  triggeredByLogin?: string
  /** GitHub login of the person who created the issue (the "owner") */
  issueCreator?: string
  /** Audit trail of actor actions (capped at 50 entries) */
  actorHistory?: ActorEvent[]
}

export interface StageStatus {
  state: 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'skipped' | 'gate-waiting'
  startedAt?: string
  completedAt?: string
  elapsed?: number
  retries: number
  outputFile?: string
  skipped?: string // Reason for skip (e.g., 'input_quality')
  error?: string
  // Token usage for cost tracking
  tokenUsage?: {
    input: number
    output: number
  }
  /** Cost in USD */
  cost?: number
}

// ============================================================================
// Validation
// ============================================================================

export const VALID_MODES = ['spec', 'impl', 'rerun', 'fix', 'full', 'status'] as const

// VALID_STAGES derived from registry to avoid duplication
// Note: includes 'autofix' for backward compat with comment parsing validation
export const VALID_STAGES = [...STAGE_NAMES, 'autofix' as const]

// Pipeline-ordered stage list for sorting (avoids `as any` cast on readonly tuple)
const STAGE_ORDER: readonly string[] = STAGE_NAMES

export function isValidMode(mode: string): mode is (typeof VALID_MODES)[number] {
  return VALID_MODES.includes(mode as (typeof VALID_MODES)[number])
}

export function isValidStage(stage: string): stage is (typeof VALID_STAGES)[number] {
  return VALID_STAGES.includes(stage as (typeof VALID_STAGES)[number])
}

export function validateTaskId(taskId: string): boolean {
  // Format: YYMMDD-description (e.g., 260217-user-metrics)
  return /^[0-9]{6}-[a-zA-Z0-9-]+$/.test(taskId)
}

// ============================================================================
// Status Management
// ============================================================================

export function getTaskDir(taskId: string): string {
  return path.join(process.cwd(), '.tasks', taskId)
}

export function ensureTaskDir(taskId: string): string {
  const dir = getTaskDir(taskId)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * @deprecated Use engine/status.ts loadState/writeState/completeState instead.
 * This function is kept for backward compatibility with existing tests.
 */
export function readStatus(taskId: string): CodyPipelineStatus | null {
  const statusFile = path.join(getTaskDir(taskId), 'status.json')
  if (!fs.existsSync(statusFile)) {
    return null
  }
  try {
    return JSON.parse(fs.readFileSync(statusFile, 'utf-8'))
  } catch {
    return null
  }
}

/**
 * Get the last failed stage from status.json for smart rerun default.
 * Returns the stage name that most recently failed, or null if none.
 * Updated to use v2 schema (G(utils-1/2)).
 */
export function getLastFailedStage(taskId: string): string | null {
  const statusFile = path.join(getTaskDir(taskId), 'status.json')
  if (!fs.existsSync(statusFile)) {
    return null
  }

  try {
    const content = fs.readFileSync(statusFile, 'utf-8')
    const status = JSON.parse(content) as {
      version?: number
      stages?: Record<string, { state: string }>
    }

    // Check if it's v2 format (has version: 2)
    if (status.version === 2 && status.stages) {
      const failedStages = Object.entries(status.stages)
        .filter(([, s]) => s.state === 'failed' || s.state === 'timeout')
        .map(([name]) => name)
      // Sort by pipeline order (ALL_STAGES index) to get truly last failed stage
      failedStages.sort((a, b) => {
        const idxA = STAGE_ORDER.indexOf(a)
        const idxB = STAGE_ORDER.indexOf(b)
        return idxA - idxB
      })
      return failedStages.length > 0 ? failedStages[failedStages.length - 1] : null
    }

    // Fallback to v1 format
    if (status?.stages) {
      const failedStages = Object.entries(status.stages)
        .filter(([, s]) => s.state === 'failed' || s.state === 'timeout')
        .map(([name]) => name)
      // Sort by pipeline order (ALL_STAGES index) to get truly last failed stage
      failedStages.sort((a, b) => {
        const idxA = STAGE_ORDER.indexOf(a)
        const idxB = STAGE_ORDER.indexOf(b)
        return idxA - idxB
      })
      return failedStages.length > 0 ? failedStages[failedStages.length - 1] : null
    }

    return null
  } catch {
    return null
  }
}

/**
 * Get the last paused stage from status.json.
 * Used by rerun mode to detect gates that are waiting for approval.
 * Returns the stage name that has state 'paused', or null if none.
 */
export function getLastPausedStage(taskId: string): string | null {
  const statusFile = path.join(getTaskDir(taskId), 'status.json')
  if (!fs.existsSync(statusFile)) {
    return null
  }

  try {
    const content = fs.readFileSync(statusFile, 'utf-8')
    const status = JSON.parse(content) as {
      version?: number
      stages?: Record<string, { state: string }>
    }

    // Check for paused stages in v2 format
    if (status.version === 2 && status.stages) {
      const pausedStages = Object.entries(status.stages)
        .filter(([, s]) => s.state === 'paused')
        .map(([name]) => name)
      // Sort by pipeline order (ALL_STAGES index) to get truly last paused stage
      pausedStages.sort((a, b) => {
        const idxA = STAGE_ORDER.indexOf(a)
        const idxB = STAGE_ORDER.indexOf(b)
        return idxA - idxB
      })
      // Return the last paused stage (most recent in pipeline order)
      return pausedStages.length > 0 ? pausedStages[pausedStages.length - 1] : null
    }

    // Fallback to v1 format
    if (status?.stages) {
      const pausedStages = Object.entries(status.stages)
        .filter(([, s]) => s.state === 'paused')
        .map(([name]) => name)
      // Sort by pipeline order (ALL_STAGES index) to get truly last paused stage
      pausedStages.sort((a, b) => {
        const idxA = STAGE_ORDER.indexOf(a)
        const idxB = STAGE_ORDER.indexOf(b)
        return idxA - idxB
      })
      return pausedStages.length > 0 ? pausedStages[pausedStages.length - 1] : null
    }

    return null
  } catch {
    return null
  }
}

/**
 * @deprecated Use engine/status.ts loadState/writeState/completeState instead.
 */
export function writeStatus(taskId: string, status: CodyPipelineStatus): void {
  const statusFile = path.join(getTaskDir(taskId), 'status.json')
  // Atomic write: write to temp file then rename to prevent corruption
  // if the process is killed mid-write (e.g., timeout SIGKILL).
  const tmpFile = statusFile + '.tmp'
  fs.writeFileSync(tmpFile, JSON.stringify(status, null, 2))
  fs.renameSync(tmpFile, statusFile)
}

/**
 * @deprecated Use engine/status.ts loadState/writeState/completeState instead.
 */
export function initStatus(input: CodyInput): CodyPipelineStatus {
  const now = new Date().toISOString()
  const status: CodyPipelineStatus = {
    taskId: input.taskId,
    mode: input.mode,
    pipeline: 'spec_execute_verify', // will be updated after taskify
    startedAt: now,
    updatedAt: now,
    state: 'running',
    currentStage: null,
    stages: {},
    triggeredBy: input.triggerType || 'dispatch',
    issueNumber: input.issueNumber,
    runId: input.runId,
    runUrl: input.runUrl,
  }
  writeStatus(input.taskId, status)
  return status
}

/**
 * Update stage status with read-modify-write to status.json.
 *
 * Concurrency safety: parallel stages (e.g., verify + pr) call this from
 * separate promise callbacks, but Node.js is single-threaded — only one
 * callback runs at a time, so read-modify-write is atomic on the event loop.
 * The atomic writeStatus (write-to-tmp + rename) guards against corruption
 * from process kills (SIGTERM/SIGKILL during write).
 */

/**
 * @deprecated Use engine/status.ts loadState/writeState/completeState instead.
 */
export function updateStageStatus(
  taskId: string,
  stage: string,
  state: StageStatus['state'],
  extras?: Partial<StageStatus>,
): void {
  const status = readStatus(taskId)
  if (!status) {
    logger.warn(`No status file found for task: ${taskId}`)
    return
  }

  const now = new Date().toISOString()

  if (!status.stages[stage]) {
    status.stages[stage] = {
      state,
      retries: 0,
      ...extras,
    }
  }

  const stageStatus = status.stages[stage]

  // Apply extras (retries, outputFile, error) — works for both new and existing stages
  if (extras) {
    if (extras.retries !== undefined) stageStatus.retries = extras.retries
    if (extras.outputFile !== undefined) stageStatus.outputFile = extras.outputFile
    if (extras.error !== undefined) stageStatus.error = extras.error
  }

  if (state === 'running') {
    stageStatus.state = 'running'
    stageStatus.startedAt = now
  } else if (state === 'completed' || state === 'failed' || state === 'timeout') {
    stageStatus.state = state
    stageStatus.completedAt = now
    if (stageStatus.startedAt) {
      stageStatus.elapsed = new Date(now).getTime() - new Date(stageStatus.startedAt).getTime()
    }
  }

  status.currentStage = state === 'running' ? stage : status.currentStage
  status.updatedAt = now
  writeStatus(taskId, status)
}

/**
 * @deprecated Use engine/status.ts loadState/writeState/completeState instead.
 */
export function completeStatus(taskId: string, state: CodyPipelineStatus['state']): void {
  const status = readStatus(taskId)
  if (!status) return

  const now = new Date().toISOString()
  status.state = state
  status.updatedAt = now
  status.completedAt = now
  if (status.startedAt) {
    status.totalElapsed = new Date(now).getTime() - new Date(status.startedAt).getTime()
  }
  writeStatus(taskId, status)
}

// GitHub API re-exports removed — import directly from './github-api'

// ============================================================================
// Auth Validation
// ============================================================================

// Note: opencode github run handles OIDC auth internally via the id-token permission.
// We don't need to validate a token ourselves - each invocation handles its own auth.
export function validateAuth(): void {
  // Check we're in GitHub Actions environment (where OIDC auth is available)
  if (!process.env.GITHUB_ACTIONS) {
    logger.warn('⚠ Not running in GitHub Actions — OIDC auth may not work')
    logger.warn('  Run locally or in CI with id-token: write permission')
  } else {
    logger.info('✓ Running in GitHub Actions — OIDC auth available via id-token permission')
  }
}

// ============================================================================
// Re-exports for backward compatibility
// Import directly from './cli-parser' or './status-format' for new code
// ============================================================================

export { parseCliArgs, parseCommentBody } from './cli-parser'
export { formatDuration, formatStatusComment, formatStatusCommentV2 } from './status-format'
