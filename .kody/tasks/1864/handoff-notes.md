# Bug #1864 Fix - Test Page Empty

## What was fixed

The `/test` page was calling `prefetchStudyData(grade, contentLocale, 'exam')` with lessonType='exam', but courses only have 'practice' type lessons. This caused the Test page to show empty while Practice showed content.

## Root cause

In `src/app/(frontend)/test/page.tsx`:
- `prefetchStudyData` was called with third arg `'exam'` (line 14)
- `StudyContent` received `lessonType="exam"` (line 18)

The `prefetchStudyData` function filters lessons by `type`, so querying for 'exam' lessons returned none when courses only have 'practice' lessons.

## Fix applied

Changed `/test/page.tsx` to use default lessonType ('practice') instead of 'exam':
- Line 14: `prefetchStudyData(grade, contentLocale)` (removed third arg)
- Line 18: `StudyContent lessonType="practice"` (changed from "exam")

This mirrors the fix for bug #1863 (Study page) in commit 138a2cee5.

## Test added

`tests/int/test-page-prefetch.int.spec.ts` - tests that prefetchStudyData with default returns practice lessons, and with 'exam' returns exam lessons.

## Files touched

- `src/app/(frontend)/test/page.tsx` - fixed
- `tests/int/test-page-prefetch.int.spec.ts` - added