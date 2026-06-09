# Fix: Lesson Duplications Table Relationship Cells Show Loading

## What was fixed

Issue #2576: `/admin/collections/lesson-duplications` showed "Loading..." indefinitely in the Source Lesson and Output Lesson columns.

## Root cause

Payload's default relationship cell makes a fetch to get the related document's title. If that fetch hangs (no timeout), the cell stays on "Loading..." forever. This is the same pattern as issues #2574 and #2575 (MetricsProvider and useCurrentUser hooks) that were fixed with AbortController timeouts.

## How

Created custom cell components that display `cellData` directly without making additional fetches:

- `src/ui/admin/LessonDuplications/Cells/SourceLessonCell/index.tsx` — displays lesson title (or ID as fallback) for sourceLesson column
- `src/ui/admin/LessonDuplications/Cells/OutputLessonCell/index.tsx` — displays lesson title (or '<No Output Lesson>' placeholder) for outputLesson column

Updated `src/server/payload/collections/LessonDuplications.ts` to use these custom cells via `admin.components.Cell`.

The cells follow the same pattern as `CategoriesCell` in `src/ui/admin/Courses/Cells/CategoriesCell/`.

## Files changed

- `src/server/payload/collections/LessonDuplications.ts` — added custom Cell components to sourceLesson and outputLesson fields
- `src/ui/admin/LessonDuplications/Cells/SourceLessonCell/index.tsx` — new custom cell
- `src/ui/admin/LessonDuplications/Cells/OutputLessonCell/index.tsx` — new custom cell
- `tests/unit/admin/lesson-duplications/relationship-cell.test.tsx` — unit tests for display logic

## Verification

Unit tests pass (10 tests), lint passes, format check passes after auto-fix.
