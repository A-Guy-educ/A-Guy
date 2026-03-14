# Code Review: 260311-auto-416

## Spec Satisfaction

| Requirement | Code Location | Test Coverage | Status |
|-------------|--------------|---------------|--------|
| FR-1: Lessons must be displayed on the website in the order defined in the admin panel | `src/server/repos/queries/lessons.ts:200-222` — `queryLessonsByCourse` now sorts by chapter order (primary) then lesson order (secondary) | `tests/unit/queries/lessons.test.ts:330-372` (main sorting test), `tests/unit/queries/lesson-order-sorting.test.ts:34-141` (duplicate sorting test) | ✅ Met |
| FR-1: The order/number field set in the admin must be respected when querying lessons | `src/server/repos/queries/lessons.ts:62` (`queryLessonsByChapter` already had `sort: 'order'`), line 193 (`queryLessonsByCourse` retains `sort: 'order'` in DB query + client-side chapter-grouped sort) | `tests/unit/queries/lessons.test.ts:330-444` (3 sorting tests) | ✅ Met |
| FR-2: Admin panel must have an order/number field for each lesson | `src/server/payload/collections/Lessons.ts:108-118` — `order` field exists with `type: 'number'`, `required: true`, `index: true` | `tests/unit/collections/lessons-order-config.test.ts:12-18` | ✅ Met |
| FR-2: This field must be savable and persist correctly | `src/server/payload/collections/Lessons.ts:108-118` — field has `required: true`, `defaultValue: 0`, standard Payload persistence | Pre-existing (Payload CMS handles persistence natively) | ✅ Met |
| AC-1: When lessons are set with specific order in admin, they display in that same order on website | `src/server/repos/queries/lessons.ts:200-222` — chapter-grouped sorting logic | `tests/unit/queries/lessons.test.ts:330-372` | ✅ Met |
| AC-2: The sorting is applied when fetching lessons for display (not just in admin) | `src/server/repos/queries/lessons.ts:62,193,200-222` — sorting applied in query layer, `src/server/payload/collections/Lessons.ts:12` — `defaultSort: 'order'` at collection level | `tests/unit/queries/lessons.test.ts:330-444`, `tests/unit/collections/lessons-order-config.test.ts:21-24` | ✅ Met |
| AC-3: This works for all lessons across different courses/exams | `src/server/repos/queries/lessons.ts:147-224` (course path), `src/server/repos/queries/lessons.ts:6-70` (chapter path), `src/app/api/chapters/by-grade/route.ts:64` (study page path — already had `sort: 'order'` + groups by chapter) | `tests/unit/queries/lessons.test.ts:318-444` (course path), `tests/unit/queries/lesson-order-sorting.test.ts:29-190` (additional course path tests) | ✅ Met |

**Spec Coverage**: 7/7 requirements met (100%)

## Code Quality Findings

### Critical

None.

### Major

None.

### Minor

1. **[tests/unit/queries/lesson-order-sorting.test.ts]** Duplicate test file — This file (190 lines) was created by the test agent and duplicates the same `queryLessonsByCourse` sorting tests that are already in `tests/unit/queries/lessons.test.ts:318-444`. Both test files cover the same functionality. Consider removing the duplicate to avoid maintenance burden.

2. **[src/app/api/chapters/by-grade/route.ts:43-68]** Missing `overrideAccess: false` — The `/api/chapters/by-grade` route performs `payload.find()` without setting `overrideAccess: false`, meaning it runs with admin privileges. This is a pre-existing issue, not introduced by this change, but worth noting. The route does filter by `status: 'published'` and `isActive: true` explicitly.

3. **[src/server/payload/collections/Lessons.ts:116]** The `order` field admin description says "Sort order within the course" but the field is actually used for ordering within a **chapter**, not the entire course. The sorting logic treats it as chapter-relative. Minor documentation mismatch.

## Reuse & Quality

| Check | Status | Notes |
|-------|--------|-------|
| No duplicated access control | ✅ | Reuses existing `adminOnly`, `publishedAndActive` |
| No duplicated utilities | ✅ | Reuses `queryChaptersByCourse` for chapter ordering |
| No duplicated validation schemas | ✅ | N/A for this change |
| Existing UI components used where possible | ✅ | No UI changes — fix is data-layer only |
| No `any` type escapes | ✅ | No `any` types introduced |
| Functions reasonably sized (<50 lines) | ✅ | `queryLessonsByCourse` is ~60 lines but contains necessary DB query + sort logic; well-structured |
| No magic numbers/strings | ✅ | `Infinity` sentinel for missing order/chapter is appropriate |
| Error handling on all async ops | ✅ | Existing error handling patterns preserved (`disableErrors: true` on findByID) |

## Summary

- **Issues Found**: No (minor items only — duplicate test file, pre-existing access concern, field description)
- **Spec Satisfied**: Yes (100% — all 7 requirements met with code + tests)
- **Recommendation**: Proceed
