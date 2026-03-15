# Codebase Context: 260315-auto-706

## Files to Modify
- `src/server/repos/queries/courses.ts` (lines 13-17, 39) — add contentStatusVisible filtering to both query functions
- `src/server/repos/queries/lessons.ts` (lines 44, 147) — add contentStatusVisible filtering to both query functions
- `src/app/(frontend)/courses/_components/CourseCard/index.tsx` (line 131) — fix button disabled prop to include isSoon
- `tests/unit/components/CourseCard.test.tsx` (line ~218) — add test for disabled button

## Files to Create (NEW)
- `tests/unit/queries/course-content-status.test.ts` — test contentStatusVisible filtering in course queries
- `tests/unit/queries/lesson-content-status.test.ts` — test contentStatusVisible filtering in lesson queries

## Files to Read (reference patterns)
- `src/server/payload/fields/contentStatus.ts` — field definition with contentStatusVisible checkbox
- `src/server/payload/access/publishedAndActive.ts` — current access control (DO NOT MODIFY)
- `tests/unit/queries/lessons.test.ts` — existing lesson query test pattern (mocks payload.find)
- `src/server/repos/queries/chapters.ts` — similar query pattern for reference

## Key Signatures
- `export const queryPublishedCourses` from `src/server/repos/queries/courses.ts`
- `export const queryCourseBySlug` from `src/server/repos/queries/courses.ts`
- `export const queryLessonsByChapter` from `src/server/repos/queries/lessons.ts`
- `export const queryLessonsByCourse` from `src/server/repos/queries/lessons.ts`
- `disabled={isLoading || isSoon}` — target fix in `CourseCard/index.tsx` line 131

## Reuse Inventory
- `Where` type from `payload` — already imported in query files
- `conditions: Where[]` pattern — existing in all query functions
- `cn` from `@/infra/utils/ui` — already imported in CourseCard
- `I18nProvider` from `@/ui/web/providers/I18n` — test wrapper already used

## Integration Points
- `queryPublishedCourses()` called by `src/app/(frontend)/courses/page.tsx`
- `queryCourseBySlug()` called by course detail pages
- `queryLessonsByChapter()` called by chapter view components
- `queryLessonsByCourse()` called by course content listing
- Button `disabled` prop at `CourseCard/index.tsx:131`

## Imports Verified
- `@/server/repos/queries/courses` → exports `queryPublishedCourses`, `queryCourseBySlug` ✅
- `@/server/repos/queries/lessons` → exports `queryLessonsByChapter`, `queryLessonsByCourse` ✅
- `@/payload-types` → Course and Lesson types include `contentStatus`, `contentStatusVisible` ✅
- `payload` → exports `Where` type ✅
