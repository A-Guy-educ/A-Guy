## #1838 Fix Summary

**Bug**: `/ask` page stuck indefinitely on loading spinner when `profile?.gradeLevel` is missing.

**Root Cause**: `RequireCourseSelection` guard in `src/ui/web/guards/RequireCourseSelection.tsx` called `router.replace('/')` but did NOT call `setHasSelection(false)` first. Since `hasSelection` remained `null`, the component kept rendering the spinner forever instead of completing the redirect.

**Fix**: Added `setHasSelection(false)` before `router.replace('/')` so the spinner is removed and the redirect completes.

**Files Changed**:
- `src/ui/web/guards/RequireCourseSelection.tsx` — one-line fix: added `setHasSelection(false)` before redirect
- `tests/e2e/ask-loading-1838.e2e.spec.ts` — E2E test that reproduces the bug (profile without gradeLevel → spinner stuck) and verifies redirect to home

**Note**: `AskConversationGrid` and `AskContent` also check for missing `gradeLevel` but use `window.location.href = '/'` (hard redirect) which unmounts the component immediately, so no spinner issue there.
