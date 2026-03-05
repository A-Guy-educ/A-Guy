# Plan: Improve Login Page UI Design Consistency

**Task ID**: 260304-auto-22
**Task Type**: implement_feature
**Branch**: feat/260304-auto-22-login-page-redesign

---

## Summary

Redesign the login page to match the design specification: full-page light background, centered content with headline/subtitle above a wider card, decorative line, Google-only login, signup CTA, and footer help text. This is a frontend-only UI change touching 2 existing files (LoginPageContent.tsx, LoginForm.tsx) and 2 translation files (en.json, he.json).

## Assumptions

- The login page uses RTL layout inherited from the app's global layout (no explicit RTL needed in component)
- The `HelpCircle` icon from `lucide-react` is available (lucide-react is already a project dependency)
- The design specifies Google-only login visible by default; the email/password form remains gated behind `passwordEnabled` flag (preserving existing behavior)
- The `/signup` route already exists and is the target for the signup CTA
- New i18n keys will be added to both `en.json` and `he.json`
- The `SystemLink` component from `@/infra/loading/components/SystemLink` is the project's standard link component
- The skeleton loader in LoginForm should be updated to match the new card design

## Test Strategy

Since this is a purely visual/UI task with no business logic changes, the primary tests are:
1. **Snapshot/render tests** to verify the component renders without errors and contains expected elements
2. **TypeScript compilation** (`pnpm -s tsc --noEmit`) to verify type safety
3. **Lint/format checks** (`pnpm -s lint && pnpm -s format`) to verify code quality

---

### Step 1: Add new i18n translation keys for login page redesign

**Files to Touch**:
- `src/i18n/he.json` (MODIFIED - auth.login section, ~lines 71-86)
- `src/i18n/en.json` (MODIFIED - auth.login section, ~lines 48-63)

**Exact Behavior**:
Add the following new translation keys under `auth.login`:
- `headline`: HE: "שלום, מוכנים להצליח?" / EN: "Hello, ready to succeed?"
- `headlineSubtitle`: HE: "A-Guy המורה הפרטי שלכם" / EN: "A-Guy — your personal tutor"
- `quickEntry`: HE: "כניסה מהירה" / EN: "Quick Entry"
- `signupCTA`: HE: "הרשמה ללא עלות" / EN: "Free Registration"
- `footerSecure`: HE: "גישה מהירה ומאובטחת." / EN: "Fast and secure access."
- `footerOneClick`: HE: "בלחיצה אחת אתם בפנים." / EN: "One click and you're in."
- `needHelp`: HE: "זקוקים לעזרה?" / EN: "Need help?"

**Tests that FAIL before, PASS after**:

1. **Test**: `tests/unit/i18n/login-keys.test.ts` (NEW)
   - Description: Verify both `en.json` and `he.json` contain all required login page keys
   - Test reads both JSON files and asserts that `auth.login.headline`, `auth.login.headlineSubtitle`, `auth.login.quickEntry`, `auth.login.signupCTA`, `auth.login.footerSecure`, `auth.login.footerOneClick`, and `auth.login.needHelp` exist and are non-empty strings
   - FAILS before: Keys don't exist yet
   - PASSES after: Keys are added

**Acceptance Criteria**:
- [ ] `he.json` has all 7 new keys under `auth.login`
- [ ] `en.json` has all 7 new keys under `auth.login`
- [ ] Existing keys are NOT modified or removed
- [ ] JSON files are valid (parseable)

---

### Step 2: Redesign LoginPageContent with full-page background and header section

**Files to Touch**:
- `src/app/(frontend)/login/LoginPageContent.tsx` (MODIFIED - lines 1-19, complete rewrite)

**Exact Behavior**:

Replace the current layout with a new full-page centered layout:

1. **Full-page wrapper**: `min-h-screen bg-muted flex flex-col items-center justify-center px-4 py-16`
2. **Header section** (above card):
   - `<h1>` with `text-4xl font-bold text-foreground text-center mb-2` containing `t('headline')` (שלום, מוכנים להצליח?)
   - `<p>` with `text-base text-muted-foreground text-center mb-10` containing `t('headlineSubtitle')` (A-Guy המורה הפרטי שלכם)
3. **LoginForm component** placed after header
4. **Page footer section** (below card):
   - `<div>` with `mt-8 text-center`
   - A `SystemLink` to `/help` (or `#` as placeholder) with `text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1`
   - Contains HelpCircle icon (size 16) and `t('needHelp')` text

