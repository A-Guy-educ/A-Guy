# Fix: RequireCourseSelection blank content bug (#2037)

## What was fixed

The `/ask` page rendered with a blank content area (nav and footer visible, but main content was empty/white).

## Root Cause

In `RequireCourseSelection.tsx`, when `profile?.gradeLevel` was falsy, the code called `router.replace('/')` but left `hasSelection` as `null` — it never called `setHasSelection(false)`. This caused the component to re-render indefinitely showing a spinner, or potentially show blank content due to `router.replace('/')` not triggering navigation reliably.

## Files Changed

1. **src/ui/web/guards/RequireCourseSelection.tsx** — Changed `router.replace('/')` to `window.location.replace('/')` (hard redirect), matching the pattern used in `AskConversationGrid` for the same purpose. Also removed unused `useRouter` import and variable.

2. **tests/e2e/ask-page.e2e.spec.ts** — New E2E test verifying the /ask page renders content when authenticated with gradeLevel set.

## Why `window.location.replace()` instead of `router.replace()`

`AskConversationGrid` uses `window.location.href = '/'` for the same redirect purpose. This ensures an actual page navigation occurs, unlike `router.replace()` which may not trigger navigation reliably in all browser states.
