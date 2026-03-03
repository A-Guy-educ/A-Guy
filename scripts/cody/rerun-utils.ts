/**
 * @fileType utility
 * @domain cody | rerun
 * @ai-summary Pure function to resolve rerun fromStage with feedback routing
 */

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
