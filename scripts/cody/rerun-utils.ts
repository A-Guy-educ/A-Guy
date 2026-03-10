/**
 * @fileType utility
 * @domain cody | rerun
 * @ai-summary Pure function to resolve rerun fromStage with feedback routing and stage alias resolution
 */

// ============================================================================
// Stage Aliases — backward compatibility for old stage names
// ============================================================================

/**
 * Maps old stage names to their GSD equivalents.
 * Used by --from flag, rerun commands, and anywhere old stage names might appear.
 */
export const STAGE_ALIASES: Record<string, string> = {
  architect: 'gsd-plan',
  'plan-gap': 'gsd-plan',
  build: 'gsd-execute',
}

/**
 * Resolve a stage name through aliases.
 * If the stage has an alias, returns the new name. Otherwise returns as-is.
 */
export function resolveStageAlias(stage: string): string {
  return STAGE_ALIASES[stage] ?? stage
}

// ============================================================================
// Rerun Stage Resolution
// ============================================================================

/**
 * When feedback is provided and fromStage is AFTER gsd-plan in the impl pipeline,
 * back up to gsd-plan so the plan can be revised with the feedback.
 *
 * Only backs up if fromStage is strictly AFTER gsd-plan (i.e., gsd-execute or later).
 * If fromStage IS gsd-plan, keep it (gsd-plan already reads feedback).
 *
 * If fromStage is NOT in the impl stages (e.g., a spec stage like 'taskify'),
 * it's left unchanged — spec stages don't have a planning stage to back up to.
 *
 * Supports old stage names via alias resolution (architect → gsd-plan, build → gsd-execute).
 */
export function resolveRerunFromStage(
  fromStage: string,
  feedback: string | undefined,
  implStages: string[],
): string {
  // No feedback → no change (but still resolve aliases)
  if (!feedback) return resolveStageAlias(fromStage)

  // Resolve alias first (backward compat: 'architect' → 'gsd-plan', 'build' → 'gsd-execute')
  const resolved = resolveStageAlias(fromStage)

  const gsdPlanIdx = implStages.indexOf('gsd-plan')
  const fromIdx = implStages.indexOf(resolved)

  // fromStage not in impl stages (e.g., spec stage like 'taskify') → no change
  if (fromIdx === -1 || gsdPlanIdx === -1) return resolved

  // Only back up if fromStage is strictly after gsd-plan
  if (fromIdx > gsdPlanIdx) {
    return 'gsd-plan'
  }

  return resolved
}

/**
 * After a gate is approved in rerun mode, determine which stage to reset FROM.
 * We must NOT reset the approved stage itself (that would overwrite the approval).
 * Instead, return the next stage in the pipeline after the approved gate.
 *
 * Fix for issue #673: gate approval overwritten by resetFromStage.
 *
 * @param approvedStage - The stage that was just approved (e.g., 'taskify')
 * @param pipelineOrder - Flat list of all stages in execution order
 * @returns The next stage after the approved one, or the approved stage itself as fallback
 */
export function resolveFromStageAfterGateApproval(
  approvedStage: string,
  pipelineOrder: string[],
): string {
  const approvedIdx = pipelineOrder.indexOf(approvedStage)
  if (approvedIdx === -1) return approvedStage

  const nextIdx = approvedIdx + 1
  if (nextIdx < pipelineOrder.length) {
    return pipelineOrder[nextIdx]
  }

  // Edge case: approved stage is the last stage — return itself
  return approvedStage
}
