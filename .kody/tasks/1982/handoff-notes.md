## Issue #1982 - Practice page shows incorrect lesson heading levels

### What was done

Fixed an off-by-one bug in `src/app/(frontend)/study/_components/StudyContent/index.tsx`.

### Root cause

The `filteredLessons` useMemo did not explicitly sort lessons by `order` within each chapter. If lessons came back from the DB in a different order than their `order` field, the `startIndex` calculation in the chapterGroups map became incorrect, causing lesson headings to be off by one.

### Fix

Added explicit `.sort((a, b) => (a as any).order - (b as any).order)` within each chapter's filtered lessons in the `filteredLessons` useMemo. This mirrors the fix previously applied in task #1992 (commit `8ed25f644`).

### Files changed

- `src/app/(frontend)/study/_components/StudyContent/index.tsx` — added sort to filteredLessons
- `tests/int/chapters-by-grade-lesson-order.int.spec.ts` — new integration test (see followups)

### Note

A similar bug (#1992) was previously fixed with the identical pattern. The StudyContent component is the single source of truth for lesson heading numbering across /study, /practice, and /test pages.
