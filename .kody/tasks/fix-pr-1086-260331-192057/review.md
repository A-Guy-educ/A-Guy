
## Verdict: PASS

## Summary

Added `transition: 'opacity 0.15s'` CSS property to the up/down sort buttons in `CourseLessonsSorter` to comply with the design system requirement that all interactive elements must have transitions.

## Findings

### Critical
None.

### Major
None.

### Minor

- `src/ui/admin/CourseLessonsSorter/index.tsx:384` — Sort button (move up) now has `transition: 'opacity 0.15s'`, consistent with design system requirement for interactive elements
- `src/ui/admin/CourseLessonsSorter/index.tsx:401` — Sort button (move down) now has `transition: 'opacity 0.15s'`, consistent with design system requirement for interactive elements

Both transitions are correct for the properties being animated (opacity on disabled state). This matches the `LessonBlocksField` pattern at `src/ui/admin/LessonBlocksField/index.tsx:329` which uses `transition: 'background 0.15s, opacity 0.15s'`.
