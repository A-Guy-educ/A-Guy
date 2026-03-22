# Plan: Fix Lesson Order Display Bug

**Task ID**: 260311-auto-416
**Task Type**: fix_bug
**Spec Reference**: FR-1 (Lesson Ordering), FR-2 (Admin Order Field)

## Rerun Context

Rerun requested via `/cody rerun` with no specific code-level feedback. Previous run did not produce a plan.md (timed out or failed at architect stage). This is a fresh plan based on codebase research.

## Research Findings

### File Paths Verified
- ✅ `src/server/payload/collections/Lessons.ts` — Lessons collection config, has `order` field (line 107-116) but **missing `index: true`**
- ✅ `src/server/repos/queries/lessons.ts` — Query functions: `queryLessonsByChapter`, `queryLessonsByCourse`, `queryLessonBySlug`
- ✅ `src/app/api/chapters/by-grade/route.ts` — API route fetching lessons for study page
- ✅ `src/app/(frontend)/courses/[courseSlug]/_components/LearnTab/index.tsx` — Renders learning lessons
- ✅ `src/app/(frontend)/courses/[courseSlug]/_components/PracticeTab/index.tsx` — Renders practice lessons
- ✅ `src/app/(frontend)/courses/[courseSlug]/_components/CoursePageContent/index.tsx` — Course page container
- ✅ `src/app/(frontend)/courses/[courseSlug]/page.tsx` — Course SSR page
- ✅ `src/app/(frontend)/study/_components/StudyContent/index.tsx` — Study page (uses by-grade API)
- ✅ `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/page.tsx` — Chapter page
- ✅ `tests/unit/queries/lessons.test.ts` — Existing unit tests for lesson queries

### Patterns Observed
- Query functions in `src/server/repos/queries/` use React `cache()` wrapper and `getPayload()`
- Existing queries use `sort: 'order'` for lesson sorting
- Collections use `publishedAndActive` access control from `src/server/payload/access/`
- Unit tests mock `payload` via `vi.mock('payload')` and `vi.mock('@payload-config')`

### Integration Points
- `queryLessonsByCourse` is called by course page (`src/app/(frontend)/courses/[courseSlug]/page.tsx`)
- `queryLessonsByChapter` is called by chapter page and internally by `queryLessonsByCourse`
- `/api/chapters/by-grade` is called by `StudyContent` component via `fetch()`

## Root Cause Analysis

**The bug has TWO contributing causes:**

### Cause 1: `queryLessonsByCourse` sorts globally by `order`, interleaving chapters

`queryLessonsByCourse` (line 172-198 in `lessons.ts`) fetches all lessons across ALL chapters in a course with a single query using `sort: 'order'`. This means lessons from different chapters with the same or overlapping order values get interleaved.

Example: Chapter 1 has lessons with order 1, 2, 3. Chapter 2 has lessons with order 1, 2, 3. The query returns: [Ch1-L1, Ch2-L1, Ch1-L2, Ch2-L2, Ch1-L3, Ch2-L3] — not grouped by chapter.

This is consumed by `LearnTab` and `PracticeTab` which render the flat list as-is, resulting in lessons displayed out of the expected chapter-grouped order.

### Cause 2: `order` field lacks `index: true` on Lessons collection

The `order` field (line 107-116 in `Lessons.ts`) has no `index: true`, causing MongoDB to perform in-memory sorting rather than using an index. While MongoDB will still sort correctly, adding an index ensures consistent and efficient sort behavior, especially with large datasets.

## Reuse Inventory

### Existing utilities the plan will reuse:
- `publishedAndActive` from `src/server/payload/access/` — already used for lesson read access
- `queryChaptersByCourse` from `src/server/repos/queries/chapters.ts` — already used in `queryLessonsByCourse`
- Existing test patterns from `tests/unit/queries/lessons.test.ts` — mock structure for Payload

### New utilities: None — this fix modifies existing code only

---

## Step 1: Add `index: true` to Lessons `order` field and set `defaultSort` on collection

**Root Cause**: The `order` field lacks a database index, and the collection has no `defaultSort`, meaning admin API and REST queries don't sort by order by default.

**Files to Touch**:
- `src/server/payload/collections/Lessons.ts` (MODIFIED — lines 107-116)

**Reproduction Test**: Write a schema-level test verifying the `order` field has `index: true`:

- Test location: `tests/unit/collections/lessons-order-config.test.ts` (NEW)
- What it tests: That the Lessons collection config has `index: true` on the `order` field and `defaultSort: 'order'` on the collection
- Why it fails now: The `order` field has no `index: true` and collection has no `defaultSort`

**Fix**:
1. Add `index: true` to the `order` field definition (line ~110)
2. Add `defaultSort: 'order'` to the collection admin config (after line ~38, inside `admin:{}`)

