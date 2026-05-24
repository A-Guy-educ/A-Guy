## Bug #1992 Fix Summary

**Issue**: Practice page lesson card headings off by one — Lesson 5 shows "Lesson 4", Lesson 6 shows "Lesson 5", etc.

**Root Cause**: In `StudyContent/index.tsx`, the `filteredLessons` useMemo filtered lessons by type and grouped them by chapter, but did not explicitly sort lessons within each chapter by their `order` field. When chapters contained lessons of mixed types or the flatMap+group operation reordered lessons, the `startIndex` computation (sum of lesson counts in previous chapter groups) would produce incorrect indices.

**Fix Applied**: Added explicit `.sort((a, b) => (a as any).order - (b as any).order)` after filtering each chapter's lessons by type, before mapping. This ensures consistent intra-chapter ordering regardless of database return order or prior processing.

**Files Changed**:
1. `src/app/(frontend)/study/_components/StudyContent/index.tsx` — Added sort by order field to filteredLessons
2. `tests/int/chapters-by-grade-lesson-order.int.spec.ts` — New integration test with 3 cases including mixed-type chapter bug repro

**Prior Art**: This exact bug was previously fixed in commit df31412c8 (#1937) but that fix was never merged into dev. The same fix is re-applied here.
