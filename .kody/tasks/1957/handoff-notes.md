# Task 1957: Add Gravatar to Content Security Policy img-src directive

## What was done

**Root cause**: The `/admin` route CSP `img-src` directive in `next.config.js` did not include `gravatar.com`, causing browser console errors when loading user avatars from Gravatar.

**Fix**: Added `gravatar.com` to the `img-src` directive in the `/admin/:path*` CSP header block (line 177 of `next.config.js`).

**Test**: Added `tests/int/csp-gravatar-admin.int.spec.ts` which verifies that `gravatar.com` is present in the `img-src` CSP directive for `/admin` routes. The test was written first (failed), then the fix was applied, and the test passed.

## Files changed

- `next.config.js` — Added `gravatar.com` to `img-src` in the `/admin/:path*` headers CSP
- `tests/int/csp-gravatar-admin.int.spec.ts` — New integration test verifying the fix

## Verification

- `pnpm exec vitest run tests/int/csp-gravatar-admin.int.spec.ts` — passed
- `pnpm ci:local` — all gates green (attempt 1)
