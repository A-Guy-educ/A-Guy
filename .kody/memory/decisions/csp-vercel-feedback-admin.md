---
title: CSP allows Vercel feedback on /admin routes
type: decision
updated: 2026-05-14
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1604
---

## Decision

The admin route's CSP now includes `https://vercel.live` in both `script-src` and `connect-src` directives.

## Why

The Vercel feedback widget (`https://vercel.live/_next-live/feedback/feedback.js`) was blocked on `/admin` routes because `vercel.live` was not whitelisted. Adding it enables the feedback button for admin users.

## Implementation

- `next.config.js`: Admin route CSP includes `https://vercel.live` in `script-src` and `connect-src`
- This follows the same pattern as the general route CSP (which already had `vercel.live`)

## Trade-offs

- Allows Vercel's script to run in admin context (acceptable for internal use)
- Consistent with existing trust model for Vercel-hosted deployment
