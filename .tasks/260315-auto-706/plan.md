# Plan: 260315-auto-706 — Content Status Badging ("Soon" & "Just Added")

## Rerun Context

This is a rerun of a feature that is **95% complete**. All source files, tests, translations, and types are already implemented and passing (3716 unit tests pass, TSC passes, lint passes). The previous review identified exactly 2 required fixes:

1. **Critical: `contentStatusVisible` field is defined but never consumed** — When admin unchecks this toggle for a "Soon" course/lesson, students should NOT see it at all. Currently the queries in `src/server/repos/queries/courses.ts` and `src/server/repos/queries/lessons.ts` do not filter by this field.
2. **Major: CourseCard button `disabled` prop is `disabled={isLoading}` but should be `disabled={isLoading || isSoon}`** — For proper accessibility, "Soon" courses should have a truly disabled button.

This plan addresses only these 2 fixes. No other files need changes.

## Research Findings

### File Paths Verified
- ✅ `src/server/repos/queries/courses.ts` (56 lines) — `queryPublishedCourses` and `queryCourseBySlug` need filtering
- ✅ `src/server/repos/queries/lessons.ts` (225 lines) — `queryLessonsByChapter` and `queryLessonsByCourse` need filtering
- ✅ `src/app/(frontend)/courses/_components/CourseCard/index.tsx` (153 lines, line 131) — button `disabled` prop
- ✅ `src/server/payload/fields/contentStatus.ts` (57 lines) — field definition (unchanged, reference only)
- ✅ `src/server/payload/access/publishedAndActive.ts` (25 lines) — NOT to be modified per plan decision
- ✅ `tests/unit/components/CourseCard.test.tsx` (218 lines) — existing test for button disabled
- ✅ `tests/unit/queries/lessons.test.ts` — existing lesson query test pattern

### Patterns Observed
- Queries use `Where[]` conditions array with `{ and: conditions }` pattern
- The `contentStatusVisible` field defaults to `true`, so all old docs are treated as visible
- The condition should be: exclude items where `contentStatus === 'soon'` AND `contentStatusVisible === false`
- This is equivalent to adding: `{ or: [{ contentStatus: { not_equals: 'soon' }}, { contentStatusVisible: { equals: true } }] }`
- The query filtering approach is preferred over modifying `publishedAndActive` access control because:
  - `publishedAndActive` is shared across collections and should stay simple
  - The queries are the actual data-fetching layer for student-facing pages
  - The access control still allows authenticated (admin) users to see all content

### Integration Points
- `queryPublishedCourses()` — used by `src/app/(frontend)/courses/page.tsx` for course listing
- `queryCourseBySlug()` — used for individual course page
- `queryLessonsByChapter()` — used for lesson listing within a chapter
- `queryLessonsByCourse()` — used for lesson listing within a course

## Reuse Inventory

### Existing utilities to reuse:
- `Where` type from `payload` — already imported in query files
- Existing `conditions: Where[]` pattern — just push one more condition
- `cn` from `@/infra/utils/ui` — already imported in CourseCard

### No NEW utilities needed
These are small, targeted fixes to existing files.

---

## Step 1: Add `contentStatusVisible` Filtering to Course Queries

**Spec refs**: FR-004 (Access Control), Spec §2.1 (Visibility Toggle)

**Files to touch**:
- `src/server/repos/queries/courses.ts` (MODIFIED — lines 13-17 and 39)

**Exact behavior**:
In both `queryCourseBySlug` and `queryPublishedCourses`, add a condition to exclude courses where `contentStatus === 'soon'` AND `contentStatusVisible === false`. This ensures:
- "Soon" content with `visible=true`: included in listings (shown as locked teaser per clarified.md)
- "Soon" content with `visible=false`: completely hidden from student listings
- "None" and "Just Added" content: always included (the `or` clause handles this)

Add this condition to the shared conditions array in both functions:
```typescript
// Hide "Soon" content that admin has marked as not visible to students
{
  or: [
    { contentStatus: { not_equals: 'soon' } },
    { contentStatusVisible: { equals: true } },
  ],
}
```

