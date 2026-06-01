# Issue #2285 Fix - Gravatar CSP in Admin Panel

## What
Fixed Content Security Policy (CSP) in `next.config.js` admin route headers to allow Gravatar images from `www.gravatar.com`.

## Root Cause
CSP `img-src 'self' gravatar.com` does NOT match `www.gravatar.com` — they are different hosts. In CSP, `example.com` only matches that exact host, not subdomains.

## Changes
1. **`next.config.js`** (line ~185): Changed `gravatar.com` to `*.gravatar.com` in the admin route CSP img-src directive
2. **`tests/int/csp-vercel-feedback-admin.int.spec.ts`**: Updated existing gravatar test to check for `*.gravatar.com` and added a new test specifically verifying www.gravatar.com matching

## Test
All 5 CSP tests pass (4 existing + 1 new).
