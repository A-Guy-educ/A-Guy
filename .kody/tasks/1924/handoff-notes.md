## Issue #1924 Fix Summary

**Bug**: CSP on `/admin` routes blocked Gravatar images (user avatars broken).

**Root cause**: `next.config.js` admin route CSP `img-src` did not include `*.gravatar.com`.

**Fix**: Added `*.gravatar.com` to the `img-src` directive in the `/admin/:path*` headers CSP (line 177 of `next.config.js`).

**Files changed**:
- `next.config.js` — added `*.gravatar.com` to admin route img-src
- `tests/int/csp-admin-gravatar.int.spec.ts` — new regression test

**Verification**: `pnpm ci:local` passes (typecheck, lint, tests green).
