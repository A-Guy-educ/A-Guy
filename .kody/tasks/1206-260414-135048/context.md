
### taskify (2026-04-14T14:41:15)
## Summary

I've implemented the fix to restrict all learning features to registered users only.

### Changes Made

**1. `middleware.ts`** - Added auth guard logic:
- Added `isProtectedLearningPath()` function that returns true for:
  - `/study`, `/practice`, `/test`, `/ask` (and any sub-paths)
  - `/courses/[slug]/...` (individual course pages, but NOT `/courses` catalog)
- Added `hasAuthToken()` function that checks for `payload-token` cookie
- Added auth guard that redirects unauthenticated u
...(truncated)

### plan (2026-04-14T14:43:21)
## Implementation Complete ✓

All **19 auth middleware tests pass**. The implementation is complete:

### Changes Summary

| File | Status |
|------|--------|
| `middleware.ts` | Auth guard added with `isProtectedLearningPath()` and `hasAuthToken()` functions |
| `tests/int/auth-middleware.int.spec.ts` | 19 tests covering protected routes, public routes, and edge cases |

### Behavior

**Public routes (no login required):**
- `/` - Landing page ✓
- `/courses` - Course catalog ✓

**Protected rout
...(truncated)

### build (2026-04-14T15:29:09)
The CI failures are **all pre-existing issues** unrelated to the auth middleware changes:

| Failing Test | Issue |
|-------------|-------|
| `chapter-admin-title.int.spec.ts` | MongoDB uniqueness constraint - duplicate slug |
| `config-manager.int.spec.ts` | Test isolation issue with tenant-scoped keys |
| `conversations.int.spec.ts` | Access control test - 0 conversations returned |
| `lesson-types.int.spec.ts` | TypeError reading 'db' property |
| `memory-system.int.spec.ts` | Hook timeout (3
...(truncated)

### review (2026-04-14T15:43:00)
Now let me do the code review based on the changes.

## Verdict: PASS

## Summary

The implementation adds auth guard logic to middleware.ts to restrict learning features to authenticated users, with a comprehensive integration test suite covering 19 test cases. Public routes (`/` and `/courses`) pass through while protected routes redirect to `/login?returnTo=<path>`.

## Findings

### Critical

None.

### Major

1. **middleware.ts:44** — Duplicate array values in `authCookieNames`
   ```js
   
...(truncated)

### review-fix (2026-04-14T15:45:58)
**Fix Applied:**

**Issue:** `middleware.ts:44` - Duplicate array values in `authCookieNames`
- Changed from `['payload-token', 'payload-token']` to a simple check: `cookieStore.get('payload-token')?.value !== undefined`

**Verification:**
- Auth middleware tests: **19/19 passed** ✓
- Typecheck: **passed** ✓

The code is now cleaner and simpler - there's only one cookie name to check (`payload-token`), so no need for an array at all.

