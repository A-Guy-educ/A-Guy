# Fix: Gravatar images blocked by CSP on /admin

## What

Added `www.gravatar.com` to the `img-src` CSP directive for `/admin` routes in `next.config.js`.

## Root Cause

The admin routes CSP (line 177 of `next.config.js`) was missing `www.gravatar.com` in the `img-src` directive, causing user avatar images to fail loading on all admin pages.

## Files Changed

- `next.config.js`: Added `www.gravatar.com` to the admin routes CSP img-src directive
- `tests/int/csp-vercel-feedback-admin.int.spec.ts`: Added test asserting `www.gravatar.com` presence in admin img-src

## Test

New test `should include www.gravatar.com in img-src for /admin routes` in the existing CSP test file passes.

## Verification

All 4 tests in `csp-vercel-feedback-admin.int.spec.ts` pass; quality gates green.
