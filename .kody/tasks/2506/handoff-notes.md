## Issue #2506 — Gravatar blocked by CSP (avatar missing in admin sidebar)

### Root cause
Payload CMS generates Gravatar avatar URLs at `https://www.gravatar.com/avatar/<hash>?default=mp&r=g&s=50` (confirmed in `@payloadcms/ui/dist/graphics/Account/Gravatar/index.js`). The admin CSP in `next.config.js` had `gravatar.com` in `img-src`, but `gravatar.com` does NOT match `www.gravatar.com` in CSP hostname matching — `www` is a subdomain and requires explicit allowance.

### Fix
- `next.config.js`: Changed `gravatar.com` → `www.gravatar.com` in the `/admin/:path*` route CSP's `img-src` directive (line 185).
- `tests/int/csp-vercel-feedback-admin.int.spec.ts`: Updated the existing test to assert `www.gravatar.com` specifically (line 102) rather than the too-broad `gravatar.com`.

### Files changed
1. `next.config.js` — admin CSP img-src: `gravatar.com` → `www.gravatar.com`
2. `tests/int/csp-vercel-feedback-admin.int.spec.ts` — updated test assertion to check for `www.gravatar.com`

### No follow-ups
No additional issues surfaced during this fix.
