# Fix /ask Page Loading Issue (Task 1989)

## What I Did

**Root Cause**: The `useActiveTimeTracker` hook sends heartbeat pings every 30 seconds to `/api/stats/heartbeat`. The fetch calls had no timeout, so if the server was slow or busy, the fetch could hang indefinitely. While errors were caught, the lack of timeout meant network issues could cause unbounded waiting, potentially interfering with page hydration.

**Fix Applied**: Added a 5-second timeout with `AbortController` to both `sendHeartbeat` and `sendStreakUpdate` functions in `src/client/hooks/useActiveTimeTracker.ts`. Timeout errors are now silently ignored (not logged) since they're expected during server load.

## Files Changed

- `src/client/hooks/useActiveTimeTracker.ts` — Added 5s timeout + AbortController to heartbeat and streak fetches; suppress timeout error logging
- `tests/unit/hooks/useActiveTimeTracker.test.ts` — New test file covering heartbeat behavior (9 tests passing)

## Verification

All quality gates pass: typecheck, lint, format, and unit tests.
