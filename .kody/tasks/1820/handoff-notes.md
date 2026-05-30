## Bug #1820 Fix Summary

**Root Cause**: The `/test` page was calling `prefetchStudyData(grade, contentLocale, 'exam')` which filters lessons by `type='exam'`. The `/practice` page calls `prefetchStudyData(grade, contentLocale)` which defaults to `type='practice'`. Since courses typically have only `type='practice'` lessons, the Test page returned 0 lessons while Practice returned lessons.

**Fix Applied** (mirrors study page fix in commit 3d002f33e):
- Changed `prefetchStudyData(grade, contentLocale, 'exam')` → `prefetchStudyData(grade, contentLocale)` (no third arg → defaults to 'practice')
- Changed `StudyContent lessonType="exam"` → `StudyContent lessonType="practice"`

**Files Changed**:
- `src/app/(frontend)/test/page.tsx` — removed 'exam' lessonType, now defaults to 'practice'
- `tests/int/test-page-lesson-type-bug.int.spec.ts` — added integration test reproducing the bug

**Verification**: Typecheck, lint, and format checks all pass. Integration test file created but could not run due to MongoDB container timeout in this environment (pre-existing issue - study page test also times out).