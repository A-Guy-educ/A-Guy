# Codebase Context: 260315-auto-706

## Files to Modify
None — implementation is complete from prior runs. All source files are present and tested.

## Files to Read (verify completeness)
- `src/server/payload/fields/contentStatus.ts` — Field definitions (contentStatus, contentStatusVisible, contentStatusExpiresAt)
- `src/server/payload/collections/Courses.ts` — contentStatusFields integrated at line 237
- `src/server/payload/collections/Lessons.ts` — contentStatusFields integrated at line 257
- `src/ui/web/shared/ContentStatusBadge/index.tsx` — Badge component with pill shape, gray/green styling, pulse animation
- `src/app/(frontend)/courses/_components/CourseCard/index.tsx` — Badge, disabled button (line 131), toast for locked content
- `src/app/(frontend)/courses/[courseSlug]/_components/CourseLessonCard/index.tsx` — Badge, href="#" for locked, toast handler
- `src/server/repos/queries/courses.ts` — contentStatusVisible filter in queryCourseBySlug and queryPublishedCourses
- `src/server/repos/queries/lessons.ts` — contentStatusVisible filter in queryLessonsByChapter, queryLessonBySlug, queryLessonsByCourse
- `src/i18n/en.json` (lines 261-263) — soonBadge, justAddedBadge, contentLocked
- `src/i18n/he.json` (lines 261-263) — soonBadge, justAddedBadge, contentLocked

## Test Files (all passing)
- `tests/unit/queries/course-content-status.test.ts` — 4 tests, verifies query contentStatusVisible filtering
- `tests/unit/queries/lesson-content-status.test.ts` — 2 tests, verifies query contentStatusVisible filtering
- `tests/unit/components/CourseCard.test.tsx` — 12 tests, verifies badges, disabled button, locked behavior
- `tests/unit/components/CourseLessonCard.test.tsx` — 6 tests, verifies badges, locked behavior
- `tests/unit/components/ContentStatusBadge.test.tsx` — 10 tests, verifies render, expiry, styling
- `tests/unit/i18n/contentStatus-translations.test.ts` — 8 tests, verifies translation keys
- `tests/unit/fields/contentStatus.test.ts` — 10 tests, verifies field structure

## Key Signatures
- `export const contentStatusFields: Field[]` from `src/server/payload/fields/contentStatus.ts`
- `export const CONTENT_STATUS_OPTIONS = ['none', 'soon', 'justAdded'] as const` from same file
- `export function ContentStatusBadge({ contentStatus, contentStatusExpiresAt, className })` from `src/ui/web/shared/ContentStatusBadge/index.tsx`
- `export const queryPublishedCourses` from `src/server/repos/queries/courses.ts`
- `export const queryCourseBySlug` from `src/server/repos/queries/courses.ts`
- `export const queryLessonsByChapter` from `src/server/repos/queries/lessons.ts`
- `export const queryLessonBySlug` from `src/server/repos/queries/lessons.ts`
- `export const queryLessonsByCourse` from `src/server/repos/queries/lessons.ts`

## Reuse Inventory
- `Where` type from `payload` — query condition typing
- `cn` from `@/infra/utils/ui` — conditional class merging
- `useTranslations` from `@/ui/web/providers/I18n` — i18n translations
- `toast` from `sonner` — toast notifications for locked content
- `contentStatusFields` from `@/server/payload/fields/contentStatus` — shared fields across collections
- `publishedAndActive` from `@/server/payload/access/publishedAndActive` — NOT modified (query-level filtering used instead)

## Integration Points
- `queryPublishedCourses()` called by `src/app/(frontend)/courses/page.tsx`
- `queryCourseBySlug()` called by course detail pages
- `queryLessonsByChapter()` called by chapter view components
- `queryLessonsByCourse()` called by course content listing
- `ContentStatusBadge` rendered in CourseCard and CourseLessonCard

## Imports Verified
- `@/server/payload/fields/contentStatus` → exports contentStatusFields, CONTENT_STATUS_OPTIONS, ContentStatus ✅
- `@/ui/web/shared/ContentStatusBadge` → exports ContentStatusBadge ✅
- `@/server/repos/queries/courses` → exports queryPublishedCourses, queryCourseBySlug ✅
- `@/server/repos/queries/lessons` → exports queryLessonsByChapter, queryLessonBySlug, queryLessonsByCourse ✅
- `@/payload-types` → Course and Lesson types include contentStatus, contentStatusVisible, contentStatusExpiresAt ✅
- `sonner` → exports toast ✅
- `@/infra/utils/ui` → exports cn ✅

## Quality Verification (confirmed)
- TSC: passes (0 errors)
- Lint: passes (0 warnings)  
- All 52 content-status tests: pass
