# Issue #1893 Fix — Study page empty state

## What was fixed

Study page (/study) showed "No topics available in this course" while /practice correctly showed content for the same course.

## Root cause

`StudyPage` calls `prefetchStudyData(grade, locale, 'learning')` — filtering lessons by `type = 'learning'`. The Translate Test (EN) course apparently has only `type = 'practice'` lessons. The query returned chapters with empty `lessons` arrays.

`PracticePage` uses the same function with the default `lessonType = 'practice'`, so it correctly showed the practice lessons.

## Files changed

1. **src/server/repos/queries/study-page.ts** — Added per-chapter fallback: when `lessonType='learning'` and a chapter has no learning lessons, query practice lessons for that chapter instead.
2. **src/app/api/chapters/by-grade/route.ts** — Same per-chapter fallback for the client-side API path (used when grade cookie is unavailable).
3. **tests/int/study-page-learning-fallback.int.spec.ts** — New integration test covering the fallback scenario.

## How the fix works

After the initial `lessonType='learning'` query, lessons are grouped by chapter. For any chapter that ended up with 0 lessons, a second DB query fetches `lessonType='practice'` lessons scoped to those specific chapter IDs. These are merged into the chapter's lessons array.

This means:
- Chapters with learning lessons → show learning lessons (no fallback)
- Chapters with only practice lessons → show practice lessons (fallback triggered)
- Mixed chapters (some learning, some practice-only) → each chapter shows its appropriate type
