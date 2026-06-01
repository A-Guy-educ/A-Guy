# Fix: Block Delete Confirmation Dialog (#2293)

## What was done

Added a confirmation dialog before deleting a block in the LessonBlocksField admin component.

## Root Cause
`deleteBlock()` in `LessonBlocksField/index.tsx` immediately removed the block with no user confirmation - a single misclick could permanently delete a block after save.

## Changes Made

### 1. `src/ui/admin/LessonBlocksField/index.tsx`
- Added `deleteConfirmIndex` state to track which block is pending deletion
- Added `handleRequestDelete(index)` - sets confirmation state instead of deleting
- Added `handleConfirmDelete()` - performs actual deletion after user confirms
- Added `handleCancelDelete()` - clears confirmation state
- Changed Trash2 button onClick from `deleteBlock(row.index)` to `handleRequestDelete(row.index)`
- Added `AlertCircle` import from lucide-react
- Added modal overlay UI with Cancel/Delete Block buttons

### 2. `src/ui/admin/LessonBlocksField/inline-exercise-editor.css`
- Added `.lb-delete-confirm-overlay` - fullscreen overlay with semi-transparent backdrop
- Added `.lb-delete-confirm-modal` - centered modal card
- Added `.lb-delete-confirm-header` - error-colored header with icon
- Added `.lb-delete-confirm-body` - explanatory text
- Added `.lb-delete-confirm-actions` - button row
- Added `.lb-delete-confirm-cancel` - secondary cancel button
- Added `.lb-delete-confirm-delete` - red delete button

### 3. `tests/e2e/lesson-blocks-field.e2e.spec.ts`
- Added test `shows confirmation dialog before deleting a block` - verifies dialog appears on delete click and cancel preserves the block

## Pattern Followed
Mirrored the existing confirmation dialog implementation in `ExerciseContentEditor/index.tsx` which uses the same overlay modal pattern with `deleteConfirmBlockId` state and `handleConfirmDelete`/`handleCancelDelete` handlers.

## Verification
- Build: PASS
- TypeScript: PASS (no errors)
- Lint: PASS (only pre-existing warning in unrelated file)
- Format: PASS
- No console.log introduced in changed files