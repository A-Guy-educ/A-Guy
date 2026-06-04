# Task 2417: CSP blocks Gravatar avatar images in admin panel

## What was done

Fixed the Content-Security-Policy img-src directive for /admin routes in next.config.js to use `*.gravatar.com` wildcard instead of bare `gravatar.com`. This allows Gravatar avatar images loaded from subdomains (www.gravatar.com, secure.gravatar.com, etc.) to render in the admin panel.

## Changes

1. **next.config.js** (line 185): Changed `gravatar.com` → `*.gravatar.com` in the admin route CSP img-src directive.
2. **tests/int/csp-vercel-feedback-admin.int.spec.ts**: Updated the gravatar test to assert the wildcard pattern `*.gravatar.com` instead of bare `gravatar.com`.

## Root cause

The bare domain `gravatar.com` in CSP img-src does not match subdomains. Gravatar URLs use `www.gravatar.com` and `secure.gravatar.com`, which require a wildcard (`*.gravatar.com`) to be permitted.

## Verification

All 4 CSP tests pass. Quality gates (typecheck, lint) pass.
