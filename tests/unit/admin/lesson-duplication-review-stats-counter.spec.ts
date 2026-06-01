/**
 * Unit Tests for Issue #2273: Lesson Duplication Review Stats Counter Bug
 *
 * Bug: Stats counter shows all zeros despite real failures being displayed.
 *
 * Root cause: computeExerciseStates() only iterates over outputExercises.
 * When an exercise fails during createOutputExercise (crash window), it gets
 * added to failures[] WITHOUT a corresponding entry in outputExercises[].
 * These "orphan failures" are never counted, showing 0 in all counters.
 *
 * Reproduction: A duplication record with 5 failure cards but 0 outputExercises
 * entries (all exercises failed the crash window between createOutputExercise
 * writing to Mongo and appendOutputExercise recording the mapping).
 */
import { describe, expect, it } from 'vitest'
import {
  computeExerciseStates,
  countByState,
} from '@/ui/admin/LessonDuplicationReview/lib/exerciseState'

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeFailure(
  exerciseRef: string,
  code = 'MISSING_QUESTION',
): {
  exerciseRef: string
  sectionIndex: number
  code: string
  message: string
  suggestedAction: string
  resolved: boolean
} {
  return {
    exerciseRef,
    sectionIndex: 0,
    code,
    message: `Validation failed for exercise ${exerciseRef}`,
    suggestedAction: 'skip',
    resolved: false,
  }
}

function makeOutputExercise(
  sourceExerciseId: string,
  outputExerciseId: string,
): { sourceExerciseId: string; outputExerciseId: string; strategy: string } {
  return { sourceExerciseId, outputExerciseId, strategy: 'ai' }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Issue #2273: Stats counter shows all zeros despite real failures', () => {
  /**
   * CORE BUG REPRODUCTION
   *
   * Scenario: An exercise fails during createOutputExercise (crash window).
   * The failure is recorded in failures[], but NO entry is added to outputExercises[].
   * The stats counter shows 0 because computeExerciseStates only iterates outputExercises.
   */
  it('should count exercises with failures even when they have no outputExercises entry', () => {
    // 5 exercises failed during createOutputExercise (crash window) - no mapping recorded
    const failures = [
      makeFailure('src-ex-1'),
      makeFailure('src-ex-2'),
      makeFailure('src-ex-3'),
      makeFailure('src-ex-4'),
      makeFailure('src-ex-5'),
    ]

    // outputExercises is empty because all exercises failed before mapping could be recorded
    const outputExercises: {
      sourceExerciseId: string
      outputExerciseId: string
      strategy: string
    }[] = []

    const states = computeExerciseStates(outputExercises, failures, new Set())

    // The bug: states is [] (empty) because the function only iterates outputExercises
    // Expected: states should have 5 entries with state='needs_review'
    expect(states).toHaveLength(5)
    expect(states.every((s) => s.state === 'needs_review')).toBe(true)
  })

  /**
   * countByState should return non-zero counts when there are orphan failures
   */
  it('countByState should return non-zero needs_review count for orphan failures', () => {
    const failures = [makeFailure('src-ex-1'), makeFailure('src-ex-2')]
    const outputExercises: {
      sourceExerciseId: string
      outputExerciseId: string
      strategy: string
    }[] = []

    const states = computeExerciseStates(outputExercises, failures, new Set())
    const counts = countByState(states)

    // Bug: all counts are 0
    // Expected: needs_review = 2, total = 2
    expect(counts.needs_review).toBe(2)
    expect(counts.total).toBe(2)
    expect(counts.succeeded).toBe(0)
    expect(counts.failed).toBe(0)
  })

  /**
   * Mixed scenario: some exercises succeeded, some failed (with outputExercises entry),
   * and some failed during createOutputExercise (orphan failures).
   */
  it('should correctly count mixed scenario with orphan failures', () => {
    // 2 exercises succeeded (have outputExercises entries)
    const outputExercises = [
      makeOutputExercise('src-ex-1', 'out-ex-1'),
      makeOutputExercise('src-ex-2', 'out-ex-2'),
    ]

    // 3 exercises failed during createOutputExercise (no outputExercises entry)
    const failures = [makeFailure('src-ex-3'), makeFailure('src-ex-4'), makeFailure('src-ex-5')]

    const states = computeExerciseStates(outputExercises, failures, new Set())

    // Expected: 2 succeeded + 3 needs_review = 5 total
    expect(states).toHaveLength(5)
    const counts = countByState(states)
    expect(counts.succeeded).toBe(2)
    expect(counts.needs_review).toBe(3)
    expect(counts.total).toBe(5)
  })

  /**
   * Exercise that has BOTH an outputExercises entry AND failures should be counted
   * as needs_review (not succeeded), because it has unresolved failures.
   */
  it('exercise with outputExercises entry and unresolved failures should be needs_review', () => {
    const outputExercises = [makeOutputExercise('src-ex-1', 'out-ex-1')]
    const failures = [makeFailure('src-ex-1')]

    const states = computeExerciseStates(outputExercises, failures, new Set())

    expect(states).toHaveLength(1)
    expect(states[0].state).toBe('needs_review')
    expect(states[0].failureCodes).toContain('MISSING_QUESTION')
  })

  /**
   * Reviewed exercise with failures should be counted as succeeded
   */
  it('reviewed exercise with failures should be succeeded', () => {
    const outputExercises = [makeOutputExercise('src-ex-1', 'out-ex-1')]
    const failures = [makeFailure('src-ex-1')]
    const reviewedIds = new Set(['out-ex-1'])

    const states = computeExerciseStates(outputExercises, failures, reviewedIds)

    expect(states).toHaveLength(1)
    expect(states[0].state).toBe('succeeded')
  })
})
