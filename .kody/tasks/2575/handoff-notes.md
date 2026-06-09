## Fix: Admin chat page stuck on "Loading..." (issue #2575)

### What

`/admin/chat` remained permanently stuck on "Loading..." because `useCurrentUser`'s `fetchUser` had no timeout — if `/api/users/me` hung, `isLoading` stayed `true` forever.

### Root Cause

`src/client/hooks/useCurrentUser.ts` — the `fetchUser` callback used a raw `fetch('/api/users/me')` with no `AbortController` and no timeout.

### Fix

Added `AbortController` + 15-second timeout to `fetchUser`, mirroring the exact pattern used in `MetricsProvider` (commit fbba26000). When the timeout fires, the fetch is aborted, the error is caught, `isLoading` is set to `false`, and the UI renders the login prompt instead of hanging.

### Files

- `src/client/hooks/useCurrentUser.ts` — added timeout to `fetchUser`
- `tests/unit/hooks/useCurrentUser-timeout.test.ts` — new test verifying `isLoading` becomes `false` after timeout

### Test

`pnpm run test:unit -- tests/unit/hooks/useCurrentUser-timeout.test.ts` — passes.
All quality gates green (typecheck, lint, unit tests).
