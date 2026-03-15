# Build Agent Report: 260315-auto-706

## Changes

This feature was implemented and committed in a prior run. The following changes are present in the codebase:

### 1. Content Status Fields (Schema)
- **File**: `src/server/payload/fields/contentStatus.ts`
- **Changes**: Added reusable field definitions:
  - `contentStatus`: select field ('none' | 'soon' | 'justAdded')
  - `contentStatusVisible`: checkbox (controls visibility for "Soon" content)
  - `contentStatusExpiresAt`: date (optional expiry for "Just Added" badge)

### 2. Collections Updated
- **File**: `src/server/payload/collections/Courses.ts` — contentStatusFields integrated
- **File**: `src/server/payload/collections/Lessons.ts` — contentStatusFields integrated

### 3. ContentStatusBadge Component
- **File**: `src/ui/web/shared/ContentStatusBadge/index.tsx`
- **Features**:
  - Pill-shaped badge with `rounded-full`
  - "Soon" badge: gray styling (`bg-muted text-muted-foreground`)
  - "Just Added" badge: green styling (`bg-emerald-500`) with pulse animation (`animate-pulse`)
  - Auto-expiry check for "Just Added" badges

### 4. CourseCard Component
- **File**: `src/app/(frontend)/courses/_components/CourseCard/index.tsx`
- **Features**:
  - Badge rendered at top-right corner
  - Button disabled for "Soon" courses (`disabled={isLoading || isSoon}`)
  - Toast message on click for locked content

### 5. CourseLessonCard Component
- **File**: `src/app/(frontend)/courses/[courseSlug]/_components/CourseLessonCard/index.tsx`
- **Features**:
  - Badge rendered next to lesson title
  - Locked behavior: href="#" and toast on click

### 6. Query Filtering
- **File**: `src/server/repos/queries/courses.ts`
  - Added `contentStatusVisible` filter to `queryCourseBySlug` and `queryPublishedCourses`
  
- **File**: `src/server/repos/queries/lessons.ts`
  - Added `contentStatusVisible` filter to `queryLessonsByChapter`, `queryLessonBySlug`, and `queryLessonsByCourse`

### 7. Translations
- **File**: `src/i18n/en.json` — soonBadge, justAddedBadge, contentLocked
- **File**: `src/i18n/he.json` — soonBadge, justAddedBadge, contentLocked

## Tests Written

- `tests/unit/queries/course-content-status.test.ts` — 4 tests
- `tests/unit/queries/lesson-content-status.test.ts` — 2 tests
- `tests/unit/components/CourseCard.test.tsx` — 12 tests
- `tests/unit/components/CourseLessonCard.test.tsx` — 6 tests
- `tests/unit/components/ContentStatusBadge.test.tsx` — 10 tests
- `tests/unit/i18n/contentStatus-translations.test.ts` — 8 tests
- `tests/unit/fields/contentStatus.test.ts` — 10 tests

**Total**: 52 tests

## Quality

- TypeScript: PASS (`pnpm tsc --noEmit`)
- Lint: PASS (`pnpm lint`)
- All 52 content-status tests: PASS

## Notes

- No changes to `publishedAndActive` access control — query-level filtering used instead
- All implementations follow existing codebase patterns and reuse existing utilities
- Feature fully implemented per spec.md requirements (§1.1, §1.2, §2.1, §3.1, §3.2, FR-001–FR-006, AC-1–AC-9)