**Verification**:
- Run schema test → FAILS before (no index, no defaultSort)
- After fix → PASSES (index and defaultSort present)
- Command: `pnpm test:unit -- --testPathPattern lessons-order-config`

**Acceptance Criteria**:
- [ ] `order` field has `index: true` in collection config
- [ ] Collection has `defaultSort: 'order'` in admin config

---

## Step 2: Fix `queryLessonsByCourse` to sort lessons by chapter order then lesson order

**Root Cause**: `queryLessonsByCourse` does a flat `sort: 'order'` across all chapters, which interleaves lessons from different chapters when they share similar order values. Lessons should be grouped by chapter (in chapter order) and sorted by lesson order within each chapter.

**Files to Touch**:
- `src/server/repos/queries/lessons.ts` (MODIFIED — lines 147-201, `queryLessonsByCourse` function)

**Reproduction Test**: Write a unit test proving lessons are returned in chapter-order-then-lesson-order:

- Test location: `tests/unit/queries/lessons.test.ts` (MODIFIED — add new describe block)
- What it tests: `queryLessonsByCourse` returns lessons grouped by chapter order, then sorted by lesson order within each chapter
- Why it fails now: Lessons from different chapters with overlapping order values are interleaved

**Fix**:
The `queryLessonsByCourse` function already calls `queryChaptersByCourse` to get chapters (which are sorted by `order`). After fetching all lessons, sort them client-side using the chapter order as primary sort key and lesson order as secondary:

```
1. Keep the existing batch query (efficient, single DB call)
2. After getting results, sort by: chapters[chapterIndex].order ASC, then lesson.order ASC
3. Use the already-fetched `chapters` array (sorted by chapter.order) to build a chapterIndex map
```

Specifically:
- Build a `Map<chapterId, chapterSortIndex>` from the sorted `chapters` array
- After the payload.find, sort `result.docs` by `(chapterSortIndex, lesson.order)`

**Verification**:
- Run unit test → FAILS before (interleaved order)
- After fix → PASSES (lessons grouped by chapter, sorted by order within chapter)
- Command: `pnpm test:unit -- --testPathPattern lessons`

**Acceptance Criteria**:
- [ ] Lessons from Chapter 1 (order=0) appear before lessons from Chapter 2 (order=1)
- [ ] Within each chapter group, lessons are sorted by their `order` field
- [ ] The batch query pattern is preserved (no N+1 queries introduced)

---

## Step 3: Verify `/api/chapters/by-grade` route also maintains correct order

**Root Cause**: The `/api/chapters/by-grade` route fetches lessons in bulk and groups them by chapter. Verify the grouping preserves order.

**Files to Touch**:
- `src/app/api/chapters/by-grade/route.ts` (MODIFIED — line 64, verify/add sort)

**Reproduction Test**: Write a unit test for the by-grade API response structure:

- Test location: `tests/unit/queries/lessons-by-grade-order.test.ts` (NEW)
- What it tests: That the by-grade API groups lessons by chapter and each group is ordered by `lesson.order`
- Why it currently may fail: The route does `sort: 'order'` on the query (line 64), and then groups by chapter (line 74-82). Lessons within each chapter group should already be in order since the original query was sorted. However, the `lessons.forEach` grouping doesn't guarantee order preservation. In JS, `forEach` preserves array order, so this should be fine. This step is a verification/guard test.

**Fix**: 
- The route already has `sort: 'order'` and the forEach grouping preserves array order — this is correct.
- Add `sort: 'order'` to the chapters query response too, ensuring chapters are returned in order (they already come from `queryChaptersByCourse` which sorts by `order`).
- No code change needed if verification passes; if not, add explicit sort after grouping.

**Verification**:
- Run test → should PASS (confirming existing behavior is correct)
- If FAILS → add explicit sort within each chapter group
- Command: `pnpm test:unit -- --testPathPattern lessons-by-grade`

**Acceptance Criteria**:
- [ ] Lessons within each chapter group are sorted by `order` field
- [ ] Chapters themselves are in `order` sequence

---

## Summary

| Step | What | Files | Time Est. |
|------|------|-------|-----------|
| 1 | Add `index: true` + `defaultSort` to Lessons collection | `Lessons.ts`, new test | 10 min |
| 2 | Fix `queryLessonsByCourse` sorting (primary: chapter order, secondary: lesson order) | `lessons.ts`, `lessons.test.ts` | 20 min |
| 3 | Verify `/api/chapters/by-grade` order preservation | `route.ts`, new test | 15 min |

**Total estimated time**: ~45 minutes

**Post-implementation**:
- Run `pnpm -s tsc --noEmit` to verify TypeScript correctness
- Run `pnpm test:unit` to verify all unit tests pass
- Run `pnpm -s lint` to verify linting
