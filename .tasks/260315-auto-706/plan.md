# Plan: 260315-auto-706 — Content Status Badging ("Soon" & "Just Added")

## Rerun Context

This is a rerun. The prior run implemented most of the feature correctly but **missed one component**: the `LessonCard` component used in the chapter page still does NOT have the ContentStatusBadge or locked behavior.

**Prior run implemented ✅:**
- `contentStatusFields` in `src/server/payload/fields/contentStatus.ts`
- Collections: Courses.ts and Lessons.ts have contentStatusFields
- `ContentStatusBadge` component in `src/ui/web/shared/ContentStatusBadge/index.tsx`
- `CourseCard` badge + locked behavior in `src/app/(frontend)/courses/_components/CourseCard/index.tsx`
- `CourseLessonCard` (new component) badge + locked behavior in `src/app/(frontend)/courses/[courseSlug]/_components/CourseLessonCard/index.tsx`
- Query filtering in `src/server/repos/queries/courses.ts` and `lessons.ts`
- Translations in `src/i18n/en.json` and `src/i18n/he.json`
- Tests for all the above (52 tests, all passing)

**Still missing ❌ (this plan fixes):**
- `LessonCard` component at `src/app/(frontend)/courses/_components/LessonCard/index.tsx` — used in the chapter page (`courses/[courseSlug]/chapters/[chapterSlug]/page.tsx`) — has NO badge display and NO locked behavior for "Soon" lessons.

**Why verify failed**: The verification likely failed because the LessonCard (visible on chapter pages) still allows clicking into "Soon" lessons, which violates the spec requirement that students cannot access "Soon" content.

## Research Findings

### File Paths Verified
- ✅ `src/app/(frontend)/courses/_components/LessonCard/index.tsx` (53 lines) — MISSING badge and locked behavior
- ✅ `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/page.tsx` (line 97) — imports LessonCard
- ✅ `src/ui/web/shared/ContentStatusBadge/index.tsx` (73 lines) — reusable badge component exists
- ✅ `src/app/(frontend)/courses/[courseSlug]/_components/CourseLessonCard/index.tsx` (113 lines) — pattern to follow
- ✅ `src/i18n/en.json` (lines 261-263) — soonBadge, justAddedBadge, contentLocked translations exist
- ✅ `src/i18n/he.json` (lines 261-263) — Hebrew translations exist
- ✅ `src/payload-types.ts` — Lesson type has contentStatus, contentStatusVisible, contentStatusExpiresAt fields

### Patterns Observed
- `CourseLessonCard` (already implemented) uses the exact pattern needed:
  - Import `ContentStatusBadge` from `@/ui/web/shared/ContentStatusBadge`
  - Import `toast` from `sonner`
  - Check `lesson.contentStatus === 'soon'` for locked behavior
  - Use `e.preventDefault()` + `toast.info(tc('contentLocked'))` on click
  - Use `isSoon ? '#' : href` for link href
  - Add `opacity-60` and `cursor-not-allowed` styling for "Soon" state
  - Render `<ContentStatusBadge>` next to lesson title
- `LessonCard` currently uses `Button asChild > SystemLink` pattern for navigation — will need to switch to onClick handler or wrap in a container that intercepts clicks

### Integration Points
- `LessonCard` is imported by `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/page.tsx` line 16
- `LessonCard` receives `{ lesson, courseSlug, chapterSlug }` props (no change needed)
- The `Lesson` type already includes `contentStatus` and `contentStatusExpiresAt`

## Reuse Inventory

