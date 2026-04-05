
### build (2026-04-05T18:52:34)
Done. Here's a summary of the changes:

## Changes Made

**Logic update**: Chat is now shown when `hasLessonContext || hasExercises` (instead of just `hasLessonContext`). Chat is hidden only when BOTH criteria are met: no context text AND no exercises.

### Files Modified

1. **`page.tsx`**:
   - Blocks path: Computed `hasExercises = blockExercises.length > 0` and passed it to `LessonPager`
   - Exercises-only path: Passed `hasExercises` to `ExercisesPager`

2. **`LessonPager/index.tsx`**:
   - 
...(truncated)
