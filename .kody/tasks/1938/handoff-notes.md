# Fix for #1938: Duplicate lesson entry with - Copy slug in Practice page

## What was done

Added a `slug: { not_like: '-copy' }` filter to three lesson query locations to exclude
lessons with duplication suffixes (e.g., "-copy", "-copy-2") from student-facing pages.

## Files changed

1. **src/server/repos/queries/study-page.ts** - Added `slug: { not_like: '-copy' }` filter
   to the `prefetchStudyData` function query. This is the primary fix for the /practice page.

2. **src/server/repos/queries/lessons.ts** - Added the same filter to:
   - `queryLessonsByChapter` - for chapter-level lesson listings
   - `queryLessonsByCourse` - for course-level lesson listings

3. **tests/int/lesson-duplicate-copy-slug-1938.int.spec.ts** - New integration test that:
   - Demonstrates the bug (duplicate with "-copy" slug IS included in unfiltered query)
   - Verifies the fix (duplicate is EXCLUDED when using `not_like: '-copy'`)

## Root cause

When Payload's built-in duplicate creates a lesson copy, the title gets " - Copy" appended.
The `beforeChange` hook in Lessons.ts normalizes this to a slug like "lesson-4---copy" (spaces
become hyphens). These incomplete duplicates were appearing in practice page listings because
the queries didn't filter them out.

## Key pattern

The `stripCopySuffix` function exists in formatSlug.ts but wasn't being used in queries.
The `not_like: '-copy'` approach is simpler and catches all variants (-copy, -copy-2, etc.)
