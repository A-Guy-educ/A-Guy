# Plan Gap Analysis: 260315-auto-706

## Summary

- Gaps Found: 1 (minor)
- Plan Revised: Yes

## Gaps Found

### Gap 1: Plan Step 1 says `cn` is "already imported in LessonCard (via Card component)" — this is incorrect

**Severity:** Medium
**Issue:** The plan states in the Reuse Inventory: "cn from @/infra/utils/ui — already imported in LessonCard (via Card component, but we'll add direct import)". This is misleading — `cn` is NOT currently imported in `LessonCard/index.tsx` at all. The Card component imports it internally, but it is not re-exported or available in the LessonCard file. The plan does correctly say "we'll add direct import" in parentheses, and Step 1 Exact Behavior item 1 correctly lists adding the `cn` import. So the implementation instructions are correct, but the reuse inventory description is slightly misleading.
**Fix Applied:** No plan edit needed — the step instructions already correctly specify adding the import. This is a documentation clarity issue only.

## Feasibility Assessment

### File Paths Verified ✅

| File Path | Exists | Status |
|-----------|--------|--------|
| `src/app/(frontend)/courses/_components/LessonCard/index.tsx` | ✅ Yes (53 lines) | To be MODIFIED |
| `src/ui/web/shared/ContentStatusBadge/index.tsx` | ✅ Yes (73 lines) | Import target |
| `src/app/(frontend)/courses/[courseSlug]/_components/CourseLessonCard/index.tsx` | ✅ Yes (113 lines) | Pattern reference |
| `src/app/(frontend)/courses/_components/CourseCard/index.tsx` | ✅ Yes (153 lines) | Pattern reference |
| `src/infra/utils/ui.ts` | ✅ Yes | Exports `cn` |
| `src/i18n/en.json` | ✅ Yes (has soonBadge, justAddedBadge, contentLocked keys) | Read-only reference |
| `src/i18n/he.json` | ✅ Yes (has Hebrew translations) | Read-only reference |
| `src/payload-types.ts` | ✅ Yes (Lesson type has contentStatus fields) | Type reference |
| `tests/unit/components/LessonCard.test.tsx` | ❌ Does not exist yet | To be CREATED (correct) |
| `vitest.config.unit.mts` | ✅ Yes | Test runner config |

### Imports Validated ✅

- `ContentStatusBadge` exported from `src/ui/web/shared/ContentStatusBadge/index.tsx` → ✅
- `cn` exported from `src/infra/utils/ui.ts` → ✅
- `toast` available from `sonner` package → ✅ (used in CourseCard and CourseLessonCard already)
- `useTranslations` from `@/ui/web/providers/I18n` → ✅ (already imported in LessonCard)
- `Lesson` type from `@/payload-types` → ✅ (already imported in LessonCard, has `contentStatus` field)

### Step Ordering ✅

Single step — no ordering dependencies.

### Test Commands ✅

- Command: `pnpm vitest run --config vitest.config.unit.mts tests/unit/components/LessonCard.test.tsx`
- Uses vitest (correct, not jest)
- Uses pnpm (correct, not npm)
- Config file exists at `vitest.config.unit.mts`
- Test file path follows existing convention (`tests/unit/components/`)

### Time Budget ✅

Step 1 touches 1 source file + creates 1 test file — reasonable for a 10-20 minute implementation.

## Reuse Corrections

No reuse corrections needed. The plan correctly:
- Reuses existing `ContentStatusBadge` from `@/ui/web/shared/ContentStatusBadge` (does NOT create a new badge)
- Reuses existing `toast` from `sonner` (does NOT create a new notification system)
- Reuses existing `cn` from `@/infra/utils/ui` (does NOT create a new class merger)
- Reuses existing `useTranslations` with existing translation keys (does NOT add new i18n keys)
- Does NOT create new access control functions (correctly uses query-level filtering already in place)
- Does NOT create new hooks or utilities

## Spec Coverage ✅

| Spec Requirement | Plan Coverage |
|-----------------|---------------|
| §1.1 "Soon" badge on Lesson card | ✅ Step 1 item 3 |
| §1.2 "Just Added" badge on Lesson card | ✅ Step 1 item 3 |
| §2.1 Admin fields (None/Soon/Just Added) | ✅ Already implemented |
| §2.1 Visibility Toggle | ✅ Already implemented |
| §2.1 "New Until" date auto-expiry | ✅ Already implemented |
| §3.1 Pill-shaped badge, text-xs, rounded-full | ✅ ContentStatusBadge already has this |
| §3.1 Badge next to lesson title | ✅ Step 1 item 6 |
| §3.2 Pulse animation for "Just Added" | ✅ ContentStatusBadge already has animate-pulse |
| AC-1 Admins can mark lesson as "Soon" | ✅ Already implemented |
| AC-2 Students cannot access "Soon" content | ✅ Step 1 item 4 (locked behavior) |
| AC-3 "Just Added" badge appears when enabled | ✅ Step 1 item 3 |
| AC-4 Responsive design, no overlapping | ✅ Step 1 item 6 (flex gap-2 layout) |
| AC-9 "New Until" auto-expiry | ✅ ContentStatusBadge handles this |

## Changes Made to Plan

No changes were needed. The plan is well-structured with:
- Correct single-step scope (1 source file + 1 test file)
- All file paths verified as existing
- All imports verified as valid
- Correct test runner (vitest) and config file
- Appropriate pattern reference (CourseLessonCard)
- 7 well-defined TDD test cases
- Clear acceptance criteria

The plan accurately identifies the remaining gap (LessonCard missing badge + locked behavior) and provides a focused, feasible implementation step.
