/**
 * exerciseState — computes per-exercise review state from duplication record data.
 *
 * @fileType utility
 * @domain lesson-duplication
 * @ai-summary Shared state computation for lesson duplication review.
 */

/** Valid exercise review states shown in tabs and pills. */
export type ExerciseReviewState = 'succeeded' | 'needs_review' | 'failed' | 'pending'

interface FailureEntry {
  exerciseRef: string
  sectionIndex: number
  code: string
  message: string
  suggestedAction: string
  resolved: boolean
}

interface OutputExerciseEntry {
  sourceExerciseId: string
  outputExerciseId: string
  strategy: string
}

/** Per-exercise computed state. */
export interface ExerciseState {
  outputExerciseId: string
  sourceExerciseId: string
  state: ExerciseReviewState
  /** Failure codes for exercises in needs_review state. */
  failureCodes: string[]
}

/**
 * Computes ExerciseState[] from record data.
 *
 * Algorithm:
 * 1. For each outputExercise in outputExercises:
 *    a. If outputExerciseId ∈ reviewedIds → state = 'succeeded'
 *    b. Else if sourceExerciseId has any unresolved failure → state = 'needs_review', failureCodes = codes
 *    c. Else → state = 'succeeded' (in outputExercises but no failures)
 *
 * Note: 'failed' and 'pending' states are not produced by this function.
 * 'failed' would require a distinct failure mode beyond unresolved failures.
 * 'pending' would require tracking source exercises with no output exercise mapping,
 * which is not currently computed here.
 *
 * Complexity: O(N × F) where N = outputExercises, F = failures.
 */
export function computeExerciseStates(
  outputExercises: OutputExerciseEntry[],
  failures: FailureEntry[],
  reviewedIds: Set<string>,
): ExerciseState[] {
  // Build failure lookup: sourceExerciseId → unresolved failure codes
  const failuresBySource: Record<string, string[]> = {}
  for (const f of failures) {
    if (!f.resolved) {
      ;(failuresBySource[f.exerciseRef] ??= []).push(f.code)
    }
  }

  const states: ExerciseState[] = []

  for (const entry of outputExercises) {
    const { sourceExerciseId, outputExerciseId } = entry

    if (reviewedIds.has(outputExerciseId)) {
      states.push({ outputExerciseId, sourceExerciseId, state: 'succeeded', failureCodes: [] })
    } else if (failuresBySource[sourceExerciseId]?.length) {
      states.push({
        outputExerciseId,
        sourceExerciseId,
        state: 'needs_review',
        failureCodes: failuresBySource[sourceExerciseId],
      })
    } else {
      // In outputExercises but not reviewed and no failures — treat as succeeded
      states.push({ outputExerciseId, sourceExerciseId, state: 'succeeded', failureCodes: [] })
    }
  }

  return states
}

/** Counts per state — used for status banner and tab counts. */
export interface StateCounts {
  succeeded: number
  needs_review: number
  failed: number
  pending: number
  total: number
}

export function countByState(states: ExerciseState[]): StateCounts {
  const counts: StateCounts = {
    succeeded: 0,
    needs_review: 0,
    failed: 0,
    pending: 0,
    total: states.length,
  }
  for (const s of states) {
    if (s.state === 'succeeded') counts.succeeded++
    else if (s.state === 'needs_review') counts.needs_review++
    else if (s.state === 'failed') counts.failed++
    else if (s.state === 'pending') counts.pending++
  }
  return counts
}
