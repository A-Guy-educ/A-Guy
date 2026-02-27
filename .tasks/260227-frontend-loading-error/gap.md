# Gap Analysis: 260227-frontend-loading-error

## Summary

- Gaps Found: 4
- Spec Revised: Yes

## Gaps Found

### Gap 1: Missing Design System Compliance

**Severity:** High
**Location:** spec.md suggested implementation
**Issue:** The suggested implementation uses basic Tailwind classes that don't follow the project's design system. The codebase has:
- Design tokens in `tailwind.tokens.mjs`
- shadcn/ui Button component
- Consistent styling patterns documented in DESIGN_SYSTEM.md

**Fix Applied:** Updated spec to recommend using:
- shadcn/ui Button component for the retry button
- Design tokens and spacing patterns
- Proper class organization following the cn() pattern

### Gap 2: Missing i18n Support

**Severity:** High
**Location:** spec.md suggested implementation
**Issue:** The spec doesn't mention internationalization. The codebase has:
- `useTranslations` hook for translations
- `messages/en.json` and `messages/he.json` translation files
- Already has `common.notFound` translations
- The error UI should be translated for Hebrew support (the app is bilingual)

**Fix Applied:** Added requirement to use `useTranslations` hook for error messages.

### Gap 3: Existing RouteLoadingIndicator Component Not Referenced

**Severity:** Medium
**Location:** spec.md 
**Issue:** The spec mentions "No loading UI during server component rendering", but doesn't mention that the codebase already has a `RouteLoadingIndicator` component at `src/infra/loading/components/RouteLoadingIndicator.tsx` that handles client-side navigation loading.

The spec's `loading.tsx` serves a different purpose (React Suspense streaming during server component rendering), but they should work together. The existing RouteLoadingIndicator shows a top progress bar during client navigation.

**Fix Applied:** Added note that loading.tsx complements (not replaces) the existing RouteLoadingIndicator component.

### Gap 4: Error Handling Pattern Inconsistency

**Severity:** Medium
**Location:** spec.md and existing code
**Issue:** There's already a `global-error.tsx` at `src/app/global-error.tsx` that:
- Has Sentry integration for error reporting
- Provides error handling at the app root level

The spec's `error.tsx` would be at the route group level `src/app/(frontend)/error.tsx`, which is a different scope. However, there's no integration between them.

**Fix Applied:** Added guidance that the frontend error.tsx should provide localized error messages and may want to optionally integrate with Sentry for consistency.

## Changes Made to Spec

### Added FR-001: Design System Compliance
- Use shadcn/ui Button component for retry button
- Follow design tokens and spacing patterns from DESIGN_SYSTEM.md

### Added FR-002: Internationalization (i18n) Support
- Use `useTranslations` hook for all user-facing text
- Support both English and Hebrew translations

### Added NFR-001: Existing Loading Infrastructure
- loading.tsx should complement the existing RouteLoadingIndicator component
- Consider them additive: one for Suspense streaming, one for client navigation

### Updated Acceptance Criteria:
- [ ] Fix applied as described in task.md
- [ ] TypeScript compilation passes
- [ ] Unit tests pass
- [ ] **NEW**: Uses shadcn/ui Button component
- [ ] **NEW**: Uses i18n translations for error messages
- [ ] **NEW**: loading.tsx uses design tokens and consistent styling

## No Gaps Found

If no gaps are identified, write:

```markdown
# Gap Analysis: <task-id>

## Summary

- Gaps Found: 0
- Spec Revised: No

No gaps identified. The spec is complete and aligned with codebase patterns.
```
