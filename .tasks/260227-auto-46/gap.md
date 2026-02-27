# Gap Analysis: 260227-auto-46

## Summary

- Gaps Found: 5
- Spec Revised: Yes

## Gaps Found

### Gap 1: Missing i18n Support Requirement

**Severity:** High
**Location:** spec.md - FR-1, FR-2
**Issue:** The spec doesn't mention that loading.tsx and error.tsx should be internationalized. Looking at the codebase, the project supports both English and Hebrew, and other special Next.js files like `not-found.tsx` already use `useTranslations` from `@/ui/web/providers/I18n`.
**Fix Applied:** Added FR-4 to require i18n support with specific translation keys.

### Gap 2: Missing Client Component Directive for error.tsx

**Severity:** High
**Location:** spec.md - FR-2
**Issue:** The error.tsx needs to use `useRouter` for retry functionality, which requires the `'use client'` directive. The spec doesn't mention this Next.js requirement.
**Fix Applied:** Added acceptance criterion specifying client component requirement.

### Gap 3: Missing Design System Component Usage

**Severity:** Medium
**Location:** spec.md - FR-1
**Issue:** The spec says "display a loading spinner" but doesn't specify using the existing `Spinner` component from `@/ui/web/shared/Loading/Spinner.tsx`. The project has an established design system with consistent styling.
**Fix Applied:** Updated FR-1 to reference using the existing design system Spinner component.

### Gap 4: No Clarification on Existing RouteLoadingIndicator

**Severity:** Medium
**Location:** spec.md - Overview
**Issue:** The layout.tsx already includes a `<RouteLoadingIndicator />` component. The spec doesn't clarify whether loading.tsx is supplementary or replaces this behavior.
**Fix Added:** Added clarification that loading.tsx is for SSR navigation transitions, supplementing the existing client-side RouteLoadingIndicator.

### Gap 5: Missing Accessibility Considerations

**Severity:** Medium
**Location:** spec.md - Acceptance Criteria
**Issue:** Loading and error states should include proper ARIA labels for accessibility. The existing `Spinner` component already supports this via the `aria-label` prop.
**Fix Applied:** Updated acceptance criteria to verify proper accessibility attributes.

## Changes Made to Spec

- Added FR-4: Internationalization (i18n) Support - require loading.tsx and error.tsx to use translations
- Updated FR-1: Specify using existing design system `Spinner` component from `@/ui/web/shared/Loading/Spinner.tsx`
- Updated FR-2: Add client component requirement ('use client' directive)
- Added clarification: loading.tsx supplements existing RouteLoadingIndicator in layout
- Updated Acceptance Criteria:
  - Added: loading.tsx uses i18n translations for "Loading..." text
  - Added: error.tsx uses i18n translations for error messages
  - Added: error.tsx is a client component with 'use client' directive
  - Added: Loading spinner has proper ARIA label for accessibility
