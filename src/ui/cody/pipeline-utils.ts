/**
 * @fileType utility
 * @domain cody
 * @pattern pipeline-progress
 * @ai-summary Shared pipeline progress utilities — stage labels, progress calculation, elapsed formatting, tooltips
 */

import { ALL_STAGES } from './constants'
import type { CodyPipelineStatus, StageStatus } from './types'

/**
 * Human-readable labels for each pipeline stage
 */
export const stageLabels: Record<string, string> = {
  taskify: 'Analyzing',
  spec: 'Writing Spec',
  clarify: 'Clarifying',
  architect: 'Architecting',
  'plan-gap': 'Reviewing Plan',
  build: 'Building',
  commit: 'Committing',
  review: 'Reviewing',
  fix: 'Fixing',
  'commit-fix': 'Committing Fix',
  verify: 'Verifying',
  pr: 'Creating PR',
  autofix: 'Auto-fixing',
}

/**
 * Typical max durations per stage (in ms) for estimating progress percentage
 */
export const stageMaxDurations: Record<string, number> = {
  taskify: 10 * 60 * 1000,
  spec: 15 * 60 * 1000,
  clarify: 10 * 60 * 1000,
  architect: 30 * 60 * 1000,
  'plan-gap': 15 * 60 * 1000,
  build: 45 * 60 * 1000,
  commit: 5 * 60 * 1000,
  review: 15 * 60 * 1000,
  fix: 20 * 60 * 1000,
  'commit-fix': 2 * 60 * 1000,
  verify: 15 * 60 * 1000,
  pr: 5 * 60 * 1000,
  autofix: 15 * 60 * 1000,
}

const DEFAULT_MAX_MS = 20 * 60 * 1000

export interface PipelineProgress {
  /** Index of the current stage in ALL_STAGES (0-based). -1 if unknown */
  currentStageIndex: number
  /** Total number of stages */
  totalStages: number
  /** Human-readable label for the current stage */
  currentStageLabel: string
  /** Step number (1-based) */
  stepNumber: number
  /** Estimated percentage within the current stage (0-99) */
  stagePercent: number
  /** Estimated overall percentage (0-99) */
  overallPercent: number
  /** Number of completed stages */
  completedStages: number
  /** Pipeline state */
  state: CodyPipelineStatus['state']
}

/**
 * Calculate pipeline progress from a CodyPipelineStatus object
 */
export function calculatePipelineProgress(pipeline: CodyPipelineStatus): PipelineProgress {
  const totalStages = ALL_STAGES.length
  const currentStage = pipeline.currentStage
  const currentStageIndex = currentStage
    ? ALL_STAGES.indexOf(currentStage as (typeof ALL_STAGES)[number])
    : -1

  const completedStages = Object.values(pipeline.stages || {}).filter(
    (s) => s.state === 'completed',
  ).length

  // Stage percent from elapsed time
  let stagePercent = 0
  if (currentStage && pipeline.stages?.[currentStage]?.elapsed) {
    const elapsed = pipeline.stages[currentStage].elapsed! * 1000
    const maxMs = stageMaxDurations[currentStage] || DEFAULT_MAX_MS
    stagePercent = Math.min(99, Math.round((elapsed / maxMs) * 100))
  }

  // Overall percent: completed stages + fractional current stage
  const overallPercent =
    totalStages > 0
      ? Math.min(99, Math.round(((completedStages + stagePercent / 100) / totalStages) * 100))
      : 0

  return {
    currentStageIndex,
    totalStages,
    currentStageLabel: currentStage ? stageLabels[currentStage] || currentStage : 'Starting...',
    stepNumber: currentStageIndex >= 0 ? currentStageIndex + 1 : completedStages + 1,
    stagePercent,
    overallPercent,
    completedStages,
    state: pipeline.state,
  }
}

/**
 * Format elapsed time since a date, updating live
 */
export function formatElapsed(since: Date): string {
  const ms = Date.now() - since.getTime()
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

/**
 * Generate a rich tooltip title for a pipeline stage
 * Includes stage label, state, elapsed time, and error if present
 */
export function getStageTooltip(stage: string, stageData?: StageStatus): string {
  const label = stageLabels[stage] || stage
  const state = stageData?.state || 'pending'
  const elapsed = stageData?.elapsed
  const error = stageData?.error

  let tooltip = `${label} (${state})`
  if (elapsed) {
    tooltip += ` - ${formatElapsed(new Date(Date.now() - elapsed * 1000))}`
  }
  if (error) {
    tooltip += `\nError: ${error}`
  }
  return tooltip
}

/**
 * Generate tooltip for stage progress bar in status banner
 * Shows stage info relative to current progress
 */
export function getStageProgressTooltip(
  stage: string,
  stageIndex: number,
  currentStageIndex: number,
  pipelineState?: string,
): string {
  const label = stageLabels[stage] || stage
  const isCompleted = currentStageIndex > stageIndex
  const isCurrent = currentStageIndex === stageIndex
  const isPaused = isCurrent && pipelineState === 'paused'

  let status = isCompleted
    ? '✓ Completed'
    : currentStageIndex < stageIndex
      ? '○ Pending'
      : '● In Progress'
  if (isPaused) status = '⏸ Paused'

  return `${label}: ${status}`
}
