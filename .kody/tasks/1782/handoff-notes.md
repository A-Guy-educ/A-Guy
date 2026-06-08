# Fix for #1782: User avatar broken on all admin pages due to CSP

## What was done

Added `gravatar.com` to the `img-src` directive in the admin routes CSP in `next.config.js`.

## Root cause

The Content Security Policy for `/admin/:path*` routes was missing `gravatar.com` in the `img-src` directive, causing Gravatar avatar images to be blocked.

## Changes

1. **next.config.js:177** — Added `gravatar.com` to the `img-src` CSP directive for admin routes
2. **tests/int/csp-vercel-feedback-admin.int.spec.ts** — Added test case `should include gravatar.com in img-src for /admin routes` to prevent regression

## Test

The new integration test reads the CSP value directly from `next.config.js` and asserts that `gravatar.com` is present in the `img-src` directive for admin routes. All 4 tests in the CSP test suite pass.