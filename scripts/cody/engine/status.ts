/**
 * @fileType utility
 * @domain cody | engine
 * @pattern status-tracking
 * @ai-summary Status.json v2 operations with mandatory Zod validation
 */

import { logger } from '../logger'
import * as fs from 'fs'
import * as path from 'path'

import {
  PipelineStateV2,
  isPipelineStateV2,
  type PipelineContext,
  type StageStateV2,
  type ActorEvent,
} from './types'

// C3 FIX: Import stageOutputFile for correct path resolution in resetFromStage
import { stageOutputFile } from '../pipeline-utils'

// ============================================================================
// Status File Operations
// ============================================================================

/**
 * Get the status file path for a task
 */
function getStatusFilePath(taskId: string): string {
  const taskDir = path.join(process.cwd(), '.tasks', taskId)
  return path.join(taskDir, 'status.json')
}

/**
 * Load state from status.json with mandatory Zod validation.
 * Returns null on missing file, invalid JSON, or failed validation.
 */
export function loadState(taskId: string): PipelineStateV2 | null {
  const statusFile = getStatusFilePath(taskId)

  if (!fs.existsSync(statusFile)) {
    return null
  }

  try {
    const content = fs.readFileSync(statusFile, 'utf-8')
    const parsed = JSON.parse(content)

    // Validate with Zod schema
    if (!isPipelineStateV2(parsed)) {
      logger.warn(`Status file for ${taskId} is not valid v2 format, ignoring`)
      return null
    }

    return parsed
  } catch (error) {
    logger.warn({ err: error }, `Failed to load status for ${taskId}`)
    return null
  }
}

/**
 * Atomic write with fsync: write to temp file, flush to disk, then rename
 * to prevent corruption if the process is killed mid-write.
 */
export function writeState(taskId: string, state: PipelineStateV2): void {
  const statusFile = getStatusFilePath(taskId)
  const tmpFile = statusFile + '.tmp'

  // Ensure directory exists
  const dir = path.dirname(statusFile)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Atomic write with fsync: write to temp file, flush to disk, then rename
  const data = JSON.stringify(state, null, 2)
  const fd = fs.openSync(tmpFile, 'w')
  try {
    fs.writeSync(fd, data)
    fs.fdatasyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }
  fs.renameSync(tmpFile, statusFile)
}

/**
 * Delete the status.json file for a task.
 * Used by `full` mode to discard failed/completed state from a previous run
 * so that the pipeline starts fresh instead of short-circuiting.
 */
export function deleteState(taskId: string): void {
  const statusFile = getStatusFilePath(taskId)
  if (fs.existsSync(statusFile)) {
    fs.unlinkSync(statusFile)
    logger.info(`Deleted previous status.json for ${taskId} (fresh full-mode run)`)
  }
}

/**
 * Initialize a fresh v2 state
 */
export function initState(ctx: PipelineContext, mode: string): PipelineStateV2 {
  const now = new Date().toISOString()

  const actorHistory: ActorEvent[] = ctx.actor
    ? [{ action: 'pipeline-triggered', actor: ctx.actor, timestamp: now }]
    : []

  const state: PipelineStateV2 = {
    version: 2,
    taskId: ctx.taskId,
    mode,
    pipeline: 'spec_execute_verify', // will be updated after taskify
    startedAt: now,
    updatedAt: now,
    state: 'running',
    cursor: null,
    stages: {},
    // Persist issue number for dashboard lookups (avoids Compare API)
    ...(ctx.input.issueNumber ? { issueNumber: ctx.input.issueNumber } : {}),
    ...(ctx.actor ? { triggeredBy: ctx.actor } : {}),
    ...(ctx.input.issueCreator ? { issueCreator: ctx.input.issueCreator } : {}),
    ...(actorHistory.length > 0 ? { actorHistory } : {}),
  }

  writeState(ctx.taskId, state)
  return state
}

/** Max actor history entries kept in status.json (oldest dropped when exceeded) */
const MAX_ACTOR_HISTORY = 50

/**
 * Append an actor event to the pipeline's actorHistory in status.json.
 * Automatically trims to MAX_ACTOR_HISTORY entries.
 */
export function appendActorEvent(
  taskId: string,
  state: PipelineStateV2,
  event: ActorEvent,
): PipelineStateV2 {
  const existing = state.actorHistory ?? []
  const updated = [...existing, event]
  // Keep most recent MAX_ACTOR_HISTORY entries
  const trimmed = updated.length > MAX_ACTOR_HISTORY ? updated.slice(-MAX_ACTOR_HISTORY) : updated

  const newState: PipelineStateV2 = {
    ...state,
    actorHistory: trimmed,
    updatedAt: new Date().toISOString(),
  }
  writeState(taskId, newState)
  return newState
}

