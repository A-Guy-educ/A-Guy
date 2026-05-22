## Issue #1799: Gravatar images blocked by CSP across all admin pages

### What was done
Added `www.gravatar.com` to the `img-src` directive in the `/admin/:path*` CSP header in `next.config.js`.

### Root cause
The CSP for admin routes was missing `www.gravatar.com` in the `img-src` directive. While other avatar sources like `avatars.githubusercontent.com` were allowed, Gravatar (used for user avatars in admin sidebar and edit views) was not permitted.

### Files changed
- **next.config.js** (line ~177): Added `www.gravatar.com` to img-src for `/admin/:path*` routes
- **tests/int/csp-vercel-feedback-admin.int.spec.ts**: Added test `should include www.gravatar.com in img-src for /admin routes`

### Test
Reproduction test added to existing CSP test file — it failed before the fix and passes after.

### No follow-ups
This was a straightforward CSP configuration fix with no additional issues surfaced.
