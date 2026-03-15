# Plan: 260315-auto-706 — Content Status Badging ("Soon" & "Just Added")

## Rerun Context

This is a rerun triggered via `/cody rerun` with no specific feedback. The previous run had no prev-run artifacts (plan/build/review). This is effectively a fresh plan. The approach covers the full feature: backend schema fields, shared reusable field definition, a reusable `ContentStatusBadge` UI component, translation keys, `CourseCard` and `CourseLessonCard` integration with locked-content handling using Sonner toast.

## Research Findings

### File Paths Verified
- ✅ `src/server/payload/collections/Courses.ts` — existing collection, will add 3 fields
- ✅ `src/server/payload/collections/Lessons.ts` — existing collection, will add 3 fields
- ✅ `src/server/payload/access/publishedAndActive.ts` — current read access for both collections
- ✅ `src/server/payload/fields/contentLocale.ts` — pattern for reusable field definitions
- ✅ `src/server/payload/fields/createdBy.ts` — pattern for reusable field definitions
- ✅ `src/app/(frontend)/courses/_components/CourseCard/index.tsx` — will add badge + locked logic
- ✅ `src/app/(frontend)/courses/[courseSlug]/_components/CourseLessonCard/index.tsx` — will add badge + locked logic
- ✅ `src/app/(frontend)/courses/page.tsx` — server component, passes Course objects to CourseCard
- ✅ `src/server/repos/queries/courses.ts` — `queryPublishedCourses` returns courses for listing
- ✅ `src/server/repos/queries/lessons.ts` — `queryLessonsByChapter` / `queryLessonsByCourse`
- ✅ `src/ui/web/components/badge.tsx` — existing shadcn Badge component with CVA variants
- ✅ `src/ui/web/components/toaster.tsx` — Sonner toast already configured in project
- ✅ `src/i18n/en.json` — English translations (courses section at line 130)
- ✅ `src/i18n/he.json` — Hebrew translations (courses section at line 130)
- ✅ `tests/unit/components/CourseCard.test.tsx` — existing test pattern to extend
- ✅ `src/payload-types.ts` — generated types (Course, Lesson interfaces)
- 🆕 `src/server/payload/fields/contentStatus.ts` — reusable field group (NEW)
- 🆕 `src/ui/web/shared/ContentStatusBadge/index.tsx` — reusable badge component (NEW)
- 🆕 `tests/unit/components/ContentStatusBadge.test.tsx` — badge unit tests (NEW)
- 🆕 `tests/unit/components/CourseLessonCard.test.tsx` — lesson card tests (NEW)
- 🆕 `tests/unit/fields/contentStatus.test.ts` — field definition unit test (NEW)

### Patterns Observed
- Collections use `adminOnly` for create/update/delete, `publishedAndActive` for read
- Reusable fields are defined in `src/server/payload/fields/` (e.g., `contentLocale.ts`, `createdBy.ts`)
- Frontend components are client components with `'use client'`
- Translation keys follow `courses.<key>` namespace
- Tests use vitest + testing-library with I18nProvider wrapper
- Toast notifications use `toast` from `sonner` package (already in project)
- CourseCard already has absolute-positioned badge pattern for "הקורס שלך" (isOwned badge)

### Integration Points
- Courses.ts fields array — append content status fields
- Lessons.ts fields array — append content status fields
- CourseCard component — add badge display + locked click handler
- CourseLessonCard component — add badge display + locked click handler
- i18n JSON files — add translation keys
- `publishedAndActive` access — must NOT be modified; "Soon" visibility is handled via query-level filtering in repos and UI-level locking

## Reuse Inventory

### Existing utilities/functions to reuse:
- `adminOnly` from `src/server/payload/access/adminOnly.ts` — write access (unchanged)
- `publishedAndActive` from `src/server/payload/access/publishedAndActive.ts` — read access (unchanged)
- `Badge` from `src/ui/web/components/badge.tsx` — base badge component (will extend with custom classes)
- `cn` from `src/infra/utils/ui` — className merging utility
- `toast` from `sonner` — toast notifications for locked content message
- `useTranslations` from `@/ui/web/providers/I18n` — translation hook
- `createdByField` pattern from `src/server/payload/fields/createdBy.ts` — pattern for reusable fields
- Existing test helpers: `I18nProvider`, `render`, `screen`, `fireEvent` from testing-library

