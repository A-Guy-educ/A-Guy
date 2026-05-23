# Issue #1841 — Gravatar images blocked by CSP in /admin

## What was done

Added `gravatar.com` to the `img-src` directive in the `/admin` route CSP header in `next.config.js` (line ~177). The fix mirrors the existing pattern for other external image hosts (e.g., `avatars.githubusercontent.com`, `img.youtube.com`).

## Files changed

- `next.config.js` — Added `gravatar.com` to `img-src` for `/admin/:path*` CSP header
- `tests/int/csp-admin-gravatar.int.spec.ts` — New integration test verifying `gravatar.com` is in `/admin` img-src

## Root cause

The `/admin` route CSP header had `img-src 'self' *.blob.vercel-storage.com img.youtube.com avatars.githubusercontent.com github.com *.githubusercontent.com data: blob:` — missing `gravatar.com`, causing browser console errors when Payload CMS renders user avatars from Gravatar.

## Verification

- Repro test fails before fix, passes after fix
- All quality gates (typecheck, lint, tests) pass on attempt 1