/**
 * Update the branchName in status.json after ensureFeatureBranch derives it.
 * Called from the build stage preExecute hook.
 */
export function setBranchName(
  taskId: string,
  state: PipelineStateV2,
  branchName: string,
): PipelineStateV2 {
  const updated: PipelineStateV2 = {
    ...state,
    branchName,
    updatedAt: new Date().toISOString(),
  }
  writeState(taskId, updated)
  return updated
}

/**
 * Immutable update: returns a new state with the stage updated
 */
export function updateStage(
  state: PipelineStateV2,
  stageName: string,
  update: Partial<StageStateV2>,
): PipelineStateV2 {
  const now = new Date().toISOString()

  // Create new stages object with the updated stage
  const newStages: Record<string, StageStateV2> = {}

  for (const [name, stage] of Object.entries(state.stages)) {
    if (name === stageName) {
      newStages[name] = {
        ...stage,
        ...update,
      }
    } else {
      newStages[name] = stage
    }
  }

  // If the stage didn't exist, create it
  if (!state.stages[stageName]) {
    newStages[stageName] = {
      state: update.state || 'pending',
      retries: 0,
      ...update,
    }
  }

  return {
    ...state,
    stages: newStages,
    updatedAt: now,
  }
}

/**
 * Mark pipeline as completed/failed/paused
 */
export function completeState(
  state: PipelineStateV2,
  finalState: 'completed' | 'failed' | 'timeout' | 'paused',
): PipelineStateV2 {
  const now = new Date().toISOString()

  // Compute total cost across all stages
  let totalCost = 0
  for (const stage of Object.values(state.stages)) {
    if (stage.cost) {
      totalCost += stage.cost
    }
  }

  return {
    ...state,
    state: finalState,
    completedAt: now,
    updatedAt: now,
    ...(totalCost > 0 ? { totalCost } : {}),
  }
}

// ============================================================================
// Recovery Functions - handle stale state from interrupted runs
// ============================================================================

/**
 * Recover stale stages: reset any stage stuck in "running" state to "pending".
 * This handles cases where the pipeline was killed mid-execution.
 *
 * Returns a new state object (immutable). If no stale stages found, returns
 * the input state unchanged.
 */
