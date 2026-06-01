# Fix #2300 — Add-block buttons visible when ≥1 block exists

## What changed

**Root cause**: `LessonBlocksField` only rendered the Add Exercise / Add Content Page buttons in the `rows.length === 0` empty state. With exactly 1 block, users saw disabled Move up/down buttons but had no UI to add a 2nd block to verify reorder works.

**Fix**: Added a second pair of Add buttons inside the bordered container, rendered in a footer area after the block list when `rows.length > 0`. The original empty-state buttons remain unchanged.

## Files changed

- `src/ui/admin/LessonBlocksField/index.tsx` — added footer Add buttons block after `rows.map()`, guarded by `rows.length > 0`
- `tests/e2e/lesson-blocks-field.e2e.spec.ts` — added new test `shows Add Exercise and Add Content Page buttons when lesson has exactly 1 block`

## Approach

Mirrored the exact button styles (inline styles, hover states) from the existing empty-state buttons. Footer buttons use slightly smaller padding (4px/12px vs 6px/14px) and font size (12px vs 13px) to visually differentiate from the prominent empty-state buttons.

## No follow-ups

The fix is self-contained and targeted. No adjacent bugs identified.
