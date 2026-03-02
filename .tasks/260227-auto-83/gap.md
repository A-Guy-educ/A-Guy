# Gap Analysis: 260227-auto-83

## Summary

- Gaps Found: 3
- Spec Revised: Yes

## Gaps Found

### Gap 1: Guest Visibility Contradiction

**Severity:** High
**Location:** spec.md - Visibility section
**Issue:** The spec states:
- "Visible to logged-in users"
- "Visible to guest users"

However, the Account page (`/account`) requires authentication. Looking at `src/app/(frontend)/account/page.tsx` (lines 12-16), unauthenticated users are redirected to `/login`:

```typescript
const { user } = await getMeUser()
if (!user) {
  redirect('/login')
}
```

This means the Preferences section (and therefore the button) is only accessible to authenticated users - guests cannot see it.

**Fix Applied:** Updated spec to clarify that the button is only visible to authenticated users, since the Account page requires authentication.

### Gap 2: Missing Translation Keys

**Severity:** High
**Location:** i18n files (src/i18n/en.json, src/i18n/he.json)
**Issue:** The spec provides button labels:
- Hebrew: `הכנת תוכנית לימודים לקראת מבחן`
- English: `Build exam study plan`

But these translation keys are NOT present in the i18n files under `auth.account`. The current `auth.account` section only has `preferencesPlaceholder`.

**Fix Applied:** Added to the spec's Requirements section:
- Translation key `buildExamStudyPlan` must be added to both `src/i18n/en.json` and `src/i18n/he.json` under `auth.account`

### Gap 3: Navigation Implementation Pattern

**Severity:** Medium
**Location:** spec.md - Behavior section
**Issue:** The spec says "standard router push behavior" but doesn't specify the implementation. Looking at the existing codebase:
- `SelectedCourseCard.tsx` (lines 123-125) uses `<Link>` component for navigation
- Other components use `useRouter().push()` for programmatic navigation

The `<Link>` component is preferred in this codebase for navigation within the same application.

**Fix Applied:** Updated spec's Behavior section to specify using `<Link>` component from `next/link` as the navigation method, which is consistent with existing patterns in the codebase.

## Changes Made to Spec

### Updated Visibility Section (Original → Revised)

**Original:**
```
### Visibility
- Visible to logged-in users
- Visible to guest users
- No role restrictions
```

**Revised:**
```
### Visibility
- Visible to authenticated users only (Account page requires login)
- No role restrictions
```

### Added Translation Requirements

Added to Requirements section:
```
### Translations Required
- Add `buildExamStudyPlan` key to `src/i18n/en.json` under `auth.account`:
  - Value: `Build exam study plan`
- Add `buildExamStudyPlan` key to `src/i18n/he.json` under `auth.account`:
  - Value: `הכנת תוכנית לימודים לקראת מבחן`
```

### Updated Behavior Section (Original → Revised)

**Original:**
```
### Behavior
- On click: navigate to `/study-plan`
- Same tab navigation
- Standard router push behavior
```

**Revised:**
```
### Behavior
- Use `<Link>` component from `next/link` to navigate to `/study-plan`
- Same tab navigation (default Link behavior)
- No onClick handler needed - Link handles navigation
```

### Updated Styling Section (Original → Revised)

**Original:**
```
### Styling
- Use existing design system button component
- Secondary prominence (not primary CTA)
- No new styles
- No layout shifts
- Must align correctly in RTL and LTR
```

**Revised:**
```
### Styling
- Use existing design system button component (`@/ui/web/components/button`)
- Use `variant="secondary"` for secondary prominence
- Wrap button with `<Link>` component from `next/link`
- No new styles
- No layout shifts
- Must align correctly in RTL and LTR (Link component handles this)
```

### Updated Acceptance Criteria

Added translation requirement to acceptance criteria:

```
7. Button translations exist in both en.json and he.json under auth.account
```

## Codebase Patterns Verified

The following patterns were verified in the codebase and are correctly aligned with the spec:

1. **Button Component**: Located at `src/ui/web/components/button.tsx` with `variant="secondary"` available
2. **Navigation Pattern**: `<Link>` component is the standard for internal navigation
3. **Accordion Structure**: Preferences section is inside `AccordionItem value="preferences"` - button will only show when expanded
4. **Study Plan Route**: Confirmed exists at `src/app/(frontend)/study-plan/page.tsx`
5. **i18n Structure**: Translations follow `auth.account.*` namespace pattern
