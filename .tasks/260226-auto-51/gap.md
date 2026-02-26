# Gap Analysis: 260226-auto-51

## Summary

- Gaps Found: 4
- Spec Revised: Yes

## Gaps Found

### Gap 1: Missing Internationalization (i18n) Integration

**Severity:** High
**Location:** `src/app/(frontend)/error.tsx`
**Issue:** The spec used hardcoded English strings ("Something went wrong", "Try again") but the project uses `next-intl` for all user-facing text with both English and Hebrew translations. This is a major pattern violation.
**Fix Applied:** Added NFR-1 (Internationalization Support) requiring:
- Translation keys `common.error.title` and `common.error.retryButton`
- Hebrew translations in he.json
- Use of `useTranslations` hook in error.tsx

### Gap 2: Inconsistent UI Component Usage

**Severity:** Medium
**Location:** `src/app/(frontend)/error.tsx`
**Issue:** The spec used a raw HTML `<button>` element without styling. The project has shadcn/ui Button component at `src/ui/web/components/button.tsx` which should be used for consistency.
**Fix Applied:** Added NFR-3 (Design System Compliance) requiring use of the Button component with proper import path.

### Gap 3: Missing Accessibility Attributes

**Severity:** Medium
**Location:** `src/app/(frontend)/error.tsx`
**Issue:** Error boundaries should include proper ARIA attributes for screen readers. The spec didn't include `role="alert"` or `aria-live="polite"`.
**Fix Applied:** Added NFR-2 (Accessibility) and updated error.tsx implementation to include these attributes.

### Gap 4: Existing RouteLoadingIndicator Not Documented

**Severity:** Low
**Location:** Frontend route architecture
**Issue:** The spec didn't mention the existing `RouteLoadingIndicator` component in the layout which provides a top progress bar during navigation. While `loading.tsx` still adds value (as a Suspense fallback), implementers should be aware this exists.
**Fix Applied:** Added "Global Context" section in Implementation Details explaining how the existing loading indicator works with the new loading.tsx.

## Changes Made to Spec

- Added NFR-1: Internationalization Support - requiring i18n translations and useTranslations hook
- Added NFR-2: Accessibility - requiring role="alert" and aria-live="polite" attributes
- Added NFR-3: Design System Compliance - requiring use of shadcn/ui Button component
- Updated error.tsx implementation to include proper imports, i18n usage, and accessibility attributes
- Added i18n translation snippets for both en.json and he.json
- Added Global Context section documenting existing RouteLoadingIndicator

## Validation Notes

- Verified Button component exists at `src/ui/web/components/button.tsx`
- Verified project uses Tailwind CSS with `animate-spin` utility (default Tailwind)
- Verified i18n files exist at `src/i18n/en.json` and `src/i18n/he.json`
- Verified project uses `next-intl` with `useTranslations` hook
- Verified the lesson page directory exists at expected path
