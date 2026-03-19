# Build Agent Report: 260315-auto-706

## Changes

### Step 1: Fixed Invalid HTML Nesting in LessonCard Component

**File**: `src/app/(frontend)/courses/_components/LessonCard/index.tsx`

**Problem**: When `isSoon=true`, the code used `<Button asChild={!isSoon}>` which renders a `<button>` element, but its child was always `<SystemLink>` (renders as `<a>`). This produced `<button><a href="#">...</a></button>` — invalid HTML (interactive element nested inside interactive element).

**Fix**: Replaced single `<Button><SystemLink>` pattern with conditional rendering:
- When `isSoon=true`: Render standalone `<Button onClick={handleLessonClick} className="cursor-not-allowed">` — no child link, button handles click directly (toast fires per AC-2)
- When `isSoon=false`: Render `<Button asChild><SystemLink href={href}>` — normal pattern, SystemLink renders as `<a>`

**Why NOT `disabled`**: Using `disabled` would prevent `onClick` from firing (native browser behavior + Button's `disabled:pointer-events-none` CSS). The spec (AC-2) requires "clicking shows locked message" — which needs click events to work. Used `cursor-not-allowed` CSS + Card's `opacity-60` for visual "locked" cue instead.

### Step 2: Fixed Test Quality Issues

**File**: `tests/unit/components/LessonCard.test.tsx`

**Changes**:
1. Fixed `any` type in SystemLink mock — replaced with proper interface
2. Updated `shows toast when clicking "Soon" lesson` test — now clicks `<button>` element via `getByRole('button')` instead of `system-link` testid
3. Replaced `href is "#" when lesson is "Soon"` test with `does not render SystemLink when lesson is "Soon"` — verifies SystemLink is not rendered for locked lessons (validates the HTML fix)

## Tests Written

- `tests/unit/components/LessonCard.test.tsx` — Updated existing tests (10 total)
  - Added new test: `does not render SystemLink when lesson is "Soon"`
  - Updated test: `shows toast when clicking "Soon" lesson` to click button instead of link

## Tests Verified (All Passing)

All content-status related tests pass:
- `tests/unit/components/LessonCard.test.tsx` — 10 tests ✅
- `tests/unit/components/CourseCard.test.tsx` — 12 tests ✅
- `tests/unit/components/CourseLessonCard.test.tsx` — 6 tests ✅
- `tests/unit/components/ContentStatusBadge.test.tsx` — 10 tests ✅
- `tests/unit/queries/course-content-status.test.ts` — 4 tests ✅
- `tests/unit/queries/lesson-content-status.test.ts` — 2 tests ✅
- `tests/unit/fields/contentStatus.test.ts` — 10 tests ✅
- `tests/unit/i18n/contentStatus-translations.test.ts` — 8 tests ✅

**Total**: 62 tests passing

## Deviations

- None — plan followed exactly (with gap fix applied from plan-gap.md)

## Quality

- TypeScript: PASS (`pnpm tsc --noEmit`)
- Lint: PASS (`pnpm lint`)
- All 62 content-status tests: PASS
