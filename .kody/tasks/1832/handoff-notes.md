# Fix: Gravatar images blocked by CSP on /admin (Issue #1832)

## What

Added `*.gravatar.com` to the `img-src` directive of the Content-Security-Policy header for `/admin` routes in `next.config.js`.

## Root Cause

The admin route CSP (line 177 of `next.config.js`) had an `img-src` that included various image sources but omitted Gravatar domains. When Payload CMS renders user avatars from Gravatar URLs (e.g., `https://secure.gravatar.com/avatar/...`), the browser blocked them due to CSP violation.

## Fix

In `next.config.js`, admin route CSP `img-src` changed from:
```
img-src 'self' *.blob.vercel-storage.com img.youtube.com avatars.githubusercontent.com github.com *.githubusercontent.com data: blob:
```
To:
```
img-src 'self' *.blob.vercel-storage.com img.youtube.com avatars.githubusercontent.com github.com *.githubusercontent.com *.gravatar.com data: blob:
```

## Files Changed

- `next.config.js` — added `*.gravatar.com` to admin route img-src
- `tests/int/csp-gravatar-admin.int.spec.ts` — new integration test verifying the fix

## Test

The new test reads `next.config.js` directly and asserts `*.gravatar.com` is present in the admin route's img-src directive, following the same pattern as the existing `csp-vercel-feedback-admin.int.spec.ts`.
