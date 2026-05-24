# Fix Summary: Study page empty, Practice page shows lessons

## Root Cause
The `/study` page called `prefetchStudyData(grade, contentLocale, 'learning')` — explicitly filtering for `type='learning'` lessons. The `/practice` page called `prefetchStudyData(grade, contentLocale)` — defaulting to `lessonType='practice'`. When the course had only `practice` type lessons (the common case in production), Study returned 0 lessons while Practice returned all 7.

## Fix
Changed `src/app/(frontend)/study/page.tsx` line 15:
- Before: `prefetchStudyData(grade, contentLocale, 'learning')`
- After: `prefetchStudyData(grade, contentLocale, 'practice')`

This makes Study and Practice pages query the same lesson type, ensuring consistent content surfacing.

## Files Changed
1. `src/app/(frontend)/study/page.tsx` — changed lessonType from 'learning' to 'practice'
2. `tests/int/study-page-lesson-type.int.spec.ts` — new regression test (3 tests)

## Test Results
- Test 1: `lessonType=practice` returns 7 practice lessons — PASS
- Test 2: `lessonType=learning` returns 0 lessons (bug behavior confirmed) — PASS
- Test 3: Consistency check (both using 'practice') — PASS after fix
- Quality gates: All green (typecheck, lint, tests)
