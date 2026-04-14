
### taskify (2026-04-14T15:27:58)
Based on my thorough analysis, I've identified the likely root cause of the issue. Here's my assessment:

## Summary

The test `navigate-lesson-direct` seeds a lesson with `title: "Direct Lesson"` but **no blocks, exercises, or content files**. When the lesson page renders:

1. `hasBlocks = false` (no blocks in `queryLessonBlocks`)
2. Goes to legacy path where `hasExercises = false` and `hasContent = false`
3. Renders `ExerciseWorkspace` with `EmptyLessonPlaceholder`
4. The `ExerciseHeader` shou
...(truncated)

### plan (2026-04-14T15:30:43)
Based on my investigation, here's the issue and recommended fix:

## Analysis

The test `navigate-lesson-direct` seeds a lesson with **no content** (no blocks, exercises, or content files). When the lesson page renders:

1. `hasBlocks = false` → uses legacy path
2. `hasExercises = false` and `hasContent = false` → renders `ExerciseWorkspace` with `EmptyLessonPlaceholder`
3. `LessonPager` shows the **intro** page with `lessonTitle` in the breadcrumb

The issue is that **`queryLessonBySlug` likely
...(truncated)

### build (2026-04-14T15:45:36)
The fix is complete. Here's a summary of the changes:

## Summary

**Problem:** The `navigate-lesson-direct` test seeds a lesson with no blocks and no exercises. When the lesson page renders, it uses the `ExerciseWorkspace` with `EmptyLessonPlaceholder`, which previously did not display the lesson title prominently.

**Fix:** Updated `EmptyLessonPlaceholder` to accept a `lessonTitle` prop and display it prominently.

### Changes Made:

1. **`src/app/(frontend)/courses/[courseSlug]/chapters/[chap
...(truncated)