**Import changes**:
- Add: `import { HelpCircle } from 'lucide-react'`
- Add: `import { SystemLink } from '@/infra/loading/components/SystemLink'`

**Tests that FAIL before, PASS after**:

1. **Test**: `tests/unit/app/login/LoginPageContent.test.tsx` (NEW)
   - Description: Render `LoginPageContent` (wrapped with I18nProvider and mock router) and verify:
     - The container has `bg-muted` class for full-page background
     - An `h1` element exists (the headline)
     - The help link exists at bottom of page
   - FAILS before: No `bg-muted` background, no h1, no help link
   - PASSES after: All elements present

**Acceptance Criteria**:
- [ ] Full-page `bg-muted` background applied
- [ ] Headline text rendered as `<h1>` with `text-4xl font-bold`
- [ ] Subtitle rendered below headline
- [ ] LoginForm rendered between header and footer
- [ ] Help link with icon rendered at page bottom
- [ ] TypeScript compiles: `pnpm -s tsc --noEmit`

---

### Step 3: Redesign LoginForm card with wider layout, decorative line, and new sections

**Files to Touch**:
- `src/app/(frontend)/login/LoginForm.tsx` (MODIFIED - lines 1-126, significant rewrite of JSX)

**Exact Behavior**:

Redesign the `LoginFormContent` component's Card:

1. **Card wrapper**: Add className overrides: `max-w-md w-full mx-auto rounded-xl shadow-lg`
   - Currently `max-w-sm` is applied at parent level; move width control to Card itself
   - Uses `shadow-lg` for prominent shadow (or `shadow-elevation-3` design token)
   - Uses `rounded-xl` for rounded corners

2. **CardHeader** changes:
   - Increase padding: `p-8 pb-0` or `p-10 pb-0`
   - Add decorative horizontal line: `<div className="w-12 h-0.5 bg-accent mx-auto mb-4" />` — small centered line in accent color
   - Replace subtitle with section label: `<p className="text-base font-medium text-foreground text-center">{t('quickEntry')}</p>` ("כניסה מהירה")

3. **CardContent** changes:
   - Increase padding: `p-8 pt-4` or `p-10 pt-4`
   - Google button: Already full-width, keep as-is with `w-full` class
   - **Divider**: Keep existing visual separator between Google button and signup (the `h-px bg-border` pattern)
   - **Signup CTA button**: Add new `Button` (variant `secondary` or `outline`) as `SystemLink` wrapping:
     ```
     <Button variant="secondary" className="w-full" asChild>
       <SystemLink href="/signup">{t('signupCTA')}</SystemLink>
     </Button>
     ```
     This shows "הרשמה ללא עלות" (Free Registration)
   - **Footer text** inside card: Two lines of small muted text centered:
     - `<p className="text-xs text-muted-foreground text-center">{t('footerSecure')}</p>`
     - `<p className="text-xs text-muted-foreground text-center">{t('footerOneClick')}</p>`

4. **Password section** (when `passwordEnabled`):
   - Keep existing email/password form and divider, but it appears AFTER the signup CTA
   - The card footer text still shows below everything

5. **Non-password section** (when `!passwordEnabled`):
   - Remove the old `googleOnlyMessage` paragraph
   - The new design elements (signup CTA + footer text) replace it

6. **LoginFormSkeleton** update:
   - Update skeleton to match new card dimensions: `max-w-md w-full mx-auto rounded-xl shadow-lg`
   - Update skeleton internal spacing to match

**Import changes**:
- Add: `import { SystemLink } from '@/infra/loading/components/SystemLink'` (already imported, keep it)

**Tests that FAIL before, PASS after**:

1. **Test**: `tests/unit/app/login/LoginForm.test.tsx` (NEW)
   - Description: Render `LoginForm` with mocked providers and verify:
     - Card has `max-w-md` class (wider card)
     - Card has `shadow-lg` class (prominent shadow)
     - Card has `rounded-xl` class
     - A decorative line element exists (element with `bg-accent` and `w-12` or similar)
     - "כניסה מהירה" / "Quick Entry" section label appears
     - Signup CTA button/link exists pointing to `/signup`
     - Footer text with "Fast and secure" message appears
   - FAILS before: Card is default width, no decorative line, no section label, no signup CTA, no footer text
   - PASSES after: All design elements present

2. **Test**: `tests/unit/app/login/LoginForm.test.tsx` (continued)
   - Description: Verify interactive states
     - Google button renders and is clickable
     - Signup CTA link points to `/signup`
   - FAILS before: Signup CTA doesn't exist
   - PASSES after: Signup CTA renders with correct href