### Justification for NEW utilities:
- `src/server/payload/fields/contentStatus.ts` — Needed to DRY the 3 fields across Courses + Lessons. Follows existing `contentLocale.ts` / `createdBy.ts` reusable-field pattern.
- `src/ui/web/shared/ContentStatusBadge/index.tsx` — Needed because the badge has custom behavior (pulse animation, color logic, expiry check). Used by both CourseCard and CourseLessonCard. Avoids duplicating badge logic.

---

## Step 1: Create Reusable Content Status Fields

**Spec refs**: FR-001 (Content Status Field Schema)

**Files to touch**:
- `src/server/payload/fields/contentStatus.ts` (NEW)

**Exact behavior**:
Create a reusable Payload field group (array of `Field[]`) containing:
1. `contentStatus` — select field with options `none` (default), `soon`, `justAdded`. Index: true. Admin position: sidebar. Admin description: "Content status badge displayed to students".
2. `contentStatusVisible` — checkbox, default: true. Admin condition: only show when contentStatus is 'soon'. Admin description: "When unchecked, 'Soon' content is completely hidden from student listings".
3. `contentStatusExpiresAt` — date field, optional. Admin condition: only show when contentStatus is 'justAdded'. Admin description: "Badge auto-expires after this date (leave empty for permanent badge)".

Export as `contentStatusFields: Field[]` so it can be spread into any collection's fields array.

**Tests** (FAIL before, PASS after):
- File: `tests/unit/fields/contentStatus.test.ts`
- Test 1: `contentStatusFields exports an array of 3 Field objects` — verify array length, field names, types
- Test 2: `contentStatus field has correct options (none, soon, justAdded)` — verify options values
- Test 3: `contentStatusExpiresAt is a date type field` — verify type
- Test 4: `contentStatusVisible defaults to true` — verify defaultValue

**Acceptance criteria**:
- [ ] `contentStatusFields` exports Field[] with 3 entries
- [ ] Field names: `contentStatus`, `contentStatusVisible`, `contentStatusExpiresAt`
- [ ] `contentStatus` has options: `none`, `soon`, `justAdded` with default `none`
- [ ] `contentStatusVisible` has default `true`
- [ ] `contentStatusExpiresAt` is date type, not required

**Run**: `pnpm vitest run tests/unit/fields/contentStatus.test.ts`

---

## Step 2: Add Content Status Fields to Courses and Lessons Collections

**Spec refs**: FR-001, FR-002, Acceptance Criteria 1

**Files to touch**:
- `src/server/payload/collections/Courses.ts` (MODIFIED — lines 61-236, add import + spread fields before `createdByField`)
- `src/server/payload/collections/Lessons.ts` (MODIFIED — lines 51-256, add import + spread fields before `createdByField`)

**Exact behavior**:
1. Import `contentStatusFields` from `@/server/payload/fields/contentStatus`
2. In each collection's `fields` array, spread `...contentStatusFields` before the `createdByField` entry
3. Add `'contentStatus'` to the `admin.defaultColumns` array in both collections (after 'isActive')

After this step, run `pnpm generate:types` to update `src/payload-types.ts` with the new fields.

**Tests** (FAIL before, PASS after):
- File: `tests/unit/fields/contentStatus.test.ts` (extend from Step 1)
- Test 5: `Courses collection includes contentStatus field` — import Courses config and verify field exists
- Test 6: `Lessons collection includes contentStatus field` — import Lessons config and verify field exists

**Acceptance criteria**:
- [ ] Courses collection has all 3 content status fields
- [ ] Lessons collection has all 3 content status fields
- [ ] `contentStatus` appears in defaultColumns for both collections
- [ ] `pnpm generate:types` succeeds
- [ ] `pnpm -s tsc --noEmit` passes

**Run**: `pnpm vitest run tests/unit/fields/contentStatus.test.ts && pnpm generate:types && pnpm -s tsc --noEmit`

---

## Step 3: Add Translation Keys for Badge Labels and Locked Message

**Spec refs**: FR-003, Acceptance Criteria 2-3

**Files to touch**:
- `src/i18n/en.json` (MODIFIED — add keys inside `courses` object)
- `src/i18n/he.json` (MODIFIED — add keys inside `courses` object)

**Exact behavior**:
Add the following keys to the `courses` section of each JSON file:

**en.json** (inside `courses` object):
```json
"soonBadge": "Soon",
"justAddedBadge": "New",
"contentLocked": "This content is being prepared and will be available soon."
```

**he.json** (inside `courses` object):
```json
"soonBadge": "בקרוב",
"justAddedBadge": "חדש",
"contentLocked": "תוכן זה בהכנה ויהיה זמין בקרוב."
```

