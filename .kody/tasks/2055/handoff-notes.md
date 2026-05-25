# Task 2055: Frontend routes redirect to /start

## Bug
Five routes (/ask, /practice, /stats, /test, /study) redirected to /start when accessed without a gradeLevel set, instead of redirecting to /onboarding/persona.

## Root Cause
Two client-side guards redirected to `/` (root) when gradeLevel was missing:
1. `RequireCourseSelection` (wraps /ask) — used `router.replace('/')`
2. `StudyContent` (used by /practice, /test, /study) — used `window.location.href = '/'`

The homepage then falls back to /start (since no home page exists in the CMS), creating a silent 2-hop redirect chain.

## Fix
Changed both redirect targets to use `getOnboardingRedirect(window.location.pathname)` which routes to `/onboarding/persona?returnTo=<current-path>`.

### Files changed
- `src/ui/web/guards/RequireCourseSelection.tsx` — added `getOnboardingRedirect` import, changed redirect target
- `src/app/(frontend)/study/_components/StudyContent/index.tsx` — added `getOnboardingRedirect` import, changed redirect target from `/` to `getOnboardingRedirect(window.location.pathname)`

### Test added
- `tests/e2e/2055-route-redirect-to-start.int.spec.ts` — E2E test covering /ask, /practice, /test, /study (not /stats — see followups)

## Known gap
/stats route was listed in the issue but uses a different auth pattern (getMeUser server-side guard, not client-side grade-level guard). It was NOT modified and may need separate investigation if the bug is present there.
