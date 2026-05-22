# Fix: Admin Dashboard Widgets Stuck Loading Indefinitely (#1828)

## What I Fixed

**Root cause**: The `payload.auth()` call in `src/app/api/admin/dashboard-metrics/route.ts` was not wrapped in a try/catch. If `payload.auth()` throws an error (due to a corrupted token, database issue, or any internal Payload error), the entire route crashes without sending any HTTP response. This causes the frontend fetch to hang indefinitely, keeping all 7 dashboard widgets stuck in the "Loading..." state.

**Fix**: Wrapped `payload.auth()` in a try/catch block. If it throws, the route now returns `401 Unauthorized` instead of crashing silently. Also properly typed the user object to satisfy TypeScript.

## Files Changed

- `src/app/api/admin/dashboard-metrics/route.ts` (lines 228-249):
  - Added try/catch around `payload.auth({ headers: req.headers })`
  - Returns 401 on auth error
  - Properly typed user object for collection/role checks

## Why This Matters

Without the try/catch, any auth failure (expired session, corrupted cookie, DB error during token validation) would cause the route to crash. The frontend would never receive a response, so `loading` would stay `true` forever. Now it properly returns 401, the frontend shows an error state, and users see a meaningful message instead of infinite loading.

## Verification

- `pnpm ci:local` passes (typecheck, lint, tests)
