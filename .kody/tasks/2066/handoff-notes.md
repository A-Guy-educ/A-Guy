# Fix: Study Plan Silent 401 (#2066)

## What

Unauthenticated users visiting `/study-plan` saw an empty "Ready to start?" state instead of being redirected to login. The API correctly returned 401, but the frontend silently swallowed the error.

## Root Cause

`useStudyPlan.ts` — the `fetchPlan` function caught the 401 API response and set an `error` state, but `StudyPlanPage` never read or displayed that error. With `error` ignored and `plan` still null, the component fell through to the `EmptyPlanState` render.

## Fix

`src/app/(frontend)/study-plan/_components/useStudyPlan.ts` — added `window.location.href = '/login'` redirect when `response.status === 401` in the `fetchPlan` effect. This matches the auth-gate pattern used on other authenticated pages (e.g., `/stats` which uses `getMeUser({ nullUserRedirect: '/login' })`).

**Why redirect instead of showing an error message:** consistent with other authenticated pages in the app; cleaner UX — unauthenticated users should go to login, not be shown an error state on the study-plan page.

## Files Changed

- `src/app/(frontend)/study-plan/_components/useStudyPlan.ts` — 401 detection + redirect (3 lines added)
- `tests/e2e/study-plan-auth-redirect.e2e.spec.ts` — new E2E test for the redirect behavior

## Verification

- TypeScript compiles cleanly (`pnpm tsc --noEmit`)
- ESLint passes with no warnings
- All 5 existing `study-plan-generation.int.spec.ts` tests pass
- Quality gate (`verify`) passes
