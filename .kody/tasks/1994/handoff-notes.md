# Fix: Add Gravatar to CSP img-src for /admin routes

## What was done

1. **Repro test**: Added a test in `tests/int/csp-vercel-feedback-admin.int.spec.ts` that verifies `gravatar.com` is in the `img-src` directive for `/admin/:path*` routes. The test failed initially (confirmed the bug).

2. **Root cause**: The admin route CSP in `next.config.js` (line 177) had `img-src 'self' *.blob.vercel-storage.com img.youtube.com avatars.githubusercontent.com github.com *.githubusercontent.com data: blob:` — missing `gravatar.com`.

3. **Fix**: Added `gravatar.com` to the img-src directive for the `/admin/:path*` CSP.

## Files changed

- `next.config.js`: Added `gravatar.com` to admin route CSP img-src
- `tests/int/csp-vercel-feedback-admin.int.spec.ts`: Added test for gravatar.com in img-src

## Verification

- All 4 CSP tests pass
- `pnpm ci:local` passes (typecheck, lint, tests)
