# Fix: Frontend login form silently fails - session not recognized

## Root Cause

The `hasAuthToken` function in `middleware.ts` had a misleading comment claiming it checked both the configured cookie prefix and `payload-token` fallback. In reality, it only checked `payload-token`. The `loginAction` and `getMeUser` both read `cookiePrefix` from `payload.config.cookiePrefix` to construct the cookie name, but the middleware didn't follow the same pattern.

## Fix Applied

1. **src/middleware.ts**: Made `hasAuthToken` async so it can dynamically import `@payload-config` to read the actual `cookiePrefix`. It now checks both the configured cookie name (e.g., `custom-token` if prefix is `custom`) and the fallback `payload-token`.

2. **src/middleware.ts**: Made the exported `middleware` function async since `hasAuthToken` is now async.

3. **tests/int/auth-middleware.int.spec.ts**: Updated all test callbacks to be async and await `middleware(request)` since the middleware now returns a Promise.

4. **tests/int/middleware.int.spec.ts**: Same async/await updates for all test cases.

## Files Changed

- `src/middleware.ts` - `hasAuthToken` now async, reads config for cookiePrefix
- `tests/int/auth-middleware.int.spec.ts` - async test callbacks
- `tests/int/middleware.int.spec.ts` - async test callbacks

## Verification

- `npx tsc --noEmit` passes
- `npx vitest run tests/int/auth-middleware.int.spec.ts` - 19 tests pass
- `npx vitest run tests/int/middleware.int.spec.ts` - 12 tests pass
- `mcp__kody-verify__verify` - ok=true, all gates green