### Existing utilities reused:
- `ContentStatusBadge` from `@/ui/web/shared/ContentStatusBadge` — badge rendering
- `toast` from `sonner` — locked message notification
- `cn` from `@/infra/utils/ui` — already imported in LessonCard (via Card component, but we'll add direct import)
- `useTranslations('courses')` — already used in LessonCard for 'lesson' and 'viewLesson' keys; 'contentLocked' is in same namespace

### No NEW utilities needed
All changes reuse existing code and patterns.

---

## Step 1: Add ContentStatusBadge and Locked Behavior to LessonCard

**Spec refs**: §1.1 (Soon badge on lesson card), §1.2 (Just Added badge on lesson card), §3.1 (badge next to lesson title), AC-2 (students cannot access Soon content), AC-3 (Just Added badge appears when enabled)

**Files to touch**:
- `src/app/(frontend)/courses/_components/LessonCard/index.tsx` (MODIFIED — all 53 lines)

**Exact behavior**:

1. **Add imports**: Import `ContentStatusBadge` from `@/ui/web/shared/ContentStatusBadge`, `toast` from `sonner`, and `cn` from `@/infra/utils/ui`
2. **Add isSoon check**: `const isSoon = lesson.contentStatus === 'soon'`
3. **Add badge display**: Render `<ContentStatusBadge contentStatus={lesson.contentStatus} contentStatusExpiresAt={lesson.contentStatusExpiresAt ?? undefined} />` next to the lesson title inside `<CardHeader>`, after the `<CardTitle>`
4. **Add locked behavior**: When `isSoon` is true:
   - Replace `<Button asChild><SystemLink>` with a regular `<Button>` that has an `onClick` handler
   - The `onClick` shows toast: `toast.info(t('contentLocked'))`
   - The button is disabled: `disabled={isSoon}`
   - Add visual styling: reduce opacity on the Card when `isSoon` (`opacity-60`)
   - Add `cursor-not-allowed` styling
5. **When NOT isSoon**: Keep the existing `<Button asChild><SystemLink>` pattern (normal navigation)
6. **Badge placement**: Add badge inline with the title using a flex wrapper: `<div className="flex items-center gap-2">` around `<CardTitle>` and `<ContentStatusBadge>`

**Pattern to follow**: `src/app/(frontend)/courses/[courseSlug]/_components/CourseLessonCard/index.tsx` — specifically lines 35 (isSoon check), 47-51 (onClick handler), 85-88 (badge rendering), 64-67 (styling)

**Tests that FAIL before, PASS after**:

1. Test file: `tests/unit/components/LessonCard.test.tsx` (NEW)
   - Test: `renders "Soon" badge when lesson.contentStatus is "soon"`
   - Why it fails: LessonCard currently doesn't render ContentStatusBadge at all
   - After: Badge text "Soon" appears in rendered output

2. Test file: `tests/unit/components/LessonCard.test.tsx` (NEW)
   - Test: `renders "New" badge when lesson.contentStatus is "justAdded"`
   - Why it fails: LessonCard currently doesn't render ContentStatusBadge
   - After: Badge text "New" appears in rendered output

3. Test file: `tests/unit/components/LessonCard.test.tsx` (NEW)
   - Test: `does not render badge when contentStatus is "none"`
   - Why it fails: Need to verify no badge for default state
   - After: Neither "Soon" nor "New" text appears

4. Test file: `tests/unit/components/LessonCard.test.tsx` (NEW)
   - Test: `shows toast and prevents navigation when clicking "Soon" lesson`
   - Why it fails: LessonCard currently always navigates via SystemLink
   - After: toast.info is called with contentLocked message, no navigation occurs

5. Test file: `tests/unit/components/LessonCard.test.tsx` (NEW)
   - Test: `button is disabled when lesson is "Soon"`
   - Why it fails: LessonCard button is always enabled
   - After: Button element has disabled attribute

6. Test file: `tests/unit/components/LessonCard.test.tsx` (NEW)
   - Test: `navigates normally for "justAdded" lesson`
   - Why it fails: Need to verify that justAdded lessons still navigate
   - After: SystemLink renders with correct href, no toast shown

7. Test file: `tests/unit/components/LessonCard.test.tsx` (NEW)
   - Test: `does not render badge when justAdded has expired date`
   - Why it fails: Need to verify expiry behavior
   - After: No "New" text when contentStatusExpiresAt is in the past

**Test command**: `pnpm vitest run --config vitest.config.unit.mts tests/unit/components/LessonCard.test.tsx`

**Acceptance criteria**:
- [ ] LessonCard renders ContentStatusBadge for "soon" and "justAdded" statuses
- [ ] LessonCard does NOT render badge for "none" status
- [ ] Clicking a "Soon" lesson shows toast with contentLocked message
- [ ] "Soon" lesson button is disabled (disabled attribute present)
- [ ] "Soon" lesson has reduced opacity styling
- [ ] "justAdded" lessons navigate normally
- [ ] Badge is positioned next to lesson title
- [ ] Expired "justAdded" badges do not render
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes
- [ ] All 7 new LessonCard tests pass
- [ ] All 52 existing content-status tests still pass
