# Build Agent Report: 260303-auto-31

## Changes

### Created Files

- **`src/server/payload/access/publishedAndActive.ts`** - New access control helper for collections with custom `status` field. Returns `true` for authenticated users, and restricts anonymous users to documents where `status === 'published'` AND `isActive === true`.

### Modified Files

- **`src/server/payload/collections/Courses.ts`**
  - Changed `read: anyone` to `read: publishedAndActive`
  - Removed unused `anyone` import

- **`src/server/payload/collections/Chapters.ts`**
  - Changed `read: anyone` to `read: publishedAndActive`
  - Removed unused `anyone` import

- **`src/server/payload/collections/Lessons.ts`**
  - Changed `read: anyone` to `read: publishedAndActive`
  - Removed unused `anyone` import

- **`src/server/repos/queries/courses.ts`**
  - Added `overrideAccess: false` to both `queryCourseBySlug` and `queryPublishedCourses` functions
  - Reduced `depth` from 2 to 1 to minimize relationship data exposure

- **`src/server/repos/queries/chapters.ts`**
  - Added `overrideAccess: false` and reduced `depth` to 1 in all query functions
  - Added hierarchy invariant enforcement in `queryChaptersByCourse` - verifies parent course is published+active
  - Added hierarchy invariant enforcement in `queryChapterBySlug` - verifies parent course is published+active

- **`src/server/repos/queries/lessons.ts`**
  - Added `overrideAccess: false` and reduced `depth` to 1 in all query functions
  - Added hierarchy invariant enforcement in `queryLessonsByChapter` - verifies parent chapter AND grandparent course are published+active
  - Added hierarchy invariant enforcement in `queryLessonBySlug` - verifies parent chapter AND grandparent course are published+active
  - Added hierarchy invariant enforcement in `queryLessonsByCourse` - verifies course is published+active

- **`tests/unit/access/content-collections-admin-only.test.ts`**
  - Updated tests for Courses, Chapters, and Lessons collections to expect `publishedAndActive` instead of `anyone` for read access (tests now verify the fixed behavior)

## Tests Written

- Updated existing unit tests in `tests/unit/access/content-collections-admin-only.test.ts` to verify the fixed behavior (previously tested for buggy `anyone` behavior)

## Quality

- TypeScript: PASS
- Lint: PASS
- Unit Tests: PASS (2884 tests passed, 17 skipped)

## Summary

Implemented the security fix to restrict public read access for hierarchical content collections (Courses, Chapters, Lessons):

1. **Created `publishedAndActive` access helper** - filters on custom `status` field (not Payload's `_status`) and requires `isActive === true` for anonymous users

2. **Updated collection configs** - Courses, Chapters, and Lessons now use `publishedAndActive` for read access instead of `anyone`

3. **Hardened Local API queries** - Added `overrideAccess: false` to all query functions to enforce access control, reduced depth from 2 to 1 to minimize data exposure

4. **Enforced hierarchy invariant** - Added parent visibility checks to ensure chapters under draft courses and lessons under draft chapters/courses are not returned to anonymous users
