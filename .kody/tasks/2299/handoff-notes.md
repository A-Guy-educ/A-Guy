# Fix: Block delete has no confirmation dialog (#2299)

## What was done

**Root cause**: The `deleteBlock` callback in `LessonBlocksField` immediately spliced the block from the array with no user confirmation step.

**Fix**: Added `window.confirm()` guard at the start of `deleteBlock` in `src/ui/admin/LessonBlocksField/index.tsx` (line 213). If user cancels, deletion is aborted.

**Pattern followed**: Same `window.confirm()` pattern used elsewhere in the codebase (e.g., `AskConversationGrid`, `AskTab` for delete actions).

## Files changed

- `src/ui/admin/LessonBlocksField/index.tsx` — added confirmation dialog to `deleteBlock`
- `tests/e2e/lesson-blocks-field.e2e.spec.ts` — added E2E test verifying dialog appears before deletion

## Verification

Quality gates passed (typecheck + lint). Integration tests require a running DB which was unavailable in this environment.
