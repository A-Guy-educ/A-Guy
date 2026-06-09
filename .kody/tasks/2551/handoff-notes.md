# 2551 — Add confirmation dialog before block deletion

## What

Added `window.confirm('Delete this block from the lesson?')` guard in `deleteBlock` in `LessonBlocksField` (`src/ui/admin/LessonBlocksField/index.tsx`). If user cancels, the block is not removed.

## Why

The Trash2 button in the lesson blocks field immediately deleted blocks with no confirmation — a regression from the originally-intended fix in PR #2299.

## Files changed

- `src/ui/admin/LessonBlocksField/index.tsx` — 1-line addition: `if (!window.confirm(...)) return` at top of `deleteBlock`
- `tests/e2e/lesson-blocks-field-delete-confirm.e2e.spec.ts` — New E2E test (2 tests: confirm→delete, cancel→keep)

## Verification

`pnpm verify` passed (typecheck + lint + tests).

## Notes

- Pattern follows existing `window.confirm` usage in `src/app/(frontend)/ask/_components/AskConversationGrid/index.tsx`
- E2E test requires MongoDB container (use `pnpm test:e2e` in CI/local with infra running)
- The fix is minimal and surgical — only the delete path was touched