**Acceptance Criteria**:
- [ ] Card width is `max-w-md` (wider than previous `max-w-sm`)
- [ ] Card has `shadow-lg` prominent shadow
- [ ] Card has `rounded-xl` rounded corners
- [ ] Card has generous padding (`p-8` or `p-10`)
- [ ] Decorative horizontal line appears above "כניסה מהירה" text
- [ ] "כניסה מהירה" / "Quick Entry" section label centered
- [ ] Google Sign-In button is full-width
- [ ] Signup CTA button appears below Google button
- [ ] Footer text ("Fast and secure access" + "One click") appears in card
- [ ] Email/password form still works when `passwordEnabled` is true
- [ ] Skeleton loader updated to match new card dimensions
- [ ] All interactive states (hover, focus, disabled) use design system tokens
- [ ] TypeScript compiles: `pnpm -s tsc --noEmit`
- [ ] Lint passes: `pnpm -s lint`
- [ ] Format passes: `pnpm -s format`

---

### Step 4: Verify responsive behavior and quality gates

**Files to Touch**:
- No new file changes — this is a verification step

**Exact Behavior**:
Run all quality gates to ensure nothing is broken:

1. `pnpm -s tsc --noEmit` — TypeScript compilation
2. `pnpm -s lint` — ESLint check
3. `pnpm -s format` — Prettier format check
4. Run the tests created in steps 1-3

**Tests**:
- All tests from steps 1-3 should pass
- No existing tests should break (this is a UI-only change with no API modifications)

**Acceptance Criteria**:
- [ ] TypeScript compiles without errors
- [ ] Lint passes without errors
- [ ] Format check passes
- [ ] All new unit tests pass
- [ ] No existing tests regress
- [ ] Layout renders correctly (verified by render tests)

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `src/i18n/en.json` | MODIFIED | Add 7 new `auth.login.*` translation keys |
| `src/i18n/he.json` | MODIFIED | Add 7 new `auth.login.*` translation keys |
| `src/app/(frontend)/login/LoginPageContent.tsx` | MODIFIED | Full-page bg, header with headline/subtitle, footer help link |
| `src/app/(frontend)/login/LoginForm.tsx` | MODIFIED | Wider card, decorative line, section label, signup CTA, footer text, skeleton update |
| `tests/unit/i18n/login-keys.test.ts` | NEW | Translation key existence test |
| `tests/unit/app/login/LoginPageContent.test.tsx` | NEW | LoginPageContent render test |
| `tests/unit/app/login/LoginForm.test.tsx` | NEW | LoginForm render and interaction tests |

## Design System Tokens Used

- **Background**: `bg-muted` (full page), `bg-card` (card default)
- **Text**: `text-foreground`, `text-muted-foreground`
- **Spacing**: `p-8`/`p-10`, `py-16`, `mb-2`, `mb-10`, `mt-8`, `space-y-4`
- **Typography**: `text-4xl font-bold`, `text-base`, `text-sm`, `text-xs`
- **Shadow**: `shadow-lg` (or `shadow-elevation-3`)
- **Border radius**: `rounded-xl`
- **Accent**: `bg-accent` (decorative line)
- **Button variants**: `secondary` (signup CTA), `outline` (Google button)
- **Interactive states**: Inherit from Button/SystemLink components (already use design tokens)

## Notes for Build Agent

- The `LoginPageContent.tsx` currently applies `max-w-sm` as a parent wrapper. In the redesign, remove `max-w-sm` from the parent and let the Card in `LoginForm.tsx` control its own width with `max-w-md`.
- The `LoginPageContent.tsx` wrapper should be `min-h-screen` to fill the viewport with the background color.
- Import `HelpCircle` from `lucide-react` for the help link icon.
- The decorative line is a simple `<div>` with fixed width (`w-12`), small height (`h-0.5`), accent background (`bg-accent`), and centered (`mx-auto`).
- Keep existing `Suspense` boundary and skeleton pattern in `LoginForm.tsx`.
- The signup CTA uses `Button` with `asChild` prop wrapping a `SystemLink` — this is the established pattern in the project (see SignupForm.tsx for reference).
- For tests, mock the `I18nProvider` with English translations and mock `next/navigation` (useSearchParams). The `PasswordLoginProvider` context should be mocked to return `false` (Google-only mode) for the primary test case, and `true` for verifying password form still works.
