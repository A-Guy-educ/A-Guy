# Plan: 260315-auto-706 — Content Status Badging ("Soon" & "Just Added")

## Rerun Context

This is a **rerun** (3rd attempt). The prior run implemented the LessonCard badge + locked behavior successfully and all 62 tests pass. However, the **code review identified a major issue** that caused verification to fail:

**Major Issue: Invalid HTML nesting (`<button>` wrapping `<a>`) in LessonCard**

When `isSoon=true`, the code does `<Button asChild={!isSoon}>` which renders a `<button>` element, but the child is still a `<SystemLink>` (renders as `<a>`). This produces `<button><a href="#">...</a></button>` — an interactive element nested inside another interactive element. This is invalid HTML and fails accessibility validation.

**Fix approach**: Use conditional rendering — render a standalone `<Button onClick>` for locked lessons (showing toast), and `<Button asChild><SystemLink>` for normal lessons. The locked button should NOT use `disabled` because:
1. A `disabled` HTML button prevents `onClick` from firing (native browser behavior)
2. The Button component applies `disabled:pointer-events-none` CSS, further blocking clicks
3. The spec (AC-2) requires "clicking shows locked message" — which needs click events to work
4. Instead, use an enabled `<Button>` with `onClick` handler + `cursor-not-allowed` CSS styling

**Additional minor issues from review**:
1. Test uses `any` type for mock props — should use proper type
2. Tests use `.toBeTruthy()` instead of `.toBeInTheDocument()`

**What's already working (DO NOT modify)**:
- `contentStatusFields` in `src/server/payload/fields/contentStatus.ts` ✅
- Collections: Courses.ts and Lessons.ts have contentStatusFields ✅
- `ContentStatusBadge` component ✅
- `CourseCard` badge + locked behavior ✅
- `CourseLessonCard` badge + locked behavior ✅
- Query filtering in courses.ts and lessons.ts ✅
- Translations in en.json and he.json ✅
- All existing tests (52 prior + 10 LessonCard) ✅

## Research Findings

### File Paths Verified
- ✅ `src/app/(frontend)/courses/_components/LessonCard/index.tsx` (80 lines) — Has badge + locked behavior BUT with invalid HTML nesting
- ✅ `src/app/(frontend)/courses/_components/CourseCard/index.tsx` (153 lines) — **Reference pattern**: standalone `<Button onClick>` with `disabled={isSoon}`, no asChild/SystemLink when locked
- ✅ `src/app/(frontend)/courses/[courseSlug]/_components/CourseLessonCard/index.tsx` (113 lines) — **Reference pattern**: uses single `<SystemLink>` wrapper (no Button component) with `cursor-not-allowed`
- ✅ `src/ui/web/shared/ContentStatusBadge/index.tsx` (73 lines) — Badge component, no changes needed
- ✅ `src/ui/web/components/button.tsx` (51 lines) — Button with `asChild` uses `Slot` from radix; when `asChild=false`, renders as `<button>` element
- ✅ `tests/unit/components/LessonCard.test.tsx` (157 lines) — Existing tests, needs minor update for new Button structure
- ✅ `tests/unit/components/CourseLessonCard.test.tsx` (123 lines) — Test pattern reference

### Patterns Observed
- **CourseCard** (line 129-149): Uses standalone `<Button onClick={handler} disabled={isSoon}>` — no toast fires for "Soon" (disabled blocks click events). CourseCard test line 187 explicitly asserts `expect(toast.info).not.toHaveBeenCalled()`.
- **CourseLessonCard** (line 63-70): Uses `<SystemLink href={isSoon ? '#' : href} onClick={handleClick}>` as the entire card wrapper. No Button at all. `cursor-not-allowed` applied via className. Toast fires on click (no `disabled` attribute).
- **Button component**: When `asChild=false`, renders `<button>`. When `asChild=true`, renders `<Slot>` which passes props to child. Nesting `<button><a>` when `asChild=false` is invalid.
- **CRITICAL**: A `<button disabled>` with `onClick` handler will NOT fire `onClick` — this is native browser behavior. The Button component also adds `disabled:pointer-events-none` CSS. Therefore, using `disabled` and expecting toast to fire is **contradictory**.

### Integration Points
- `LessonCard` imported by `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/page.tsx` — no changes needed to importing page
- `Lesson` type has `contentStatus: 'none' | 'soon' | 'justAdded'` and `contentStatusExpiresAt?: string | null`

## Reuse Inventory

### Existing utilities reused (no changes needed):
- `ContentStatusBadge` from `@/ui/web/shared/ContentStatusBadge` — badge rendering
- `toast` from `sonner` — locked message notification
- `cn` from `@/infra/utils/ui` — conditional class merging
- `useTranslations('courses')` — already used in LessonCard
- `Card`, `CardHeader`, `CardTitle`, `CardFooter` from `@/ui/web/components/card`
- `Button` from `@/ui/web/components/button`
- `SystemLink` from `@/infra/loading/components/SystemLink`

### No NEW utilities needed
All changes fix existing code using existing patterns.

---

## Step 1: Fix Invalid HTML Nesting in LessonCard Button/Link

**Spec refs**: §1.1 (Soon locked behavior), §1.2 (Just Added navigable), AC-2 (students cannot access Soon), AC-3 (Just Added badge appears)

**Root cause**: `<Button asChild={!isSoon}>` with `<SystemLink>` always as child produces `<button><a>` when `isSoon=true` — invalid HTML.

