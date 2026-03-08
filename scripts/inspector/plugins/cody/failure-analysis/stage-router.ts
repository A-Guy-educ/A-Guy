/**
 * @fileType utility
 * @domain inspector
 * @pattern stage-routing
 * @ai-summary Deterministic from_stage routing for pipeline reruns — ported from supervisor
 */

/**
 * Resolve the from_stage for rerun based on which stage failed.
 * This provides deterministic routing before entry.ts applies its own backup logic.
 *
 * Two-layer approach:
 * 1. Inspector picks root-cause stage (this function)
 * 2. entry.ts may further back up to architect if feedback warrants
 *
 * Ported from: scripts/supervisor/supervisor.ts → resolveFromStage()
 */
export function resolveFromStage(failedStage: string): string {
  // Commit failures → rerun commit only (don't back up to architect)
  // Backing up to architect for a commit format error is wasteful
  if (failedStage === 'commit') {
    return 'commit'
  }

  // PR failures → rerun PR only
  if (failedStage === 'pr') {
    return 'pr'
  }

  // Verify failures → the code is bad, rerun from build
  // (entry.ts may further back up to architect if feedback warrants)
  if (failedStage === 'verify') {
    return 'build'
  }

  // Autofix failures → rerun from build
  if (failedStage === 'autofix') {
    return 'build'
  }

  // Everything else → pass through (entry.ts may further back up)
  return failedStage
}
