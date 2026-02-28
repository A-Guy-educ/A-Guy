/**
 * @fileType utility
 * @domain cody | engine
 * @pattern status-tracking
 * @ai-summary Status.json v2 operations with mandatory Zod validation
 */

import * as fs from 'fs'
import * as path from 'path'

import {
  PipelineStateV2,
  isPipelineStateV2,
  type PipelineContext,
  type StageStateV2,
} from './types'

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
      console.warn(`Status file for ${taskId} is not valid v2 format, ignoring`)
      return null
    }

    return parsed
  } catch (error) {
    console.warn(`Failed to load status for ${taskId}:`, error)
    return null
  }
}

/**
 * Atomic write: write to temp file then rename to prevent corruption
 * if the process is killed mid-write.
 */
export function writeState(taskId: string, state: PipelineStateV2): void {
  const statusFile = getStatusFilePath(taskId)
  const tmpFile = statusFile + '.tmp'

  // Ensure directory exists
  const dir = path.dirname(statusFile)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Atomic write: write to temp file then rename
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2))
  fs.renameSync(tmpFile, statusFile)
}

/**
 * Initialize a fresh v2 state
 */
export function initState(ctx: PipelineContext, mode: string): PipelineStateV2 {
  const now = new Date().toISOString()

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
  }

  writeState(ctx.taskId, state)
  return state
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

  return {
    ...state,
    state: finalState,
    completedAt: now,
    updatedAt: now,
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
      console.log(`⚠️ Recovered stale stage ${name}: running → pending`)
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
    console.log(`⚠️ Recovered pipeline state: running → failed (non-advisory stage failed)`)
    return completeState(state, 'failed')
  }

  if (allCompletedOrSkipped) {
    console.log(`⚠️ Recovered pipeline state: running → completed (all stages done)`)
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

  // Delete output files for reset stages (G37)
  for (const stage of stagesToReset) {
    const outputFile = path.join(taskDir, `${stage}.md`)
    if (fs.existsSync(outputFile)) {
      fs.unlinkSync(outputFile)
    }
  }

  // Reset stages to pending
  const newStages: Record<string, StageStateV2> = {}

  for (const [name, stage] of Object.entries(state.stages)) {
    if (stagesToReset.includes(name)) {
      // Reset this stage to pending
      newStages[name] = {
        state: 'pending',
        retries: 0,
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
    triggeredBy: 'dispatch', // Default, not stored in v2
    issueNumber: undefined,
    runId: undefined,
    runUrl: undefined,
    controlMode: undefined,
    gatePoint: undefined,
    botCommentId: undefined,
  }
}
