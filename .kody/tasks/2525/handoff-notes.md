## What was done

Added `secure.gravatar.com` explicitly to the `img-src` directive in the admin routes CSP in `next.config.js`. The existing `*.gravatar.com` wildcard was insufficient because `secure.gravatar.com` is the primary CDN domain from which Gravatar avatar images are served (e.g., `https://secure.gravatar.com/avatar/<hash>`).

## Root cause

The Content Security Policy for `/admin/:path*` routes was missing `secure.gravatar.com` in the `img-src` directive. Even though `*.gravatar.com` was present, explicit domains are more reliable for the primary avatar CDN domain used by browsers.

## Changes

1. **next.config.js:185** — Added `secure.gravatar.com` to the `img-src` CSP directive for admin routes, positioned before `*.gravatar.com`
2. **tests/int/csp-vercel-feedback-admin.int.spec.ts** — Added new test case `should include secure.gravatar.com explicitly in img-src for /admin routes (primary avatar CDN)` to prevent regression

## Test

All 6 tests in the CSP test suite pass:
```
pnpm exec vitest run tests/int/csp-vercel-feedback-admin.int.spec.ts
```
