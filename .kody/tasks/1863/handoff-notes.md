# Bug #1863 Fix: Study Page Empty for Course with Practice Lessons

## What was fixed

**File:** `src/app/(frontend)/study/page.tsx`

**Root cause:** The Study page was calling `prefetchStudyData(grade, contentLocale, 'learning')` — explicitly passing `'learning'` as the lessonType — while the Practice page called `prefetchStudyData(grade, contentLocale)` using the default `'practice'`. When a course has only `'practice'` lessons (no `'learning'` lessons), the Study page's query returns chapters with empty lessons arrays, causing the "No topics available" message.

**Fix:** Changed Study page to call `prefetchStudyData(grade, contentLocale)` (no third argument, defaulting to `'practice'`) and updated the `StudyContent` prop from `lessonType="learning"` to `lessonType="practice"`. Both Study and Practice now use the same lessonType.

## Changes made

1. **`src/app/(frontend)/study/page.tsx`** (2 lines changed):
   - `prefetchStudyData(grade, contentLocale, 'learning')` → `prefetchStudyData(grade, contentLocale)`
   - `<StudyContent lessonType="learning" …>` → `<StudyContent lessonType="practice" …>`

2. **`tests/int/study-page-prefetch.int.spec.ts`** (new file):
   - Integration tests verifying prefetchStudyData returns correct lessonType-filtered results
   - Documents the bug condition (learning vs practice return different lessons)
   - Note: Tests verify function behavior rather than page-level behavior due to Next.js server component complexity

## Verification

- All 3 integration tests pass
- `pnpm ci:local` (typecheck, lint, tests) passes with `ok: true`
- Study and Practice pages now use identical lessonType parameters
