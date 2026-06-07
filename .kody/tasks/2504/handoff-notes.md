# Fix for Issue #2504: /ask route redirects to /start instead of rendering

## What I did

**Root cause**: The `/ask` route was incorrectly listed in the `protectedPaths` array in `src/middleware.ts`. This caused unauthenticated users visiting `/ask` to be redirected to `/login?returnTo=/ask`. The page itself handles course selection requirements via the `RequireCourseSelection` client component, so the middleware-level protection was both incorrect and redundant.

**Files changed**:
1. `src/middleware.ts` - Removed `/ask` from the `protectedPaths` array (line 22), updated the comment to reflect this
2. `tests/int/auth-middleware.int.spec.ts` - Removed `/ask` from the protected routes test array
3. `tests/int/ask-page-redirect.int.spec.ts` - New test file proving the bug was fixed

**Fix**: Removed `/ask` from `['/study', '/practice', '/test', '/ask']` in middleware, changing it to `['/study', '/practice', '/test']`.

## Verification
- All 6 tests in `ask-page-redirect.int.spec.ts` pass
- All 18 tests in `auth-middleware.int.spec.ts` pass
- Full quality gate (typecheck, lint, tests) passes