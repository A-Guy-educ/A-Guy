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
