# Fix: CSP blocking Gravatar avatars in admin panel

## What

Added `www.gravatar.com` to the `img-src` directive for `/admin/:path*` routes in `next.config.js`.

## Why

The admin routes CSP was missing `www.gravatar.com` in `img-src`, causing user avatars (loaded via Gravatar) to be blocked by the browser's Content Security Policy. The fix follows the existing pattern of allowing external image sources like `avatars.githubusercontent.com`.

## Files Changed

- `next.config.js` — added `www.gravatar.com` to img-src in admin routes CSP
- `tests/int/csp-admin-gravatar-1878.int.spec.ts` — new integration test verifying www.gravatar.com is allowed in admin CSP