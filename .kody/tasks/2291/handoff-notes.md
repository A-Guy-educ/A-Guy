# Task 2291: Add autosave to LessonBlocksField delete operations

## What was done

**Root cause**: `LessonBlocksField` called `setValue()` when deleting a block but did not call `form.setModified(true)` to mark the form as dirty. Payload's autosave mechanism only triggers when the form is marked dirty, so delete operations were held in React state and lost on navigation without save.

**Fix**: Added `useForm` hook to `LessonBlocksField` and called `setModified(true)` in `deleteBlock` after `updateBlocks(next)`. This mirrors the pattern already used in `ExerciseContentEditor` and `CourseLessonsSorter`.

**Files changed**:
- `src/ui/admin/LessonBlocksField/index.tsx` — added `useForm` import, destructured `setModified` from `useForm()`, called `setModified(true)` in `deleteBlock`, added `setModified` to `useCallback` dependency array
- `tests/unit/ui/admin/lesson-blocks-field-autosave.spec.ts` — new unit test verifying the autosave behavior

**Pattern followed**: `ExerciseContentEditor` and `CourseLessonsSorter` both use `setModified(true)` to trigger Payload's autosave. `LessonBlocksField` now follows the same pattern.
