# Task 1981: Gravatar images blocked by CSP in admin panel

## What was done
- Added test `should include gravatar.com in img-src for /admin routes` to `tests/int/csp-vercel-feedback-admin.int.spec.ts`
- Fixed `next.config.js` admin route CSP header to include `secure.gravatar.com` in `img-src` directive

## Root cause
The Content-Security-Policy `img-src` directive for `/admin/:path*` routes was missing `secure.gravatar.com`, causing user avatars from Gravatar to be blocked.

## Files changed
- `next.config.js`: Added `secure.gravatar.com` to `img-src` in admin route CSP
- `tests/int/csp-vercel-feedback-admin.int.spec.ts`: Added test for gravatar.com in admin img-src

## Verification
- New test passes: verifies `secure.gravatar.com` is in admin route `img-src`
- All existing CSP tests continue to pass
- Quality gates (typecheck, lint) passed