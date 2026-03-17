/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern complexity-scoring
 * @ai-summary Complexity scoring, tiers, control modes, and pipeline profile resolution
 */

import type { TaskDefinition, TaskType, PipelineProfile } from './task-schema'
import { VALID_PIPELINE_PROFILES } from './task-schema'
import { STAGE_NAMES, STAGE_REGISTRY, getStageComplexityThreshold } from '../stages/registry'

/** Named complexity tiers for display/logging */
export type ComplexityTier = 'trivial' | 'simple' | 'moderate' | 'complex' | 'very_complex'

export function getComplexityTier(score: number): ComplexityTier {
  if (score < 10) return 'trivial'
  if (score < 20) return 'simple'
  if (score < 35) return 'moderate'
  if (score < 50) return 'complex'
  return 'very_complex'
}

/**
 * Get stages that would run for a given complexity score.
 * Useful for logging and debugging.
 */
export function getStagesForComplexity(score: number): string[] {
  return STAGE_NAMES.filter((stage) => score >= STAGE_REGISTRY[stage].complexityThreshold)
}

// --- Control mode: determines pipeline autonomy level ---
export type ControlMode = 'auto' | 'risk-gated' | 'hard-stop'

export const CONTROL_MODE_MAP: Record<string, ControlMode> = {
  low: 'auto',
  medium: 'risk-gated',
  high: 'hard-stop',
}

/**
 * Resolve the control mode for a task based on its risk level.
 * User can override with explicit flags (--auto, --gate, --hard-stop).
 */
export function resolveControlMode(taskDef: TaskDefinition, override?: ControlMode): ControlMode {
  // Explicit override always wins (from /cody --auto, --gate, --hard-stop)
  if (override) return override

  // Derive from risk_level
  return CONTROL_MODE_MAP[taskDef.risk_level] ?? 'auto'
}

/**
 * Lightweight tasks: simple fixes that skip heavyweight stages (gap, plan-gap)
 *
 * When complexity score is available, derives profile from it:
 *   complexity < 35 → lightweight (below gap threshold)
 *   complexity >= 35 → standard (gap and above stages enabled)
 */
const LIGHTWEIGHT_TASK_TYPES: TaskType[] = ['fix_bug', 'refactor', 'ops', 'implement_feature']

export function resolvePipelineProfile(taskDef: TaskDefinition): PipelineProfile {
  // Agent explicit override always wins
  if (taskDef.pipeline_profile && VALID_PIPELINE_PROFILES.includes(taskDef.pipeline_profile)) {
    return taskDef.pipeline_profile
  }

  // When complexity score is available, derive profile from it
  if (taskDef.complexity !== undefined) {
    // Threshold = gap complexity threshold (35) — below this is lightweight
    return taskDef.complexity < getStageComplexityThreshold('gap') ? 'lightweight' : 'standard'
  }

  // Fallback: legacy heuristic for tasks without complexity score
  if (taskDef.risk_level === 'low' && LIGHTWEIGHT_TASK_TYPES.includes(taskDef.task_type)) {
    return 'lightweight'
  }

  // Everything else gets the full standard pipeline
  return 'standard'
}

// Lightweight tasks: simple fixes that skip heavyweight stages
// Note: implement_feature added for low-risk features (e.g., adding loading/error files)
