# Task 2394: Gravatar CSP Fix

## What happened

Issue #2394 reported that Gravatar images (www.gravatar.com) were being blocked by CSP on /admin routes, causing console errors.

## Current state

The fix is **already in place**:
- `gravatar.com` is in the `img-src` directive of the admin route CSP in `next.config.js` (line 185)
- Test `tests/int/csp-vercel-feedback-admin.int.spec.ts` has 4 passing tests including one that explicitly validates `gravatar.com` is in the admin img-src

## Root cause

The admin route CSP was missing `gravatar.com` in its `img-src` directive. Payload CMS admin loads user avatars from Gravatar.

## Fix location

`next.config.js` line 185 - the admin route CSP img-src already includes `gravatar.com`.

## Verification

All 4 tests pass:
- `should include vercel.live in script-src for general routes`
- `should include vercel.live in script-src for /admin routes`
- `should include vercel.live in connect-src for /admin routes`
- `should include gravatar.com in img-src for /admin routes`

Quality gates: typecheck, lint, tests all pass.

## Note

This is a duplicate fix - the same issue was addressed in commits starting around May 2026 (e.g., `d93145a184` add gravatar.com to admin CSP). The fix has been applied across multiple branches and appears stable in the current state.
