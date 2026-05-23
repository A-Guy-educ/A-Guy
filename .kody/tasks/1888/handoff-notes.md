## Fix: Core feature routes redirect to /start instead of loading (#1888)

### What was done
Fixed two client-side route guards that incorrectly redirected to `/` (which chains to `/start`) when a user was authenticated but hadn't completed persona selection (no gradeLevel in localStorage).

**Root cause:** `RequireCourseSelection` (used by `/ask`) and `StudyContent.loadData()` (used by `/study`, `/practice`) both checked for `gradeLevel` in localStorage and redirected to `/` when missing. The homepage has no CMS-managed homePage, so it falls back to `redirect('/start')`. The fix: redirect to `/onboarding/persona` using the existing `getOnboardingRedirect()` utility, which encodes `returnTo` so users return to their intended page after completing persona selection.

### Files changed
- `src/ui/web/guards/RequireCourseSelection.tsx`: Import `getOnboardingRedirect`, change `router.replace('/')` → `router.replace(getOnboardingRedirect(window.location.pathname))`
- `src/app/(frontend)/study/_components/StudyContent/index.tsx`: Import `getOnboardingRedirect`, change `window.location.href = '/'` → `window.location.href = getOnboardingRedirect(window.location.pathname)`
- `tests/unit/infra/onboarding/redirect.spec.ts`: Added 8 tests for `getOnboardingRedirect` covering safe paths, malicious URLs, and query string handling
- `tests/e2e/1888-route-redirect.int.spec.ts`: E2E regression test (requires running dev server to execute)

### Quality gates
- TypeScript: PASS (`pnpm typecheck`)
- Lint: PASS (warnings only, no errors)
- Unit tests: PASS (3271 tests across 244 files, including new redirect.spec.ts)
- `pnpm verify`: PASS

### Reproduction
The new unit test `tests/unit/infra/onboarding/redirect.spec.ts` passes, confirming `getOnboardingRedirect` returns correct URLs like `/onboarding/persona?returnTo=%2Fstudy` for safe paths. The E2E test in `tests/e2e/1888-route-redirect.int.spec.ts` documents the full browser flow but requires a running dev server (`.next` build) to execute — it was written following existing test patterns in `tests/e2e/course-selection.e2e.spec.ts`.

### Follow-up
`/stats` (src/app/(frontend)/stats/page.tsx) has its own auth check via `getMeUser` and does NOT use `RequireCourseSelection`. The issue description says all 4 routes redirect to /start, but /stats appears to follow a different auth path. Verify if /stats also needs the grade-level guard or if the issue description was slightly inaccurate about which routes were affected.
