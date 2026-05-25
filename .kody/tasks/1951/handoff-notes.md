## Issue #1951: Gravatar avatar images blocked by CSP on /admin

### What was done

**Root cause**: The `/admin` route CSP header in `next.config.js` did not include `gravatar.com` in the `img-src` directive. The admin user avatar uses Gravatar, so it was blocked by the browser's CSP enforcement.

**Fix**: Added `*.gravatar.com` to the `img-src` directive in the `/admin/:path*` CSP header (line 177 of `next.config.js`).

**Files changed**:
- `next.config.js` — added `*.gravatar.com` to img-src for admin routes
- `tests/int/csp-gravatar-admin.int.spec.ts` — new integration test that asserts `gravatar.com` is in img-src for /admin routes

### How to verify

Run `pnpm exec vitest run tests/int/csp-gravatar-admin.int.spec.ts --config ./vitest.config.mts` — test should pass.

### Pattern followed

Mirrored the existing `tests/int/csp-vercel-feedback-admin.int.spec.ts` test structure, using the same regex-based CSP parsing approach to extract and assert on the img-src directive.