**Files to touch**:
- `src/app/(frontend)/courses/_components/LessonCard/index.tsx` (MODIFIED — lines 67-77)

**Exact behavior**:

1. **Replace the single `Button > SystemLink` pattern** (lines 67-76) with **conditional rendering**:
   - When `isSoon`: Render `<Button onClick={handleLessonClick} className="cursor-not-allowed">{t('viewLesson')}</Button>` — a standalone button with no child link. Do NOT use `disabled` because it prevents `onClick` from firing (native browser behavior + Button's `disabled:pointer-events-none` CSS). The `cursor-not-allowed` class and Card's `opacity-60` provide the visual "locked" cue, and the toast provides the user feedback per AC-2.
   - When NOT `isSoon`: Render `<Button asChild><SystemLink href={href}>{t('viewLesson')}</SystemLink></Button>` — the normal pattern that renders the link as the button element.

2. **Keep everything else unchanged**: The `handleLessonClick` function, `isSoon` check, `ContentStatusBadge`, opacity on Card, all remain exactly as they are.

**Pattern to follow**: `CourseLessonCard/index.tsx` lines 46-52, 63-70 — uses `onClick` + `cursor-not-allowed` (no `disabled` attribute) so the toast fires. Adapted here to use conditional render instead of single SystemLink wrapper.

**HTML structure after fix**:
- `isSoon=true`: `<button class="cursor-not-allowed ...">View Lesson</button>` ✅ Valid, clickable (fires toast)
- `isSoon=false`: `<a href="/courses/...">View Lesson</a>` (via Slot/asChild) ✅ Valid

**Tests that FAIL before, PASS after**:

1. Test file: `tests/unit/components/LessonCard.test.tsx`
   - Existing test: `shows toast when clicking "Soon" lesson` (must still pass)
   - Why it works: `handleLessonClick` is now on the Button's `onClick`, not on the SystemLink. Button is NOT disabled so click fires.
   - After: Toast still fires on click

2. Test file: `tests/unit/components/LessonCard.test.tsx`
   - Existing test: `renders SystemLink for "justAdded" lessons (navigates normally)` (must still pass)
   - After: SystemLink still renders with correct href for non-soon lessons

3. Test file: `tests/unit/components/LessonCard.test.tsx`
   - Test: `does not render SystemLink when lesson is "Soon"` (NEW — replaces old `href is "#"` test)
   - Why it fails before: Current implementation always renders SystemLink
   - After: SystemLink is not rendered when isSoon, only a standalone Button

**Test command**: `pnpm vitest run --config vitest.config.unit.mts tests/unit/components/LessonCard.test.tsx`

**Acceptance criteria**:
- [ ] No `<button><a>` nesting in rendered HTML — when `isSoon`, renders standalone `<button>`, no `<a>` inside
- [ ] When `isSoon=false`, `<Button asChild><SystemLink href={href}>` renders as `<a>` (valid HTML)
- [ ] Button is NOT `disabled` when `isSoon=true` (so `onClick` fires the toast)
- [ ] Clicking "Soon" lesson shows toast with `contentLocked` message (AC-2)
- [ ] "justAdded" and "none" lessons still navigate normally via SystemLink
- [ ] Card still has `opacity-60` for "Soon" lessons
- [ ] Badge still renders next to title for "soon" and "justAdded"
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes
- [ ] All LessonCard tests pass (existing tests updated + new tests)
- [ ] All 52+ existing content-status tests still pass

## Step 2: Fix Minor Test Quality Issues

**Spec refs**: Code quality (review minor issues)

**Files to touch**:
- `tests/unit/components/LessonCard.test.tsx` (MODIFIED)

**Exact behavior**:

1. **Fix `any` type in SystemLink mock** (line 12): Replace `any` with a proper interface `{ href: string; children: React.ReactNode; onClick?: React.MouseEventHandler; className?: string }`
2. **Update tests for new conditional rendering structure**:
   - The `href is "#" when lesson is "Soon"` test (line 127-134) → **replace** with `does not render SystemLink when lesson is "Soon"` — verifies `screen.queryByTestId('system-link')` returns null when isSoon (SystemLink is no longer rendered for locked lessons).
   - The `shows toast when clicking "Soon" lesson` test (line 116-125) → **update** to find the `<button>` element via `screen.getByRole('button')` instead of `screen.getByTestId('system-link')` (since SystemLink is not rendered for soon). Click the button and verify `toast.info` was called.
   - The `renders SystemLink for normal (non-soon) lessons` test (line 136-141) — should still work as-is.
   - The `renders SystemLink for "justAdded" lessons (navigates normally)` test (line 143-155) — should still work as-is.

**Tests that FAIL before, PASS after**:

1. Test: `shows toast when clicking "Soon" lesson` (MODIFIED)
   - Now clicks the `<button>` element via `getByRole('button')` instead of `system-link` testid
   - Still verifies `toast.info` was called with message containing 'prepared'

2. Test: `does not render SystemLink when lesson is "Soon"` (REPLACES old `href is "#"` test)
   - Verifies `screen.queryByTestId('system-link')` returns null when isSoon
   - Verifies a `<button>` element is rendered instead

**Test command**: `pnpm vitest run --config vitest.config.unit.mts tests/unit/components/LessonCard.test.tsx`

**Acceptance criteria**:
- [ ] No `any` types in test file
- [ ] Updated `shows toast when clicking "Soon" lesson` test passes (clicks button, not link)
- [ ] New `does not render SystemLink when lesson is "Soon"` test passes
- [ ] All other existing LessonCard tests still pass
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes
