# Plan: Accordion-Based Account Hub

**Task ID**: 260225-auto-21
**Task Type**: implement_feature
**Estimated Total**: 5 steps, ~90 minutes

## Summary

Replace the current flat card layout on `/account` with a Radix/Shadcn Accordion (`type="single"`, `collapsible`). Four sections: Details (default open), Courses, Preferences (placeholder), Teachers Profile (placeholder). Support deep linking via `?section=...` query parameter with shallow URL sync.

## Assumptions

1. **Profile Picture**: The `User` type has no `imageUrl`/`avatar` field. FR-002 says "Profile Picture" — we will show the existing `UserAvatar` component (initials-based fallback) since there is no stored profile image URL. This matches the current approach used in `UserDropdown`.
2. **Accordion component**: Must be added via `npx shadcn@latest add accordion` — `@radix-ui/react-accordion` is NOT currently installed.
3. **shadcn paths**: The `components.json` aliases point to `@/components` but existing shadcn components live at `src/ui/web/components/`. The build agent must either update `components.json` or manually move the generated accordion file to `src/ui/web/components/accordion.tsx` and fix the import of `cn` from `@/infra/utils/ui`.
4. **Translation namespace**: We will extend `auth.account` namespace in both `en.json` and `he.json`.
5. **searchParams**: Per Next.js App Router patterns, `searchParams` is read in the server component (`page.tsx`) and passed as a prop to the client component.

## Recommended Skills

Install before implementation:

- Use the `add-ui-component` skill for Step 1 (adding shadcn accordion).

---

## Step 1: Add Shadcn Accordion Component

**Time**: ~10 minutes

**Files to Touch**:
- `src/ui/web/components/accordion.tsx` (NEW — shadcn generated, then moved/adjusted)
- `package.json` (MODIFIED — `@radix-ui/react-accordion` added as dependency)

**Behavior**:
Install Radix Accordion via shadcn CLI. The generated component wraps `@radix-ui/react-accordion` with Tailwind classes. It must export `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`.

**Important**: After generation, the file must:
1. Import `cn` from `@/infra/utils/ui` (not `@/utilities/ui` or `@/lib/utils`)
2. Live at `src/ui/web/components/accordion.tsx`
3. Use `ChevronDown` from `lucide-react` for the chevron icon

**Tests (1)**:
- **Test**: `tests/unit/components/AccountHub.test.tsx` — basic smoke test: import the accordion component and verify it exports `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` (this test is written in Step 3 together with the hub component — this step has no standalone test).

**Acceptance Criteria**:
- [ ] `@radix-ui/react-accordion` is in `package.json` dependencies
- [ ] `src/ui/web/components/accordion.tsx` exists and exports 4 components
- [ ] `cn` is imported from `@/infra/utils/ui`
- [ ] `pnpm tsc --noEmit` passes

---

## Step 2: Add i18n Translation Keys

**Time**: ~10 minutes

**Files to Touch**:
- `src/i18n/en.json` (MODIFIED — lines 64-74, extend `auth.account` section)
- `src/i18n/he.json` (MODIFIED — lines 87-97, extend `auth.account` section)

**Behavior**:
Add new translation keys under `auth.account`:

```json
{
  "auth": {
    "account": {
      "title": "Account",
      "name": "Name",
      "email": "Email",
      "missing": "Not provided",
      "selectedCourse": "Selected Course",
      "noCourseSelected": "No course selected",
      "selectCourse": "Select a Course",
      "removeCourseSelection": "Remove Selection",
      "loadingCourse": "Loading...",
      "sectionDetails": "Details",
      "sectionCourses": "Courses",
      "sectionPreferences": "Preferences",
      "sectionTeachersProfile": "Teachers Profile",
      "expand": "Expand",
      "collapse": "Collapse",
      "preferencesPlaceholder": "Preferences settings will be available soon.",
      "teachersProfilePlaceholder": "Teachers profile features coming soon.",
      "failedToLoadCourse": "Failed to load course",
      "tryAgain": "Try Again"
    }
  }
}
```

Hebrew translations:
```json
{
  "auth": {
    "account": {
      "sectionDetails": "פרטים",
      "sectionCourses": "קורסים",
      "sectionPreferences": "העדפות",
      "sectionTeachersProfile": "פרופיל מורה",
      "expand": "הרחב",
      "collapse": "כווץ",
      "preferencesPlaceholder": "הגדרות ההעדפות יהיו זמינות בקרוב.",
      "teachersProfilePlaceholder": "תכונות פרופיל המורה בקרוב.",
      "failedToLoadCourse": "טעינת הקורס נכשלה",
      "tryAgain": "נסה שוב"
    }
  }
}
```

**Tests (1)**:
- **Test location**: `tests/unit/components/AccountHub.test.tsx`
- Test: Render the AccountHub with I18nProvider and verify section titles render using translation keys (e.g., "Details", "Courses", "Preferences", "Teachers Profile" for English). This test is written as part of Step 3.

