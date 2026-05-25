# Fix: Lesson card shows 0% progress for block-based lessons

## What was fixed

`src/app/(frontend)/courses/[courseSlug]/page.tsx` — `buildLessonProgressMap()` function

### Root Cause
For block-based lessons (new architecture), exercises are stored in `lesson.blocks` and resolved via `queryLessonBlocks`. The `buildLessonProgressMap` only queried the `exercises` collection, so block-based lessons had `total=0` and `completed=0`. Additionally, `useExercisesPager` saves lesson-level progress with `completionPercentage` (e.g., 33, 66, 99) and `status='in_progress'`, but the old code only checked for `status === 'completed'` to detect progress.

### The Fix
Changed the result-building loop to:
1. First check if there's a lesson-level progress record with a `completionPercentage`
2. If so, use it directly (shows correct progress for block-based lessons)
3. Fall back to exercise-count-based calculation for legacy lessons

### Files Changed
- `src/app/(frontend)/courses/[courseSlug]/page.tsx` — Fixed `buildLessonProgressMap()`
- `tests/int/lesson-progress-block-based.int.spec.ts` — New integration test

### Tests
- `should show 100% progress when lesson is marked completed at lesson level`
- `should use lesson-level completionPercentage for in-progress block-based lessons`

Both pass. All quality gates (typecheck, lint, tests) pass.
