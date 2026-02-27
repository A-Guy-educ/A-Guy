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
