# CSP Fix for Admin User Avatar - Issue #2497

## What was fixed

The admin route CSP (`/admin/:path*`) in `next.config.js` had `gravatar.com` (exact match) in img-src, but Gravatar serves images from `secure.gravatar.com`. CSP host matching requires `*.gravatar.com` wildcard to cover subdomains.

## Changes

1. **next.config.js** - Changed `gravatar.com` to `*.gravatar.com` in admin route CSP img-src directive (line 185)

2. **tests/int/csp-vercel-feedback-admin.int.spec.ts** - Updated test to assert `*.gravatar.com` wildcard pattern instead of exact `gravatar.com` match

## Root cause

In CSP, `gravatar.com` only matches that exact host. Gravatar avatars are served from `secure.gravatar.com` which requires `*.gravatar.com` wildcard.

## Files changed

- `next.config.js` - admin CSP img-src: `gravatar.com` → `*.gravatar.com`
- `tests/int/csp-vercel-feedback-admin.int.spec.ts` - test assertion updated to check for `*.gravatar.com` regex pattern