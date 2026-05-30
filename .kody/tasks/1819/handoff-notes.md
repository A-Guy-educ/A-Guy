# Fix: Study page empty while Practice page has course content (Bug #1819)

## What was fixed

The `/study` page was calling `prefetchStudyData(grade, locale, 'learning')` which filtered lessons by `type === 'learning'`. The `/practice` page calls `prefetchStudyData(grade, locale)` which defaults to `lessonType === 'practice'`. Since the course's lessons have `type === 'practice'`, Study returned 0 lessons while Practice returned 7.

**File changed:** `src/app/(frontend)/study/page.tsx`
- Removed `'learning'` third argument from `prefetchStudyData` call (now uses default `'practice'`)
- Changed `StudyContent lessonType="learning"` to `lessonType="practice"` to match the prefetch result

This makes Study and Practice pages use the same lessonType (`'practice'`), so both return and display the same 7 practice lessons.

## Root cause
The study page had `lessonType === 'learning'` hardcoded in two places: the prefetch call and the StudyContent prop. The practice page uses `'practice'` in both. The mismatch caused the study page to filter for non-existent learning lessons.

## Test
`tests/int/study-page-lesson-type-bug.int.spec.ts` — 4 integration tests that verify:
1. `lessonType='practice'` returns practice lessons (validates test data)
2. `lessonType='learning'` returns 0 lessons (documents the bug)
3. Both study and practice return same lessons when using `'practice'`
4. Both default to `'practice'` when no lessonType argument is passed
