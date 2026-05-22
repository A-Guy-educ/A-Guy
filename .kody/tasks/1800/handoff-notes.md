# Fix: Study page empty state when course locale differs from user content locale

## What changed

**Root cause**: `queryChaptersByGrade` in `src/server/repos/queries/chapters.ts` applied `localeWhereClause` to the COURSE query. When a user's contentLocale (e.g., 'en') differed from a course's locale (e.g., 'he'), the course was not found, causing the study page to show empty state.

**Fix**: Removed locale filtering from the course query in `queryChaptersByGrade`. Courses are now found solely by `courseLabel` (grade level). Locale filtering is applied at the lesson level in `prefetchStudyData` (unchanged). Also added `sort: '_id'` to ensure deterministic ordering (first-created course first).

## Files changed

1. `src/server/repos/queries/chapters.ts`: Removed `localeWhereClause` from course query; added `sort: '_id'`
2. `tests/int/study-page-empty-state.int.spec.ts`: New integration test reproducing the bug
3. `tests/int/chapters-by-grade-api.int.spec.ts`: Updated test data and assertions to match new behavior; fixed `enLessonOnEnChapter` to be on Hebrew chapter

## Key design decision

Course selection by grade should be locale-agnostic (matching how `queryCourseBySlug` works for the course page). Locale filtering belongs at the lesson level, not the course level. This mirrors the existing course page behavior where `queryCourseBySlug` does not filter by locale at the course level.
