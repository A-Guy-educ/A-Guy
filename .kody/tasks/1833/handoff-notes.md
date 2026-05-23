# Task 1833: Frontend heartbeat fetch fails repeatedly

## What

`POST /api/stats/heartbeat` was crashing with a 500 error when `payload.auth()` threw on malformed auth tokens, instead of returning 401.

## Root cause

`payload.auth({ headers: req.headers })` was called without a try/catch. When a malformed JWT token was in the Authorization header, the route crashed with an unhandled exception (500).

## Fix

Wrapped `payload.auth()` in try/catch in `src/app/api/stats/heartbeat/route.ts` — mirroring the exact pattern from the dashboard-metrics fix in commit `b5c228e25`. Returns 401 on any auth exception.

Also added proper type narrowing: extracted `authResult.user as { id: string }` to avoid TypeScript errors.

## Files changed

- `src/app/api/stats/heartbeat/route.ts` — auth block wrapped in try/catch
- `tests/int/stats-heartbeat.int.spec.ts` — new integration tests (6 test cases covering auth error paths and valid heartbeat flow)

## Note

Tests were written but couldn't be verified end-to-end in this environment (no `DATABASE_URL` set — tests are `skipIf(!hasDatabaseUrl)`). The fix follows the exact same pattern already merged for dashboard-metrics in `b5c228e25`.
