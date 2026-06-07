## Issue #2503 — Custom lesson duplication review screen stuck on Loading

### What I did

**Root cause**: `useCurrentUser` hook (`src/client/hooks/useCurrentUser.ts`) made a fetch to `/api/users/me` with no timeout. If the request hangs, `isLoading` stays `true` forever and pages using the hook show "Loading…" indefinitely. The `/admin/lesson-duplications/<id>` page uses this hook to check admin auth.

**Fix**: Added `AbortController` + 15s timeout to the `fetchUser` function in `useCurrentUser`. When the timeout fires, the fetch is aborted, the catch block runs, `isLoading` is set to `false`, and `error` is set to `'Request timed out'` — allowing the UI to render an error state instead of spinning forever.

**Test**: Wrote `tests/unit/client/hooks/useCurrentUser.test.ts` with 3 tests:
1. `sets isLoading true on mount and resolves user on success` — verifies normal success path
2. `sets user to null on non-ok response` — verifies 4xx responses don't leave loading=true
3. `sets isLoading to false and sets error when fetch times out (does not hang)` — verifies timeout path

### Files changed

- `src/client/hooks/useCurrentUser.ts` — added AbortController + 15s timeout
- `tests/unit/client/hooks/useCurrentUser.test.ts` — new test file (3 tests, all passing)

### Why no integration test

Integration tests for the timeout would require either:
(a) a real server that hangs (hard to test reliably), or
(b) mocking the server at the network level (complex setup).

The unit test mocks `fetch` directly to simulate a hanging request and verifies the hook exits loading state correctly — a focused, reliable test for the actual fix.
