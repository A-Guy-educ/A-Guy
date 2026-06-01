/**
 * Unit Tests for Issue #2283: Review screen counters show zero despite failures displayed
 *
 * Bug: When failures exist for exercises that have NO corresponding entry in outputExercises
 * (e.g., GENERATION_FAILED before an output exercise was created), those failures are
 * rendered as cards but NOT counted in the status banner counters.
 *
 * This happens because computeExerciseStates() only iterates over outputExercises,
 * so failures without a matching output exercise are never counted.
 *
 * Expected: counters reflect the 5 displayed failure cards
 * Actual: counters show '0 succeeded · 0 needs_review · 0 failed' even though 5 cards render
 */
import { describe, expect, it } from 'vitest'
import {
  computeExerciseStates,
  countByState,
} from '@/ui/admin/LessonDuplicationReview/lib/exerciseState'
import type {
  OutputExerciseEntry,
  FailureEntry,
} from '@/ui/admin/LessonDuplicationReview/lib/exerciseState'

describe('Issue #2283: Review screen counters show zero despite failures displayed', () => {
  describe('computeExerciseStates', () => {
    it('should count failures for exercises that have NO output exercise entry', () => {
      // Scenario: 3 exercises failed during generation (GENERATION_FAILED)
      // before any output exercises were created.
      // outputExercises is EMPTY, but there are 3 unresolved failures.
      // The counters SHOULD show 3 needs_review, not 0.

      const outputExercises: OutputExerciseEntry[] = [] // No output exercises created yet
      const failures: FailureEntry[] = [
        {
          exerciseRef: 'source-exercise-1',
          sectionIndex: 0,
          code: 'GENERATION_FAILED',
          message: 'Failed to generate exercise',
          suggestedAction: 'retry',
          resolved: false,
        },
        {
          exerciseRef: 'source-exercise-2',
          sectionIndex: 0,
          code: 'GENERATION_FAILED',
          message: 'Failed to generate exercise',
          suggestedAction: 'retry',
          resolved: false,
        },
        {
          exerciseRef: 'source-exercise-3',
          sectionIndex: 0,
          code: 'GENERATION_FAILED',
          message: 'Failed to generate exercise',
          suggestedAction: 'retry',
          resolved: false,
        },
      ]
      const reviewedIds = new Set<string>()

      const states = computeExerciseStates(outputExercises, failures, reviewedIds)
      const counts = countByState(states)

      // BUG: counts.needs_review is 0 because computeExerciseStates only iterates over outputExercises (which is empty)
      // FIX: counts.needs_review should be 3
      expect(counts.needs_review).toBe(3)
    })

    it('should count mixed scenario: some exercises have output entries, some do not', () => {
      // Scenario: 2 exercises succeeded (have output entries), 2 exercises failed (no output entries)
      // Counters should show 2 succeeded, 2 needs_review

      const outputExercises: OutputExerciseEntry[] = [
        { sourceExerciseId: 'source-1', outputExerciseId: 'output-1', strategy: 'ai' },
        { sourceExerciseId: 'source-2', outputExerciseId: 'output-2', strategy: 'ai' },
      ]
      const failures: FailureEntry[] = [
        // These exercises have output entries
        {
          exerciseRef: 'source-1',
          sectionIndex: 0,
          code: 'MISSING_QUESTION',
          message: 'Missing question',
          suggestedAction: 'regenerate',
          resolved: false,
        },
        // These exercises do NOT have output entries (generation failed completely)
        {
          exerciseRef: 'source-3',
          sectionIndex: 0,
          code: 'GENERATION_FAILED',
          message: 'Failed to generate',
          suggestedAction: 'retry',
          resolved: false,
        },
        {
          exerciseRef: 'source-4',
          sectionIndex: 0,
          code: 'GENERATION_FAILED',
          message: 'Failed to generate',
          suggestedAction: 'retry',
          resolved: false,
        },
      ]
      const reviewedIds = new Set<string>()

      const states = computeExerciseStates(outputExercises, failures, reviewedIds)
      const counts = countByState(states)

      // source-1: needs_review (has output but unresolved failure)
      // source-2: succeeded (has output, no failure)
      // source-3: should be counted as needs_review (has failure but no output)
      // source-4: should be counted as needs_review (has failure but no output)
      // BUG: counts.needs_review is 1 (only source-1), but should be 3 (source-1, source-3, source-4)
      // BUG: counts.succeeded is 1 (only source-2), but should be 1
      expect(counts.needs_review).toBe(3)
      expect(counts.succeeded).toBe(1)
    })

    it('should count failures for exercises where output exercise was removed (skip action)', () => {
      // Scenario: exercise was skipped (removed from outputExercises) but failure still exists
      // Should still be counted as needs_review

      const outputExercises: OutputExerciseEntry[] = [
        { sourceExerciseId: 'source-1', outputExerciseId: 'output-1', strategy: 'ai' },
        // source-2 was skipped and removed from outputExercises
      ]
      const failures: FailureEntry[] = [
        {
          exerciseRef: 'source-1',
          sectionIndex: 0,
          code: 'MISSING_QUESTION',
          message: 'Missing question',
          suggestedAction: 'regenerate',
          resolved: false,
        },
        {
          exerciseRef: 'source-2', // This exercise was skipped, no output entry
          sectionIndex: 0,
          code: 'SKIPPED',
          message: 'Exercise skipped by admin',
          suggestedAction: 'skip',
          resolved: false,
        },
      ]
      const reviewedIds = new Set<string>()

      const states = computeExerciseStates(outputExercises, failures, reviewedIds)
      const counts = countByState(states)

      // source-1: needs_review (has output and unresolved failure)
      // source-2: should be counted as needs_review (has failure but skipped/no output)
      // BUG: counts.needs_review is 1 (only source-1), but should be 2
      expect(counts.needs_review).toBe(2)
    })

    it('should NOT double-count failures when output exercise exists AND has failure', () => {
      // Normal case: output exercise exists and has a failure
      // Should only be counted once as needs_review

      const outputExercises: OutputExerciseEntry[] = [
        { sourceExerciseId: 'source-1', outputExerciseId: 'output-1', strategy: 'ai' },
      ]
      const failures: FailureEntry[] = [
        {
          exerciseRef: 'source-1',
          sectionIndex: 0,
          code: 'MISSING_QUESTION',
          message: 'Missing question',
          suggestedAction: 'regenerate',
          resolved: false,
        },
      ]
      const reviewedIds = new Set<string>()

      const states = computeExerciseStates(outputExercises, failures, reviewedIds)
      const counts = countByState(states)

      expect(counts.needs_review).toBe(1)
      expect(counts.succeeded).toBe(0)
    })

    it('should mark as succeeded exercises that have been reviewed (even with failures)', () => {
      // When an exercise is in reviewedIds, it should be counted as succeeded
      // regardless of whether it has failures

      const outputExercises: OutputExerciseEntry[] = [
        { sourceExerciseId: 'source-1', outputExerciseId: 'output-1', strategy: 'ai' },
      ]
      const failures: FailureEntry[] = [
        {
          exerciseRef: 'source-1',
          sectionIndex: 0,
          code: 'MISSING_QUESTION',
          message: 'Missing question',
          suggestedAction: 'keep',
          resolved: false,
        },
      ]
      // The output exercise was marked as reviewed
      const reviewedIds = new Set<string>(['output-1'])

      const states = computeExerciseStates(outputExercises, failures, reviewedIds)
      const counts = countByState(states)

      expect(counts.succeeded).toBe(1)
      expect(counts.needs_review).toBe(0)
    })

    it('should handle empty failures array', () => {
      const outputExercises: OutputExerciseEntry[] = [
        { sourceExerciseId: 'source-1', outputExerciseId: 'output-1', strategy: 'ai' },
      ]
      const failures: FailureEntry[] = []
      const reviewedIds = new Set<string>()

      const states = computeExerciseStates(outputExercises, failures, reviewedIds)
      const counts = countByState(states)

      expect(counts.needs_review).toBe(0)
      expect(counts.succeeded).toBe(1) // output-1 has no failure, not reviewed
    })

    it('should handle resolved failures correctly', () => {
      const outputExercises: OutputExerciseEntry[] = [
        { sourceExerciseId: 'source-1', outputExerciseId: 'output-1', strategy: 'ai' },
      ]
      const failures: FailureEntry[] = [
        {
          exerciseRef: 'source-1',
          sectionIndex: 0,
          code: 'MISSING_QUESTION',
          message: 'Missing question',
          suggestedAction: 'keep',
          resolved: true, // This failure is resolved
        },
      ]
      const reviewedIds = new Set<string>()

      const states = computeExerciseStates(outputExercises, failures, reviewedIds)
      const counts = countByState(states)

      // With no unresolved failures and not in reviewedIds, should be succeeded
      expect(counts.succeeded).toBe(1)
      expect(counts.needs_review).toBe(0)
    })
  })
})
