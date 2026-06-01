# Fix: Gravatar images blocked by CSP in admin panel (Issue #2295)

## Root Cause
The admin route CSP included `gravatar.com` in `img-src`, but Gravatar performs a 302 redirect from `www.gravatar.com` to `secure.gravatar.com`. CSP is enforced on the final redirected URL, not the original, so the image was blocked.

## Fix
Added `secure.gravatar.com` to the `img-src` directive for `/admin/:path*` routes in `next.config.js` (line 185).

## Files Changed
- `next.config.js`: Added `secure.gravatar.com` to admin CSP img-src
- `tests/int/csp-vercel-feedback-admin.int.spec.ts`: Added test for `secure.gravatar.com` presence

## Verification
- 5/5 CSP tests pass
- Typecheck: OK
- Lint: OK (pre-existing warning in unrelated file)
- No console.log statements added
