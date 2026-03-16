/**
 * @fileType utility
 * @domain cody | rerun
 * @ai-summary Pure function to resolve rerun fromStage with feedback routing
 */

import { STAGE_NAMES as ALL_STAGES } from './stages/registry'

/**
 * When feedback is provided and fromStage is AFTER architect in the impl pipeline,
 * back up to architect so the plan can be revised with the feedback.
 *
 * Only backs up if fromStage is strictly AFTER plan-gap (i.e., build or later).
 * If fromStage IS architect or plan-gap, keep it (architect already reads feedback,
 * plan-gap is between architect and build so architect would run first anyway on reset).
 *
 * If fromStage is NOT in the impl stages (e.g., a spec stage like 'taskify'),
 * it's left unchanged — spec stages don't have an architect to back up to.
 */
export function resolveRerunFromStage(
  fromStage: string,
  feedback: string | undefined,
  implStages: string[],
): string {
  // No feedback → no change
  if (!feedback) return fromStage

  const architectIdx = implStages.indexOf('architect')
  const fromIdx = implStages.indexOf(fromStage)

  // fromStage not in impl stages (e.g., spec stage like 'taskify') → no change
  if (fromIdx === -1 || architectIdx === -1) return fromStage

  // Only back up if fromStage is strictly after plan-gap (i.e., build or later)
  // architect=0, plan-gap=1, build=2, commit=3, ...
  const planGapIdx = implStages.indexOf('plan-gap')
  const threshold = planGapIdx !== -1 ? planGapIdx : architectIdx

  if (fromIdx > threshold) {
    return 'architect'
  }

  return fromStage
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

/**
 * Find the nearest earlier stage in the pipeline order.
 * Uses ALL_STAGES as a reference to determine ordering.
 * Falls back to first stage in pipeline if nothing earlier exists.
 *
 * @param missingStage - The stage that is not in the pipeline (e.g., 'gap' in lightweight)
 * @param pipelineOrder - The pipeline's stage order (may not include all ALL_STAGES)
 * @returns The nearest earlier stage that exists in pipelineOrder, or pipelineOrder[0] as fallback
 */
export function findNearestEarlierStage(missingStage: string, pipelineOrder: string[]): string {
  const missingIdx = ALL_STAGES.indexOf(missingStage as (typeof ALL_STAGES)[number])
  if (missingIdx === -1) return pipelineOrder[0] // unknown stage -> first stage

  // Walk backwards through ALL_STAGES to find the nearest one that exists in pipeline
  for (let i = missingIdx - 1; i >= 0; i--) {
    const stage = ALL_STAGES[i]
    if (pipelineOrder.includes(stage)) {
      return stage
    }
  }

  // Nothing earlier exists, use first pipeline stage
  return pipelineOrder[0]
}
