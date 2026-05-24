## Issue #2029: Gravatar images blocked by CSP on admin dashboard

### What was done
- Added `*.gravatar.com` to the `img-src` directive for `/admin/:path*` routes in `next.config.js`
- The admin CSP at line 177 was missing `gravatar.com`, causing browser console errors when loading user avatars

### Root cause
The Content-Security-Policy `img-src` for admin routes did not include `gravatar.com` or `*.gravatar.com`

### Files changed
- `next.config.js` — added `*.gravatar.com` to img-src in the `/admin/:path*` CSP block
- `tests/int/csp-gravatar-admin.int.spec.ts` — new integration test asserting gravatar.com is in img-src for admin routes

### Pattern followed
Existing CSP test `tests/int/csp-vercel-feedback-admin.int.spec.ts` — same regex extraction pattern for reading CSP from next.config.js