**Acceptance Criteria**:
- [ ] All new keys exist in `en.json` under `auth.account`
- [ ] All new keys exist in `he.json` under `auth.account`
- [ ] No hardcoded strings remain in account components after Step 3
- [ ] Existing keys (`title`, `name`, `email`, etc.) are preserved unchanged

---

## Step 3: Create AccountHub Client Component with Accordion Layout

**Time**: ~30 minutes

**Files to Touch**:
- `src/app/(frontend)/account/_components/AccountHub.tsx` (NEW — main accordion client component)
- `src/app/(frontend)/account/_components/DetailsSection.tsx` (NEW — details section content)
- `src/app/(frontend)/account/_components/PreferencesSection.tsx` (NEW — placeholder)
- `src/app/(frontend)/account/_components/TeachersProfileSection.tsx` (NEW — placeholder)
- `tests/unit/components/AccountHub.test.tsx` (NEW — unit tests)

**Behavior**:

### AccountHub.tsx (Client Component)
- **Props**: `{ user: User; initialSection?: string }`
- Uses `Accordion` with `type="single"` and `collapsible` prop
- Valid section values: `details`, `courses`, `preferences`, `teachers-profile`
- Default value: `initialSection` if valid, otherwise `"details"` (FR-007 fallback)
- Four `AccordionItem` elements, each with `AccordionTrigger` containing section title (from i18n) + chevron
- On value change (`onValueChange`), shallow-update URL: `window.history.replaceState(null, '', ?section=<value>)` or remove param if collapsed (FR-007)
- Uses `useTranslations('auth.account')` for all text
- Section content:
  - `details` → `<DetailsSection user={user} />`
  - `courses` → `<SelectedCourseCard />`  (reuse existing component)
  - `preferences` → `<PreferencesSection />`
  - `teachers-profile` → `<TeachersProfileSection />`

### DetailsSection.tsx
- Shows `UserAvatar` (size `"md"`), Name, Email
- All labels from i18n (`auth.account.name`, `auth.account.email`, `auth.account.profilePicture`)
- Missing name fallback: `t('missing')`

### PreferencesSection.tsx
- Shows placeholder text from i18n: `t('preferencesPlaceholder')`

### TeachersProfileSection.tsx
- Shows placeholder text from i18n: `t('teachersProfilePlaceholder')`

### Chevron + RTL
- The Shadcn AccordionTrigger includes a `ChevronDown` icon. To meet NFR-004, a custom approach is needed for chevron rotation:
  - The `ChevronDown` icon will need to be wrapped in a component that applies conditional rotation based on the current locale (LTR/RTL).
  - For LTR, on expand, the chevron should rotate to point right.
  - For RTL, on expand, the chevron should rotate to point left.
  - This will involve using `document.dir` or `useLocale()` to determine the direction and applying appropriate CSS transforms.
- All layout uses logical properties: `ps-4`, `pe-4`, `me-2`, `ms-2`, `justify-between` etc. per NFR-001.

**Tests (4)** — `tests/unit/components/AccountHub.test.tsx`:

1. **"renders all four accordion sections"**: Render `<AccountHub user={mockUser} />` wrapped in `I18nProvider`. Assert that the text "Details", "Courses", "Preferences", "Teachers Profile" are all present in the DOM.
   - FAILS before: Component doesn't exist
   - PASSES after: Component renders 4 AccordionItems

2. **"Details section is open by default"**: Render with no `initialSection`. Assert Details content is visible (user name, email displayed). Assert Courses content is NOT visible.
   - FAILS before: No accordion
   - PASSES after: Default value is `"details"`

3. **"opens section from initialSection prop"**: Render with `initialSection="courses"`. Assert Courses section content is visible (SelectedCourseCard renders). Assert Details content is NOT visible.
   - FAILS before: No prop support
   - PASSES after: Accordion value set from prop

4. **"falls back to Details for invalid initialSection"**: Render with `initialSection="invalid-section"`. Assert Details content is visible.
   - FAILS before: No validation
   - PASSES after: Validation logic rejects invalid section, defaults to `"details"`

**Acceptance Criteria**:
- [ ] Accordion renders with `type="single"` and `collapsible`
- [ ] Only one section open at a time (FR-001)
- [ ] Details section shows Name, Email, Avatar (FR-002)
- [ ] Courses section reuses `SelectedCourseCard` (FR-003)
- [ ] Preferences shows placeholder text (FR-004)
- [ ] Teachers Profile shows placeholder text (FR-005)
- [ ] Section titles and chevrons render correctly (FR-006)
- [ ] All text comes from i18n (NFR-003)
- [ ] Layout uses logical CSS properties for RTL (NFR-001)
- [ ] All 4 tests pass

---

## Step 4: Wire Up Server Page with Deep Linking (searchParams)

**Time**: ~15 minutes

**Files to Touch**:
- `src/app/(frontend)/account/page.tsx` (MODIFIED — lines 1-15)
- `src/app/(frontend)/account/AccountPageContent.tsx` (MODIFIED — complete rewrite to use AccountHub)

**Behavior**:

### page.tsx Changes
- Read `searchParams` (Next.js App Router server component pattern): `searchParams` is a Promise in Next.js 15 app router, so use `const resolvedParams = await searchParams`
- Extract `section` string from search params
- Pass `section` to `<AccountPageContent user={user} initialSection={section} />`

