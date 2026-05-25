# Issue #1869 Fix - Admin Dashboard User Avatar Blocked by CSP

## What I did

Added `secure.gravatar.com` to the `img-src` CSP directive for `/admin` routes in `next.config.js`.

## Root cause

The `/admin` route's Content-Security-Policy `img-src` directive did not include `secure.gravatar.com`, causing Gravatar user avatar URLs to be blocked when loading the Payload admin dashboard.

## Files changed

- `next.config.js` — Added `secure.gravatar.com` to the `img-src` directive for `/admin/:path*` route (line ~177)
- `tests/int/csp-vercel-feedback-admin.int.spec.ts` — Added test case `should include secure.gravatar.com in img-src for /admin routes`

## How to verify

Run: `pnpm exec vitest run tests/int/csp-vercel-feedback-admin.int.spec.ts --config ./vitest.config.mts`

All 4 tests should pass (3 existing + 1 new).
