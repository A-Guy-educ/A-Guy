# Fix for Issue #2283: Review screen counters show zero despite failures displayed

## What was wrong

`computeExerciseStates()` in `src/ui/admin/LessonDuplicationReview/lib/exerciseState.ts` only iterated over `outputExercises` to compute per-exercise states. Failures for source exercises that had no corresponding entry in `outputExercises` (e.g., GENERATION_FAILED before an output exercise was created, or skipped exercises) were never counted.

The status banner counters (`counts.succeeded`, `counts.needs_review`, etc.) are derived from `computeExerciseStates` output via `countByState`, so those failures were invisible to the counters even though they were rendered as failure cards.

## Fix

Added a second loop to `computeExerciseStates` that iterates over all unresolved failure source IDs not already in `outputExercises`, adding a `needs_review` entry for each. Used empty string `""` as the `outputExerciseId` placeholder for these orphaned failures — `countByState` only uses the `state` field, so the placeholder ID is never dereferenced.

Also exported `FailureEntry` and `OutputExerciseEntry` interfaces so unit tests can import them.

## Files changed

- `src/ui/admin/LessonDuplicationReview/lib/exerciseState.ts` — added second loop to count failures without output entries; exported interfaces
- `tests/unit/admin/lesson-duplication-review-counters.spec.ts` — 7 unit tests covering the bug scenarios (all pass after fix)

## Tests

7 unit tests in `tests/unit/admin/lesson-duplication-review-counters.spec.ts` verify:
- Empty outputExercises + 3 failures → needs_review = 3 (was 0)
- Mixed: 2 output entries, 2 orphaned failures → needs_review = 3, succeeded = 1
- Skipped exercise (removed from outputExercises) still counted as needs_review
- No double-counting when output exercise exists AND has failure
- Reviewed exercises counted as succeeded regardless of failures
- Empty failures array works correctly
- Resolved failures are not counted
