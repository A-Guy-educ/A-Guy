# Issue #1894 Fix — Test page shows no topics for course with available Practice content

## What was done

The Test page (`/test`) calls `prefetchStudyData(grade, locale, 'exam')` to fetch exam lessons. When no exam lessons exist for a course, it showed an empty state instead of falling back to practice lessons (mirroring the existing learning→practice fallback behavior on the Study page).

## Root cause

Both `prefetchStudyData` in `src/server/repos/queries/study-page.ts` and the `/api/chapters/by-grade` route only had fallback logic for `lessonType === 'learning'`. There was no `exam` fallback.

## Changes

### `src/server/repos/queries/study-page.ts`
- Added global fallback: when no exam lessons exist for the course, fall back to practice lessons
- Added per-chapter fallback: when specific chapters have no exam lessons, fall back to practice lessons for those chapters

### `src/app/api/chapters/by-grade/route.ts`
- Added per-chapter fallback for `lessonType === 'exam'` (mirrors the existing learning fallback block)

### `tests/int/study-page-exam-fallback.int.spec.ts`
- New integration test: 3 tests covering exam→practice fallback, exam lessons returning when available, and practice lessons unchanged

## How to verify
Run `pnpm exec vitest run tests/int/study-page-exam-fallback.int.spec.ts --config ./vitest.config.mts` — all 3 tests should pass.
