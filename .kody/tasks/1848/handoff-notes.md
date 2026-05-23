# Task 1848: Lesson Progress Not Persisted

## Bug
When a user completed an exercise and then re-entered the lesson, clicking "Start" would reset to exercise 0 instead of resuming from the last completed exercise.

## Root Cause
In `useExercisesPager.ts`, both `handleStart` and `handleStartExercises` unconditionally saved `completionPercentage: 0` and started from `exerciseIndex: 0`, overwriting any existing lesson progress.

## Fix
Modified both `handleStart` and `handleStartExercises` to:
1. Fetch existing lesson progress via `GET /api/progress`
2. If progress exists with `status: 'completed'`, go to outro
3. If progress exists with `completionPercentage > 0`, calculate resume position from percentage
4. Only save with `completionPercentage: 0` if no prior progress exists

Added `calculateResumeExerciseIndex()` helper function that reverses the completionPercentage formula to derive which exercise to resume from.

## Files Changed
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/useExercisesPager.ts`

## Limitation
The fix uses `completionPercentage` to infer resume position, which is imprecise if exercises were completed out of order or skipped. Works correctly for the common sequential completion case.
