## Verdict: PASS

## Summary

Added edit (Pencil) and delete (Trash2) buttons to the `LessonBlocksField` component with `deleteBlock` and `editBlock` callbacks following immutable patterns. The edit button navigates to the appropriate admin collection URL based on block type.

## Findings

### Critical

None.

### Major

None.

### Minor

- `src/ui/admin/LessonBlocksField/index.tsx:295` — `rows.map` uses filtered `refId` index, but drag handlers pass `idx` from `blocks.map` (unfiltered). After delete, indices can mismatch since `rows.length <= blocks.length`. No data loss in current flow (delete uses `row.index` which matches), but conceptually fragile if other operations are added later.

- `src/ui/admin/LessonBlocksField/index.tsx:441-455` — Delete button has no confirmation dialog. Could lead to accidental deletions. Consider adding `window.confirm('Delete this block?')` or a trashcan-to-confirm UI pattern.

- `src/ui/admin/LessonBlocksField/index.tsx:250-272, 394-455` — Pre-existing inline `style={}` objects throughout component use hardcoded CSS values (`var(--theme-*)` references, `14px`, `6`, etc.) rather than design system tokens. This is pre-existing debt, not introduced by this diff.

### Suppressions (not flagged — pre-existing):

- `src/ui/admin/LessonBlocksField/index.tsx:250-272, 394-455` — Inline styles for layout/colors/spacing. Pre-existing pattern in this file, not introduced by this change.
- `src/ui/admin/LessonBlocksField/index.tsx:216-220` — `index` from `rows.map` passed to drag handlers. Pre-existing drag-and-drop logic.
