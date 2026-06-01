## Issue #2273: Stats counter shows all zeros despite real failures

**Root cause:** `computeExerciseStates()` only iterated over `outputExercises[]`, which stores successful exercise mappings. When an exercise fails during the `createOutputExercise` step (crash window — exercise written to Mongo but mapping not yet recorded), it gets added to `failures[]` without a corresponding `outputExercises[]` entry. These "orphan failures" were invisible to the stats counter.

**Fix:** Added a second pass in `computeExerciseStates()` that iterates over all `failuresBySource` keys not already covered by an `outputExercises` entry and emits `needs_review` states for them. Output exercise IDs for orphan failures are prefixed with `orphan:` so they can be identified as non-real IDs if needed.

**Files changed:**
- `src/ui/admin/LessonDuplicationReview/lib/exerciseState.ts` — added orphan failure detection loop after the outputExercises iteration
- `tests/unit/admin/lesson-duplication-review-stats-counter.spec.ts` — 5 tests covering the orphan failure scenarios

**Tests:** All 5 new tests pass. Full quality gates (typecheck, lint, unit tests) pass on first attempt.

**Follow-up (low priority):** `counts.failed` is always 0 because `computeExerciseStates` never produces a `'failed'` state. The banner renders it but it will never be non-zero. Not in scope for this fix.
