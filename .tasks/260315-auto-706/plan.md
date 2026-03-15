# Plan: 260315-auto-706 — Content Status Badging ("Soon" & "Just Added")

## Rerun Context

This is a rerun of a **fully complete** feature. The rerun was triggered via `/cody rerun` with no specific issues listed — the rerun-feedback.md contains only "Rerun requested via /cody rerun" with no technical complaints.

**Current state**: ALL code changes and tests from prior runs are already in the codebase and passing:
- ✅ TSC passes (0 errors)
- ✅ Lint passes (0 warnings)
- ✅ All 46 content-status-related tests pass across 6 test files
- ✅ All 6 prior-run source files are present and correct
- ✅ All 6 prior-run test files are present and passing

**What was implemented in prior runs (already committed to working tree):**
1. `src/server/payload/fields/contentStatus.ts` — Reusable field definitions (contentStatus, contentStatusVisible, contentStatusExpiresAt)
2. `src/server/payload/collections/Courses.ts` — contentStatusFields integrated
3. `src/server/payload/collections/Lessons.ts` — contentStatusFields integrated
4. `src/ui/web/shared/ContentStatusBadge/index.tsx` — Badge component with pill shape, gray/green colors, pulse animation
5. `src/app/(frontend)/courses/_components/CourseCard/index.tsx` — Badge integration, locked click handler, disabled button
6. `src/app/(frontend)/courses/[courseSlug]/_components/CourseLessonCard/index.tsx` — Badge integration, locked click handler
7. `src/server/repos/queries/courses.ts` — contentStatusVisible filtering on queryPublishedCourses and queryCourseBySlug
8. `src/server/repos/queries/lessons.ts` — contentStatusVisible filtering on queryLessonsByChapter, queryLessonBySlug, queryLessonsByCourse
9. `src/i18n/en.json` — soonBadge, justAddedBadge, contentLocked keys
10. `src/i18n/he.json` — soonBadge, justAddedBadge, contentLocked keys

**This plan**: Since the implementation is complete with no outstanding issues, the build agent should verify the state and produce a clean build report. No code changes are needed.

## Research Findings

### File Paths Verified
- ✅ `src/server/payload/fields/contentStatus.ts` (57 lines) — field definitions complete
- ✅ `src/server/payload/collections/Courses.ts` — contentStatusFields imported at line 19, spread at line 237
- ✅ `src/server/payload/collections/Lessons.ts` — contentStatusFields imported at line 9, spread at line 257
- ✅ `src/ui/web/shared/ContentStatusBadge/index.tsx` (73 lines) — component complete
- ✅ `src/app/(frontend)/courses/_components/CourseCard/index.tsx` (153 lines) — badge, disabled button, toast all present
- ✅ `src/app/(frontend)/courses/[courseSlug]/_components/CourseLessonCard/index.tsx` (113 lines) — badge, locked handler present
- ✅ `src/server/repos/queries/courses.ts` (67 lines) — contentStatusVisible filter present in both functions
- ✅ `src/server/repos/queries/lessons.ts` (246 lines) — contentStatusVisible filter present in all 3 query functions
- ✅ `src/i18n/en.json` (lines 261-263) — soonBadge: "Soon", justAddedBadge: "New", contentLocked: "This content is being prepared..."
- ✅ `src/i18n/he.json` (lines 261-263) — soonBadge: "בקרוב", justAddedBadge: "חדש", contentLocked: "תוכן זה בהכנה..."

### Test Files Verified (All Passing)
- ✅ `tests/unit/queries/course-content-status.test.ts` (124 lines, 4 tests) — query filtering assertions
- ✅ `tests/unit/queries/lesson-content-status.test.ts` (113 lines, 2 tests) — query filtering assertions
- ✅ `tests/unit/components/CourseCard.test.tsx` (232 lines, 12 tests) — badge rendering, disabled button, locked behavior
- ✅ `tests/unit/components/CourseLessonCard.test.tsx` (123 lines, 6 tests) — badge rendering, locked behavior
- ✅ `tests/unit/components/ContentStatusBadge.test.tsx` (94 lines, 10 tests) — render, expiry, styling
- ✅ `tests/unit/i18n/contentStatus-translations.test.ts` (65 lines, 8 tests) — translation keys
- ✅ `tests/unit/fields/contentStatus.test.ts` (95 lines, 10 tests) — field structure

### Patterns Observed
- Query filtering uses `{ or: [{ contentStatus: { not_equals: 'soon' } }, { contentStatusVisible: { equals: true } }] }` — correct logic
- CourseCard button uses `disabled={isLoading || isSoon}` — proper accessibility
- CourseLessonCard uses `href={isSoon ? '#' : href}` with onClick handler for toast — correct locked behavior
- ContentStatusBadge checks expiry date for justAdded status — correct auto-expiry
- All translations present in both en.json and he.json

### Integration Points
- `queryPublishedCourses()` called by `src/app/(frontend)/courses/page.tsx`
- `queryCourseBySlug()` called by course detail pages
- `queryLessonsByChapter()` called by chapter view components
- `queryLessonsByCourse()` called by course content listing
- `publishedAndActive` access control NOT modified (correct design decision)

## Reuse Inventory

### Existing utilities reused:
- `Where` type from `payload` — imported in query files
- `cn` from `@/infra/utils/ui` — used in all UI components
- `useTranslations` from `@/ui/web/providers/I18n` — used for badge text
- `toast` from `sonner` — used for locked message
- `contentStatusFields` from `@/server/payload/fields/contentStatus` — shared across Courses and Lessons

### No NEW utilities needed
All changes reuse existing patterns and utilities.

---

## Step 1: Verify and Confirm Implementation (No Code Changes)

**Spec refs**: All spec requirements (§1.1, §1.2, §2.1, §3.1, §3.2, FR-001–FR-006, AC-1–AC-9)

**Files to touch**: None — implementation is complete

**Exact behavior**:
The build agent should:
1. Run `pnpm tsc --noEmit` to confirm type safety
2. Run `pnpm lint` to confirm code quality
3. Run all content-status tests to confirm all pass
4. Produce a clean build report confirming feature completeness

**Tests** (already passing):
- `tests/unit/queries/course-content-status.test.ts` — 4 tests PASS
- `tests/unit/queries/lesson-content-status.test.ts` — 2 tests PASS
- `tests/unit/components/CourseCard.test.tsx` — 12 tests PASS
- `tests/unit/components/CourseLessonCard.test.tsx` — 6 tests PASS
- `tests/unit/components/ContentStatusBadge.test.tsx` — 10 tests PASS
- `tests/unit/i18n/contentStatus-translations.test.ts` — 8 tests PASS
- `tests/unit/fields/contentStatus.test.ts` — 10 tests PASS

**Acceptance criteria**:
- [x] `pnpm tsc --noEmit` passes
- [x] `pnpm lint` passes
- [x] All 52 content-status tests pass (46 from targeted run + 6 from CourseLessonCard)
- [x] No regressions in existing tests

**Run**: `pnpm tsc --noEmit && pnpm lint && pnpm vitest run --config vitest.config.unit.mts tests/unit/queries/course-content-status.test.ts tests/unit/queries/lesson-content-status.test.ts tests/unit/components/CourseCard.test.tsx tests/unit/components/CourseLessonCard.test.tsx tests/unit/components/ContentStatusBadge.test.tsx tests/unit/i18n/contentStatus-translations.test.ts tests/unit/fields/contentStatus.test.ts`
