# Plan: Build Exam Study Plan CTA in Account Preferences

**Task ID:** 260227-auto-83
**Task Type:** implement_feature
**Spec Reference:** spec.md

---

## Summary

Add a "Build Exam Study Plan" CTA button inside the Preferences section of the Account page that navigates users to `/study-plan`. This involves:
1. Adding translation keys to both locale files
2. Updating the `PreferencesSection` component to include a Link-wrapped Button
3. Writing tests that verify the button renders with correct text and links to `/study-plan`

**Estimated Total Time:** ~20 minutes (2 steps)

---

## Assumptions

- The `/study-plan` route does not need to exist for this task; we only add the CTA that links to it.
- The `PreferencesSection` mock in existing `AccountHub.test.tsx` means that test file does NOT need changes — the new button is tested in a dedicated `PreferencesSection.test.tsx`.
- `next/link` is already available (Next.js project).
- The Button component's `asChild` prop is used to render a `<Link>` as the button element (Radix Slot pattern).

---

## Step 1: Add translation keys to both locale files

**Time:** ~5 minutes

### Files to Touch

| File | Action | Lines |
|------|--------|-------|
| `src/i18n/en.json` | MODIFIED | ~line 80 (inside `auth.account` object, after `preferencesPlaceholder`) |
| `src/i18n/he.json` | MODIFIED | ~line 103 (inside `auth.account` object, after `preferencesPlaceholder`) |

### Exact Behavior

Add the key `buildExamStudyPlan` to the `auth.account` namespace in both files:

- **en.json**: `"buildExamStudyPlan": "Build exam study plan"`
- **he.json**: `"buildExamStudyPlan": "הכנת תוכנית לימודים לקראת מבחן"`

Place each key right after the existing `preferencesPlaceholder` key for logical grouping.

### Tests (FAIL before, PASS after)

**Test file:** `tests/unit/components/PreferencesSection.test.tsx` (NEW)

```
Test 1: "should render the 'Build exam study plan' CTA button with correct English text"
- Renders PreferencesSection wrapped in I18nProvider with locale="en" and en.json messages
- Asserts screen.getByRole('link', { name: 'Build exam study plan' }) exists
- WHY IT FAILS BEFORE: translation key does not exist yet, so t('buildExamStudyPlan') returns the raw key or empty
```

```
Test 2: "should render the Hebrew label when locale is he"
- Renders PreferencesSection wrapped in I18nProvider with locale="he" and he.json messages
- Asserts screen.getByRole('link', { name: 'הכנת תוכנית לימודים לקראת מבחן' }) exists
- WHY IT FAILS BEFORE: translation key does not exist in he.json
```

### Acceptance Criteria

- [ ] `en.json` has `auth.account.buildExamStudyPlan` = `"Build exam study plan"`
- [ ] `he.json` has `auth.account.buildExamStudyPlan` = `"הכנת תוכנית לימודים לקראת מבחן"`
- [ ] No other keys modified or removed
- [ ] JSON files remain valid (parseable)

---

## Step 2: Add CTA button to PreferencesSection component

**Time:** ~15 minutes

### Files to Touch

| File | Action | Lines |
|------|--------|-------|
| `src/app/(frontend)/account/_components/PreferencesSection.tsx` | MODIFIED | All (small file, 13 lines) |
| `tests/unit/components/PreferencesSection.test.tsx` | NEW | ~80 lines |

### Exact Behavior

Modify `PreferencesSection.tsx` to:

1. Import `Link` from `next/link`
2. Import `Button` from `@/ui/web/components/button`
3. Keep existing `useTranslations('auth.account')` hook
4. Keep existing placeholder `<p>` tag
5. Add below the placeholder: a `<Button asChild variant="secondary">` wrapping a `<Link href="/study-plan">` with text `{t('buildExamStudyPlan')}`

The resulting JSX structure:

```tsx
<div className="py-4">
  <p className="text-muted-foreground">{t('preferencesPlaceholder')}</p>
  <div className="mt-4">
    <Button asChild variant="secondary">
      <Link href="/study-plan">{t('buildExamStudyPlan')}</Link>
    </Button>
  </div>
</div>
```

