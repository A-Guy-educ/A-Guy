# Issue #1906 - Allow Gravatar in CSP for /admin avatars

## What was done
Added `*.gravatar.com` to the `img-src` directive in the `/admin` route CSP headers in `next.config.js`.

## Root cause
The `/admin` route CSP had a restrictive `img-src` that did not include `gravatar.com`, causing user avatars to be blocked and fall back to initials.

## Files changed
- `next.config.js` (line 177): Added `*.gravatar.com` to img-src for /admin routes
- `tests/int/csp-vercel-feedback-admin.int.spec.ts`: Added test verifying gravatar.com is in img-src for /admin routes

## Verification
- Test `should include gravatar.com in img-src for /admin routes` passes
- All 4 CSP tests pass
- Full quality gates (typecheck, lint, tests) pass
