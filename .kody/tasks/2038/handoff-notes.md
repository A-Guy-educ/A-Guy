# Fix: Route redirects to /start instead of /onboarding/persona (#2038)

## What was fixed

Routes `/practice`, `/test`, `/study`, and `/ask` were silently redirecting to `/start`
when users without a `gradeLevel` in localStorage visited. The redirect chain was:

1. Client component checks `!profile?.gradeLevel`
2. Redirects to `/` via `window.location.href = '/'` (or `router.replace('/')`)
3. `/` page has no CMS homePage, falls back to `redirect('/start')`
4. User ends up at `/start` — silent, no explanation

The fix uses `getOnboardingRedirect(window.location.pathname)` instead, which redirects
to `/onboarding/persona?returnTo=<path>` — guiding users to complete persona selection
and return to their intended page.

## Files changed

- `src/ui/web/guards/RequireCourseSelection.tsx` — `router.replace('/')` → `router.replace(getOnboardingRedirect(window.location.pathname))`
- `src/app/(frontend)/study/_components/StudyContent/index.tsx` — `window.location.href = '/'` → `window.location.href = getOnboardingRedirect(window.location.pathname)`
- `src/app/(frontend)/ask/_components/AskConversationGrid/index.tsx` — same pattern
- `src/app/(frontend)/ask/_components/AskContent/index.tsx` — same pattern
- `tests/e2e/2038-route-redirect.int.spec.ts` — E2E test for all four routes

## Prior art

Issue #1888 was the same bug; PR #1914 prepared the fix but it was never merged.
This fix is based on the same approach.