Key details:
- Uses `asChild` prop on Button so that `<Link>` becomes the rendered element (Radix Slot pattern from the existing Button component). This means the link gets button styling and the rendered HTML is an `<a>` tag with button classes.
- `variant="secondary"` per spec requirement for secondary prominence.
- Wrapping `<div className="mt-4">` provides spacing without layout shifts.
- No `onClick` handler needed — Link handles navigation.
- RTL/LTR alignment is handled automatically by Tailwind + existing layout.

### Tests (FAIL before, PASS after)

**Test file:** `tests/unit/components/PreferencesSection.test.tsx` (NEW)

```
Test 1: "should render the study plan CTA button with correct English text"
- Renders PreferencesSection with I18nProvider (locale="en", messages=enMessages)
- Asserts: screen.getByRole('link', { name: 'Build exam study plan' }) is in the document
- WHY IT FAILS BEFORE: PreferencesSection doesn't have a Link element yet

Test 2: "should link to /study-plan"
- Renders PreferencesSection with I18nProvider (locale="en", messages=enMessages)
- Gets the link element via getByRole('link', { name: 'Build exam study plan' })
- Asserts: link.getAttribute('href') === '/study-plan'
- WHY IT FAILS BEFORE: No link element exists in PreferencesSection

Test 3: "should render the Hebrew label when locale is he"
- Renders PreferencesSection with I18nProvider (locale="he", messages=heMessages)
- Asserts: screen.getByRole('link', { name: 'הכנת תוכנית לימודים לקראת מבחן' }) exists
- WHY IT FAILS BEFORE: No link element exists and no Hebrew translation key

Test 4: "should still display the preferences placeholder text"
- Renders PreferencesSection with I18nProvider (locale="en", messages=enMessages)
- Asserts: screen.getByText('Preferences settings will be available soon.') exists
- WHY IT FAILS BEFORE: This test should PASS before and after (regression guard)

Test 5: "should render button with secondary variant styling"
- Renders PreferencesSection with I18nProvider (locale="en", messages=enMessages)
- Gets the link element and checks it has classes containing 'bg-secondary'
- WHY IT FAILS BEFORE: No button/link element exists
```

### Test Setup Notes

The test file needs:
- `// @vitest-environment jsdom` at top
- Mock `next/link` as a simple `<a>` component (standard pattern): `vi.mock('next/link', () => ({ default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a> }))`
- Import `I18nProvider` from `@/ui/web/providers/I18n`
- Import both `en.json` and `he.json` for locale tests
- No need to mock the Button component — it should render normally

### Acceptance Criteria

- [ ] Button appears inside the Preferences accordion content (spec req 1)
- [ ] English label is "Build exam study plan" (spec req 2)
- [ ] Hebrew label is "הכנת תוכנית לימודים לקראת מבחן" (spec req 2)
- [ ] Clicking navigates to `/study-plan` via `<Link>` (spec req 3)
- [ ] Uses `variant="secondary"` Button styling (spec styling req)
- [ ] Uses `asChild` + `<Link>` pattern (not button with onClick)
- [ ] Existing placeholder text still renders (spec: no regression)
- [ ] No changes to AccountHub.tsx or other accordion items (spec: no regression)
- [ ] No new dependencies added
- [ ] `pnpm -s tsc --noEmit` passes
- [ ] `pnpm -s lint` passes
- [ ] All tests in `tests/unit/components/PreferencesSection.test.tsx` pass
- [ ] All existing tests in `tests/unit/components/AccountHub.test.tsx` still pass

---

## Files Changed Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/i18n/en.json` | MODIFIED | Add `buildExamStudyPlan` English translation |
| `src/i18n/he.json` | MODIFIED | Add `buildExamStudyPlan` Hebrew translation |
| `src/app/(frontend)/account/_components/PreferencesSection.tsx` | MODIFIED | Add Link+Button CTA |
| `tests/unit/components/PreferencesSection.test.tsx` | NEW | Test CTA rendering, link href, locale labels |

---

## Verification Commands

```bash
# Type check
pnpm -s tsc --noEmit

# Lint
pnpm -s lint

# Run specific tests
pnpm vitest run tests/unit/components/PreferencesSection.test.tsx

# Run existing AccountHub tests (regression check)
pnpm vitest run tests/unit/components/AccountHub.test.tsx
```