**Tests** (FAIL before, PASS after):
- File: `tests/unit/i18n/contentStatus-translations.test.ts` (NEW)
- Test 1: `en.json contains courses.soonBadge key` — parse JSON, assert key exists and value is 'Soon'
- Test 2: `he.json contains courses.soonBadge key` — parse JSON, assert key exists and value is 'בקרוב'
- Test 3: `both locales have all 3 content status translation keys` — verify soonBadge, justAddedBadge, contentLocked exist in both

**Acceptance criteria**:
- [ ] `en.json` has `courses.soonBadge`, `courses.justAddedBadge`, `courses.contentLocked`
- [ ] `he.json` has `courses.soonBadge`, `courses.justAddedBadge`, `courses.contentLocked`
- [ ] Values are correct for both languages

**Run**: `pnpm vitest run tests/unit/i18n/contentStatus-translations.test.ts`

---

## Step 4: Create Reusable ContentStatusBadge Component

**Spec refs**: FR-006 (Pulse Animation), Design Guidelines (3.1, 3.2), Acceptance Criteria 5-8

**Files to touch**:
- `src/ui/web/shared/ContentStatusBadge/index.tsx` (NEW)

**Exact behavior**:
Create a client component (`'use client'`) that renders a pill-shaped badge:

Props interface:
```typescript
interface ContentStatusBadgeProps {
  contentStatus?: 'none' | 'soon' | 'justAdded' | null
  contentStatusExpiresAt?: string | null
  className?: string
}
```

Logic:
1. If `contentStatus` is `'none'`, `null`, or `undefined` → render nothing (return `null`)
2. If `contentStatus` is `'justAdded'` AND `contentStatusExpiresAt` is set AND date is in the past → render nothing
3. If `contentStatus` is `'soon'` → render badge with neutral styling (gray background)
4. If `contentStatus` is `'justAdded'` → render badge with bright green styling + subtle pulse animation

