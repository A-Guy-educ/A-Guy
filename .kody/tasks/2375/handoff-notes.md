# Issue #2375: /ask route redirect to /start

## What was fixed

The `RequireCourseSelection` guard in `src/ui/web/guards/RequireCourseSelection.tsx` was redirecting unauthenticated users (no gradeLevel) to `/` when accessing `/ask`. The root page `/` then redirects to `/start` if no home page exists in Payload. This caused the URL to end up at `/start` instead of allowing the user to select a course first.

## Root cause

The `RequireCourseSelection` guard checks for `gradeLevel` in localStorage. If missing, it called `router.replace('/')`. This was incorrect because `/` may redirect to `/start` if there's no home page in Payload.

## The fix

Changed `router.replace('/')` to `router.replace('/courses')` in `RequireCourseSelection`. The `/courses` page is a public route where users can select a course, which sets their `gradeLevel` in localStorage. After selecting a course, visiting `/ask` again will show the Ask interface.

## Files changed

- `src/ui/web/guards/RequireCourseSelection.tsx` — Changed redirect destination from `/` to `/courses`
- `tests/e2e/ask-route.e2e.spec.ts` — Added E2E test to verify the fix

## Verification

Typecheck, lint, and format checks all pass. The E2E test requires a running dev server to execute.
