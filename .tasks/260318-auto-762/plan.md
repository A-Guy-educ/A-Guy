# Plan: Remove Redundant "1" Label from Exercise Renderer

**Task ID**: 260318-auto-762
**Task Type**: fix_bug
**Complexity**: 12 (Simple)

## Rerun Context

This is a first run (no previous plan/build/review files found — all referenced prev-run files were missing).

## Research Findings

### File Paths Verified
- ✅ `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` — Main renderer component with the "Exercise Number Bubble" at lines 354-366
- ✅ `src/ui/web/exerciserenderer/types.ts` — `ExerciseRendererProps` with `exerciseNumber?: number` at line 203
- ✅ `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx` — Primary consumer, renders "Exercise X of Y" header (line 158-161) AND calls `ExerciseRenderer` at line 177 without passing `exerciseNumber`
- ✅ `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExercisePageContent/index.tsx` — Secondary consumer, also doesn't pass `exerciseNumber`
- ✅ `src/app/(frontend)/exercises/[id]/page.tsx` — Standalone exercise page, doesn't pass `exerciseNumber`
- ✅ `tests/unit/ui/exercise-renderer-side-by-side.test.tsx` — Existing test pattern for ExerciseRenderer tests

### Patterns Observed
- ExerciseRenderer has a "number bubble" (lines 354-366) that ALWAYS renders, displaying the `exerciseNumber` prop (defaults to `1`)
- ExercisesPager wraps ExerciseRenderer inside a card that already shows "Exercise X of Y" with a `<Layers>` icon (lines 157-173)
- The standalone exercise pages (`exercises/[id]/page.tsx` and `ExercisePageContent`) show the exercise title but NOT a number — so the bubble is also redundant there
- The bug: the internal number bubble is ALWAYS rendered, creating a duplicate "1" alongside the external exercise indicator

### Root Cause Analysis
The `ExerciseRenderer` component unconditionally renders an "Exercise Number Bubble" (div with a circle containing `exerciseNumber`). This was added as an internal numbering system. However:

1. **In ExercisesPager context**: The parent already shows "Exercise X of Y" (line 158-161), making the bubble redundant
2. **In standalone exercise pages**: No external numbering exists, but the bubble still shows "1" which adds no value for a single exercise
3. **No caller actually passes `exerciseNumber`** — it always defaults to `1`, confirming the bubble is unused/redundant

The fix should **remove the Exercise Number Bubble entirely** from `ExerciseRenderer`. All consumers already provide their own exercise identification (title + ordinal in ExercisesPager, title in standalone pages). No consumer passes `exerciseNumber`, further confirming the bubble serves no purpose.

### Integration Points
- `ExerciseRenderer` is consumed by 3 pages (ExercisesPager, ExercisePageContent, exercises/[id]/page.tsx)
- The `exerciseNumber` prop in `ExerciseRendererProps` should also be removed since it becomes unused
- No downstream components depend on the number bubble

## Reuse Inventory

- **Existing utilities reused**: None needed — this is a removal-only change
- **No new utilities needed**

---

## Step 1: Remove the redundant Exercise Number Bubble from ExerciseRenderer

**Root Cause**: The `ExerciseRenderer` component unconditionally renders a number bubble (lines 354-366) showing `exerciseNumber` which defaults to `1`. No consumer passes this prop, and all consumers already provide external exercise identification. This creates a redundant "1" label as described in the bug report.

**Files to Touch**:

- `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` (MODIFIED — lines 127, 354-366)
  - Remove the `exerciseNumber = 1` destructured prop (line 127)
  - Remove the entire "Exercise Number Bubble" JSX block (lines 354-366 — the outer `<div className="w-full flex items-center justify-between mb-6">` and all its children)
- `src/ui/web/exerciserenderer/types.ts` (MODIFIED — lines 202-203)
  - Remove the `exerciseNumber?: number` property and its JSDoc comment from `ExerciseRendererProps`

**Reproduction Test**: Write a test that demonstrates the bug (MUST FAIL now):

- Test location: `tests/unit/ui/exercise-renderer-number-bubble.test.tsx`
- What it tests: Render `ExerciseRenderer` with valid content and verify NO element with the exercise number bubble (a circle containing "1") is present in the output
- Why it fails: Currently the bubble is always rendered, so the test will find the "1" text inside a bubble element

**Test Details**:
```
- Use vitest + @testing-library/react (jsdom environment)
- Mock the I18n provider (useTranslations, useLocale) like existing test patterns
- Create minimal ExerciseContentData with a single rich_text block
- Render ExerciseRenderer with default props
- Assert: no element matching the number bubble pattern exists
- Specifically: queryByText("1") within a bubble container should return null
```

**Fix**: 
1. Remove lines 354-366 (the Exercise Number Bubble JSX) from `ExerciseRenderer/index.tsx`
2. Remove `exerciseNumber = 1` from the destructured props (line 127)
3. Remove `exerciseNumber?: number` and its JSDoc from `ExerciseRendererProps` in `types.ts`

**Verification**:
- Run reproduction test → FAILS before fix (bubble renders "1")
- After fix applied → PASSES (no bubble in DOM)
- Run `pnpm -s tsc --noEmit` → passes (no type errors from removed prop)
- Run existing tests `pnpm vitest run tests/unit/ui/exercise-renderer-side-by-side.test.tsx` → still passes

**Acceptance Criteria**:
- [ ] The "Exercise Number Bubble" div is removed from ExerciseRenderer output
- [ ] The `exerciseNumber` prop is removed from `ExerciseRendererProps` type
- [ ] No TypeScript errors (no other code references `exerciseNumber`)
- [ ] Existing tests continue to pass
- [ ] New reproduction test passes (confirms bubble is gone)
- [ ] The external "Exercise X of Y" label in ExercisesPager remains unaffected

---

## Spec Coverage Verification

| Bug Report Requirement | Plan Step |
|---|---|
| Remove the internal "1" label | Step 1 — removes the Exercise Number Bubble |
| Only the main/top numbering should be displayed | Step 1 — ExercisesPager's "Exercise X of Y" is untouched |
| Reproducibility: always | Step 1 — test verifies default render has no bubble |
