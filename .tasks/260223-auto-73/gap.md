# Gap Analysis: 260223-auto-73

## Summary

- Gaps Found: 1
- Spec Revised: Yes

## Gaps Found

### Gap 1: Hardcoded Hebrew Loading Text in HomePage Component

**Severity:** High
**Location:** `src/app/(frontend)/_components/HomePage/index.tsx`, line 26
**Issue:** The HomePage component displays hardcoded Hebrew text `"טוען..."` instead of using the existing translation mechanism. This causes the loading text to always show in Hebrew regardless of the active locale.

**Current Code:**
```tsx
if (isLoading) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-muted-foreground">טוען...</div>
    </div>
  )
}
```

**Fix Applied:** The spec already correctly describes the solution (using `useTranslations` hook). However, the spec should explicitly reference this specific component location to make the fix clearer.

## Changes Made to Spec

- **Added Specific Location Reference**: Updated the spec to reference the specific component (`HomePage`) where the hardcoded loading text exists, making the fix more actionable.

- **Added FR-003**: Explicitly state that the HomePage component must use `useTranslations('homepage.greeting')` to get the loading text.

- **Updated Acceptance Criteria**: Added explicit mention that the fix applies to `src/app/(frontend)/_components/HomePage/index.tsx` line 26.

## No Additional Gaps Found

The spec correctly addresses:

1. ✅ **FR-001**: Resolve Loading Text Using Existing Translation Mechanism - The solution uses `useTranslations` hook
2. ✅ **FR-002**: Align Loading Text with Active Locale - The translation keys exist in both languages
3. ✅ **NFR-001**: No New Locale Detection Logic - No new detection added, uses existing infrastructure
4. ✅ **NFR-002**: Maintain Existing Architecture - No routing/middleware changes

### Verification Against Codebase

- **Translation Keys Exist**: 
  - `src/i18n/en.json` line 249: `"loading": "Loading..."` under `homepage.greeting`
  - `src/i18n/he.json` line 249: `"loading": "טוען..."` under `homepage.greeting`

- **I18n Infrastructure Works**: 
  - `I18nProvider` wraps entire app in `src/app/(frontend)/layout.tsx`
  - `useTranslations` hook available from `@/ui/web/providers/I18n`
  - Other components correctly use translations (e.g., `StudyContent` uses `t('loading')`)

- **No Missing Dependencies**: 
  - No new packages needed
  - No new locale detection required
  - Existing translation mechanism is sufficient

### Note on Spinner Component

The Spinner component at `src/ui/web/shared/Loading/Spinner.tsx` has a default `aria-label = 'Loading'`, but this is already designed to accept an override via props. This is not a gap because:
- The prop can be passed from parent components
- It's primarily for screen reader accessibility
- The component itself is correctly designed
