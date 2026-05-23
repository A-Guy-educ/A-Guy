## Issue #1935 Fix

**Bug**: Admin avatars (Gravatar) blocked by CSP — `www.gravatar.com` not in img-src directive for `/admin` routes.

**Root cause**: The admin route CSP in `next.config.js` was missing `www.gravatar.com` in the `img-src` directive.

**Files changed**:
- `next.config.js`: Added `www.gravatar.com` to `img-src` in the `/admin/:path*` CSP header
- `tests/int/csp-vercel-feedback-admin.int.spec.ts`: Added test `should include www.gravatar.com in img-src for /admin routes`

**Fix**: Added `www.gravatar.com` to the img-src directive for admin routes, matching the existing pattern for other external image domains (github.com, avatars.githubusercontent.com, etc.).