export function recoverStaleStages(state: PipelineStateV2): PipelineStateV2 {
  let hasChanges = false
  const newStages: Record<string, StageStateV2> = {}

  for (const [name, stage] of Object.entries(state.stages)) {
    if (stage.state === 'running') {
      // Reset stale running stage to pending
      newStages[name] = {
        ...stage,
        state: 'pending',
        startedAt: undefined,
      }
      logger.info(`⚠️ Recovered stale stage ${name}: running → pending`)
      hasChanges = true
    } else {
      newStages[name] = stage
    }
  }

  if (!hasChanges) {
    // No changes, return original state
    return state
  }

  return {
    ...state,
    stages: newStages,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Recover pipeline state: if all stages in the pipeline order are completed/skipped,
 * mark the pipeline as completed. If any non-advisory stage failed, mark as failed.
 *
 * Only acts when pipeline state is "running" - leaves completed/failed/paused states unchanged.
 *
 * @param state - The current pipeline state
 * @param pipelineOrder - Flat list of stage names in execution order
 * @param advisoryStages - Set of stage names that are advisory (failures don't fail pipeline)
 */
export function recoverPipelineState(
  state: PipelineStateV2,
  pipelineOrder: string[],
  advisoryStages: Set<string>,
): PipelineStateV2 {
  // Only recover if pipeline is stuck in "running" state
  if (state.state !== 'running') {
    return state
  }

  // Check stages that are in the pipeline order
  let allCompletedOrSkipped = true
  let hasNonAdvisoryFailure = false

  for (const stageName of pipelineOrder) {
    const stage = state.stages[stageName]

    if (!stage) {
      // Stage not in state - still needs to run
      allCompletedOrSkipped = false
      continue
    }

    if (stage.state === 'pending' || stage.state === 'running') {
      // Stage hasn't completed yet
      allCompletedOrSkipped = false
    } else if (stage.state === 'failed') {
      // Check if this is an advisory failure
      if (!advisoryStages.has(stageName)) {
        hasNonAdvisoryFailure = true
      }
      // Advisory failures are OK - continue checking
    }
    // 'completed' and 'skipped' are fine - continue checking
  }

  // Determine new pipeline state
  if (hasNonAdvisoryFailure) {
    logger.info(`⚠️ Recovered pipeline state: running → failed (non-advisory stage failed)`)
    return completeState(state, 'failed')
  }

  if (allCompletedOrSkipped) {
    logger.info(`⚠️ Recovered pipeline state: running → completed (all stages done)`)
    return completeState(state, 'completed')
  }

  // Pipeline still has pending/running stages - leave as running
  return state
}

/**
 * Resume pipeline from a gate pause. Immutably marks the gate stage as completed
 * and resets the pipeline state to 'running' (removing completedAt).
 *
 * This replaces direct state mutation that was previously in entry.ts:454-461.
 */
export function resumeFromGate(state: PipelineStateV2, gateStageName: string): PipelineStateV2 {
  // Use updateStage for immutable stage update
  const updatedState = updateStage(state, gateStageName, {
    state: 'completed',
    completedAt: new Date().toISOString(),
  })

  // Reset pipeline from paused to running, remove completedAt
  const { completedAt: _, ...rest } = updatedState
  return {
    ...rest,
    state: 'running',
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Reset stages from a given point onwards to pending.
 * Also deletes output files for reset stages (G37).
 *
 * C3 FIX: Uses stageOutputFile() instead of hardcoded `${stage}.md`
 * to correctly resolve output file paths for all stages
 * (e.g., taskify→task.json, architect→plan.md, etc.)
 */
export function resetFromStage(
  state: PipelineStateV2,
  fromStage: string,
  pipeline: string[],
  taskDir: string,
): PipelineStateV2 {
  const now = new Date().toISOString()

  // Find the index of the fromStage
  const fromIndex = pipeline.indexOf(fromStage)
  if (fromIndex === -1) {
    // Stage not found, return original state
    return state
  }

  // Get stages to reset
  const stagesToReset = pipeline.slice(fromIndex)

  // C3 FIX: Delete output files using stageOutputFile for correct paths
  // Previously used `${stage}.md` which is wrong for stages like:
  // - taskify → task.json
  // - architect → plan.md
  // - clarify → questions.md
  // - commit → commit.md
  for (const stage of stagesToReset) {
    const outputFile = stageOutputFile(taskDir, stage)
    if (fs.existsSync(outputFile)) {
      fs.unlinkSync(outputFile)
    }
  }

  // Reset stages to pending
  const newStages: Record<string, StageStateV2> = {}

  // FIX #827: Stages BEFORE fromStage that are still 'paused' should be marked
  // 'completed' — if later stages ran, the paused stage must have been approved.
  // This prevents stale 'paused' states from causing reruns to re-trigger gates.
  const stagesBefore = pipeline.slice(0, fromIndex)

  for (const [name, stage] of Object.entries(state.stages)) {
    if (stagesToReset.includes(name)) {
      // Reset this stage to pending
      newStages[name] = {
        state: 'pending',
        retries: 0,
      }
    } else if (stagesBefore.includes(name) && stage.state === 'paused') {
      // Stale paused stage — later stages ran, so this must have been approved
      newStages[name] = {
        ...stage,
        state: 'completed',
        completedAt: stage.completedAt || now,
      }
    } else {
      // Keep existing stage
      newStages[name] = stage
    }
  }

  return {
    ...state,
    stages: newStages,
    state: 'running',
    cursor: fromStage,
    updatedAt: now,
  }
}

// ============================================================================
// V1 Adapter for backward compatibility with formatStatusComment
// ============================================================================

import type { CodyPipelineStatus, StageStatus } from '../cody-utils'

/**
 * Convert v2 state to v1 format for formatStatusComment compatibility
 */
export function stateToV1(state: PipelineStateV2): CodyPipelineStatus {
  const v1Stages: Record<string, StageStatus> = {}

  for (const [name, stage] of Object.entries(state.stages)) {
    v1Stages[name] = {
      state: stage.state === 'paused' ? 'gate-waiting' : stage.state,
      startedAt: stage.startedAt,
      completedAt: stage.completedAt,
      elapsed: stage.elapsed,
      retries: stage.retries,
      outputFile: stage.outputFile,
      skipped: stage.skipped,
      error: stage.error,
      tokenUsage: stage.tokenUsage
        ? { input: stage.tokenUsage.input, output: stage.tokenUsage.output }
        : undefined,
      cost: stage.cost,
    }
  }

  return {
    taskId: state.taskId,
    mode: state.mode,
    pipeline: state.pipeline,
    startedAt: state.startedAt,
    updatedAt: state.updatedAt,
    completedAt: state.completedAt,
    totalElapsed: state.totalElapsed,
    state: state.state,
    currentStage: state.cursor,
    stages: v1Stages,
    triggeredBy: state.triggeredBy ?? 'dispatch',
    issueNumber: state.issueNumber,
    runId: undefined,
    runUrl: undefined,
    controlMode: undefined,
    gatePoint: undefined,
    botCommentId: undefined,
    totalCost: state.totalCost,
    triggeredByLogin: state.triggeredBy,
    issueCreator: state.issueCreator,
    actorHistory: state.actorHistory,
  }
}