**Tests** (FAIL before, PASS after):
- File: `tests/unit/queries/course-content-status.test.ts` (NEW)
- Test 1: `queryPublishedCourses includes courses with contentStatus 'none'` — mock payload.find, verify no filtering on contentStatus=none
- Test 2: `queryPublishedCourses includes 'soon' courses where contentStatusVisible is true` — mock, verify included
- Test 3: `queryPublishedCourses excludes 'soon' courses where contentStatusVisible is false` — mock, verify the where clause includes the `or` condition for contentStatusVisible
- Test 4: `queryCourseBySlug includes contentStatusVisible filter in query` — verify where clause

**Acceptance criteria**:
- [ ] `queryPublishedCourses` has `contentStatusVisible` filtering condition
- [ ] `queryCourseBySlug` has `contentStatusVisible` filtering condition
- [ ] Courses with `contentStatus='soon'` and `contentStatusVisible=false` are excluded from student listings
- [ ] Courses with `contentStatus='soon'` and `contentStatusVisible=true` are still returned (shown as locked)
- [ ] Courses with `contentStatus='none'` or `contentStatus='justAdded'` are unaffected

**Run**: `pnpm vitest run tests/unit/queries/course-content-status.test.ts`

---

## Step 2: Add `contentStatusVisible` Filtering to Lesson Queries

**Spec refs**: FR-004 (Access Control), Spec §2.1 (Visibility Toggle)

**Files to touch**:
- `src/server/repos/queries/lessons.ts` (MODIFIED — in `queryLessonsByChapter` at ~line 44 and `queryLessonsByCourse` at ~line 147)

**Exact behavior**:
Same condition as Step 1, added to the `where.and` array in both `queryLessonsByChapter` and `queryLessonsByCourse`:
```typescript
{
  or: [
    { contentStatus: { not_equals: 'soon' } },
    { contentStatusVisible: { equals: true } },
  ],
}
```

**Tests** (FAIL before, PASS after):
- File: `tests/unit/queries/lesson-content-status.test.ts` (NEW)
- Test 1: `queryLessonsByChapter includes contentStatusVisible filter in query` — verify where clause includes the condition
- Test 2: `queryLessonsByCourse includes contentStatusVisible filter in query` — verify where clause

**Acceptance criteria**:
- [ ] `queryLessonsByChapter` has `contentStatusVisible` filtering condition
- [ ] `queryLessonsByCourse` has `contentStatusVisible` filtering condition
- [ ] Lessons with `contentStatus='soon'` and `contentStatusVisible=false` are excluded

**Run**: `pnpm vitest run tests/unit/queries/lesson-content-status.test.ts`

---

## Step 3: Fix CourseCard Button `disabled` Prop

**Spec refs**: AC-2 (Students cannot access "Soon" content), FR-005 (Locked Message)

**Files to touch**:
- `src/app/(frontend)/courses/_components/CourseCard/index.tsx` (MODIFIED — line 131)

**Exact behavior**:
Change `disabled={isLoading}` to `disabled={isLoading || isSoon}` on the Button component. This ensures:
- Screen readers announce the button as disabled for "Soon" courses
- The button's built-in `disabled:pointer-events-none disabled:opacity-50` styles apply
- Combined with the existing `cursor-not-allowed` class on the button for visual feedback

**Tests** (FAIL before, PASS after):
- File: `tests/unit/components/CourseCard.test.tsx` (MODIFIED — add 1 test)
- Test: `"Soon" course button is disabled` — render course with `contentStatus='soon'`, assert button has `disabled` attribute

**Acceptance criteria**:
- [ ] Button element has `disabled` attribute when `contentStatus === 'soon'`
- [ ] All existing CourseCard tests still pass
- [ ] `pnpm -s tsc --noEmit` passes

**Run**: `pnpm vitest run tests/unit/components/CourseCard.test.tsx`

---

## Step 4: Final Quality Gates

**Spec refs**: All acceptance criteria

**Files to touch**: None (validation only)

**Exact behavior**:
1. Run type check: `pnpm -s tsc --noEmit`
2. Run lint: `pnpm -s lint`
3. Run all unit tests: `pnpm test:unit`
4. Verify no regressions

**Acceptance criteria**:
- [ ] `pnpm -s tsc --noEmit` passes
- [ ] `pnpm -s lint` passes
- [ ] All unit tests pass (3716+ tests)
- [ ] No changes to `publishedAndActive` access control

**Run**: `pnpm -s tsc --noEmit && pnpm -s lint && pnpm test:unit`