Styling (Tailwind classes):
- Base: `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold`
- "Soon": `bg-muted text-muted-foreground`
- "Just Added": `bg-emerald-500 text-white animate-pulse` (Tailwind's built-in pulse with custom slower timing via inline style or a wrapper)

Uses `useTranslations('courses')` to get localized label text.

**Tests** (FAIL before, PASS after):
- File: `tests/unit/components/ContentStatusBadge.test.tsx` (NEW)
- Test 1: `renders nothing when contentStatus is 'none'`
- Test 2: `renders nothing when contentStatus is null/undefined`
- Test 3: `renders "Soon" badge with correct text for soon status`
- Test 4: `renders "New" badge with correct text for justAdded status`
- Test 5: `renders nothing when justAdded has expired date`
- Test 6: `renders badge when justAdded has future expiry date`
- Test 7: `"Just Added" badge has animate-pulse class`
- Test 8: `"Soon" badge does NOT have animate-pulse class`

**Acceptance criteria**:
- [ ] Component renders nothing for 'none'/null/undefined status
- [ ] "Soon" badge displays with neutral gray styling
- [ ] "Just Added" badge displays with green styling and pulse animation
- [ ] Expired "Just Added" badge is hidden
- [ ] Text uses translation keys (soonBadge / justAddedBadge)
- [ ] Component uses rounded-full pill shape

**Run**: `pnpm vitest run tests/unit/components/ContentStatusBadge.test.tsx`

---

## Step 5: Integrate Badge and Locked Logic into CourseCard

**Spec refs**: FR-005 (Locked Message), Acceptance Criteria 2-4, Design Guidelines 3.1

**Files to touch**:
- `src/app/(frontend)/courses/_components/CourseCard/index.tsx` (MODIFIED — lines 1-132)

**Exact behavior**:
1. Import `ContentStatusBadge` from `@/ui/web/shared/ContentStatusBadge`
2. Import `toast` from `sonner`
3. Derive effective content status: if `course.contentStatus === 'justAdded'` and `course.contentStatusExpiresAt` is past → treat as `'none'`
4. Add `ContentStatusBadge` in the card's top-right area (inside the existing relative container, positioned absolutely similar to the isOwned badge but on the right side: `absolute -top-3 right-6`)
5. Modify `handleCourseSelect`: if `course.contentStatus === 'soon'`, show toast with locked message (`t('contentLocked')`) and return early (do NOT navigate)
6. When `contentStatus === 'soon'`, add visual dimming: reduce card opacity slightly (`opacity-75`) and change cursor to `cursor-not-allowed` on the button
7. Disable the button when status is 'soon' (`disabled={isLoading || isSoon}`)

**Tests** (FAIL before, PASS after):
- File: `tests/unit/components/CourseCard.test.tsx` (MODIFIED — extend existing)
- Test 5: `renders "Soon" badge when course.contentStatus is 'soon'` — check badge text
- Test 6: `does NOT navigate when clicking a "Soon" course` — verify mockPush not called
- Test 7: `shows toast notification when clicking a "Soon" course` — mock sonner toast, verify called
- Test 8: `renders "Just Added" badge when course.contentStatus is 'justAdded'`
- Test 9: `navigates normally when course.contentStatus is 'justAdded'` — verify mockPush called
- Test 10: `does not render badge when contentStatus is 'none'`

**Acceptance criteria**:
- [ ] "Soon" badge renders on top-right of course card
- [ ] Clicking "Soon" course shows toast message, does NOT navigate
- [ ] "Soon" course button is visually disabled
- [ ] "Just Added" badge renders with pulse animation
- [ ] "Just Added" course navigates normally
- [ ] No badge for 'none'/null status
- [ ] Badge does not overlap course title (positioned in top-right corner)

**Run**: `pnpm vitest run tests/unit/components/CourseCard.test.tsx`

---

## Step 6: Integrate Badge and Locked Logic into CourseLessonCard

**Spec refs**: FR-005, Acceptance Criteria 2, Design Guidelines 3.1

**Files to touch**:
- `src/app/(frontend)/courses/[courseSlug]/_components/CourseLessonCard/index.tsx` (MODIFIED — lines 1-89)

**Exact behavior**:
1. Import `ContentStatusBadge` from `@/ui/web/shared/ContentStatusBadge`
2. Import `toast` from `sonner`
3. Add `ContentStatusBadge` next to lesson title (inline, after the lesson title `<h3>`)
4. When `lesson.contentStatus === 'soon'`:
   - Replace `<SystemLink>` with a `<div>` (or intercept click) to prevent navigation
   - Show toast with `tc('contentLocked')` message on click
   - Apply `opacity-60 cursor-not-allowed` styling
5. When `lesson.contentStatus === 'justAdded'` or `'none'`:
   - Render as normal `<SystemLink>` with navigation
   - Show badge if 'justAdded' and not expired

**Tests** (FAIL before, PASS after):
- File: `tests/unit/components/CourseLessonCard.test.tsx` (NEW)
- Test 1: `renders lesson title and basic info` — baseline render test
- Test 2: `renders "Soon" badge for soon status`
- Test 3: `prevents navigation on click when lesson is "Soon"` — verify no SystemLink href or click intercepted
- Test 4: `shows toast when clicking a "Soon" lesson`
- Test 5: `renders "Just Added" badge for justAdded status`
- Test 6: `allows navigation for "Just Added" lesson`
- Test 7: `does not render badge when contentStatus is none/undefined`

**Acceptance criteria**:
- [ ] "Soon" badge displays next to lesson title
- [ ] Clicking "Soon" lesson shows toast, does NOT navigate
- [ ] "Soon" lesson is visually dimmed
- [ ] "Just Added" badge displays with pulse animation next to lesson title
- [ ] "Just Added" lesson navigates normally
- [ ] No badge for 'none'/undefined status

**Run**: `pnpm vitest run tests/unit/components/CourseLessonCard.test.tsx`

---

## Step 7: Final Quality Gates

**Spec refs**: All acceptance criteria

**Files to touch**: None (validation only)

**Exact behavior**:
1. Run type generation: `pnpm generate:types`
2. Run import map generation: `pnpm generate:importmap`
3. Run type check: `pnpm -s tsc --noEmit`
4. Run lint: `pnpm -s lint`
5. Run all unit tests: `pnpm vitest run tests/unit/`
6. Verify no regressions in existing CourseCard tests

**Tests**: All tests from Steps 1-6

**Acceptance criteria**:
- [ ] `pnpm generate:types` succeeds
- [ ] `pnpm -s tsc --noEmit` passes with no errors
- [ ] `pnpm -s lint` passes
- [ ] All unit tests pass
- [ ] No changes to `publishedAndActive` access control (kept intact)

**Run**: `pnpm generate:types && pnpm generate:importmap && pnpm -s tsc --noEmit && pnpm -s lint && pnpm vitest run tests/unit/`