```typescript
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>
}) {
  const { user } = await getMeUser()
  if (!user) redirect('/login')
  
  const params = await searchParams
  return <AccountPageContent user={user} initialSection={params.section} />
}
```

### AccountPageContent.tsx Changes
- Change from rendering Card + SelectedCourseCard directly to rendering `<AccountHub user={user} initialSection={initialSection} />`
- Props: `{ user: User; initialSection?: string }`
- Still a `'use client'` component
- Wrapper with container styling: `<div className="container py-16"><div className="mx-auto max-w-2xl">...</div></div>`
- Note: max-width increased from `max-w-md` to `max-w-2xl` for the accordion layout to have breathing room

### URL Sync (in AccountHub)
- `onValueChange` handler in AccountHub:
  ```typescript
  const handleValueChange = (value: string) => {
    setValue(value)
    const url = new URL(window.location.href)
    if (value) {
      url.searchParams.set('section', value)
    } else {
      url.searchParams.delete('section')
    }
    window.history.replaceState(null, '', url.toString())
  }
  ```

**Tests (2)** — add to `tests/unit/components/AccountHub.test.tsx`:

5. **"updates URL shallowly when section changes"**: Mock `window.history.replaceState`. Render AccountHub. Click on "Courses" trigger. Assert `replaceState` was called with a URL containing `?section=courses`.
   - FAILS before: No URL sync
   - PASSES after: `onValueChange` calls `replaceState`

6. **"removes section param when accordion is collapsed"**: Mock `window.history.replaceState`. Render AccountHub with default (Details open). Click Details trigger to collapse it. Assert `replaceState` was called with URL that does NOT contain `section` param.
   - FAILS before: No URL sync
   - PASSES after: Collapsible closes, param removed

**Acceptance Criteria**:
- [ ] `page.tsx` reads `searchParams.section` and passes to client component
- [ ] `?section=courses` opens Courses section on page load (FR-007)
- [ ] `?section=invalid` falls back to Details (FR-007)
- [ ] Clicking a section shallow-updates URL with `?section=<value>` (FR-007)
- [ ] Collapsing a section removes the `?section` param
- [ ] Layout matches existing spacing/container patterns

---

## Step 5: Verify Type Check, Lint, and Final Integration

**Time**: ~15 minutes

**Files to Touch**:
- No new files — verification step only. May require minor fixups to satisfy `tsc` and `eslint`.

**Behavior**:
Run full quality gates:
1. `pnpm tsc --noEmit` — ensure TypeScript compiles
2. `pnpm lint` — ensure no lint errors
3. `pnpm test:unit -- tests/unit/components/AccountHub.test.tsx` — run the tests
4. Manual spot-check: ensure `SelectedCourseCard` still works inside the accordion (it already has its own test file)

**Tests**:
All 6 tests from Steps 3-4 must pass. Plus existing `SelectedCourseCard.test.tsx` must still pass (regression).

**Acceptance Criteria**:
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes (or `pnpm lint:fix` applied)
- [ ] All 6 AccountHub tests pass
- [ ] Existing SelectedCourseCard tests still pass
- [ ] No hardcoded strings in any account component

---

## File Summary

| File | Status | Relevant Requirements |
|------|--------|-----------------------|
| `src/ui/web/components/accordion.tsx` | NEW | FR-001, FR-006 |
| `src/i18n/en.json` | MODIFIED | NFR-003 |
| `src/i18n/he.json` | MODIFIED | NFR-003 |
| `src/app/(frontend)/account/_components/AccountHub.tsx` | NEW | FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007 |
| `src/app/(frontend)/account/_components/DetailsSection.tsx` | NEW | FR-002 |
| `src/app/(frontend)/account/_components/PreferencesSection.tsx` | NEW | FR-004 |
| `src/app/(frontend)/account/_components/TeachersProfileSection.tsx` | NEW | FR-005 |
| `src/app/(frontend)/account/page.tsx` | MODIFIED | FR-007 |
| `src/app/(frontend)/account/AccountPageContent.tsx` | MODIFIED | FR-001 |
| `tests/unit/components/AccountHub.test.tsx` | NEW | All FRs |

## Test Strategy

All tests are **unit tests** using `vitest` + `@testing-library/react` in jsdom environment, following the exact pattern from `tests/unit/components/SelectedCourseCard.test.tsx`:
- `// @vitest-environment jsdom` pragma
- Mock `next/navigation` (`useRouter`)
- Mock `@/client/state/localStorage/userProfile`
- Mock `@/infra/utils/getURL`
- Wrap all renders in `<I18nProvider locale="en" messages={enMessages}>`
- Import `enMessages` from `../../../src/i18n/en.json`

## RTL Testing Note

NFR-001 requires RTL support verification. The tests verify logical CSS properties are used (e.g., `ps-`, `pe-`, `ms-`, `me-`) by convention. A visual RTL check requires E2E testing (out of scope for this unit test plan). The code must use logical Tailwind properties throughout.
