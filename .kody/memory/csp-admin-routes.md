---
title: Content Security Policy for Admin Routes
type: convention
updated: 2026-05-13
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1604
---

The `/admin` route has a separate Content-Security-Policy header in next.config.js that must stay in sync with the general route CSP.

## Vercel Feedback Script (#1604)

The Vercel feedback widget (`https://vercel.live/_next-live/feedback/feedback.js`) requires `vercel.live` in both `script-src` and `connect-src` directives. This was missing from the admin route CSP, causing the feedback button to fail silently.

When updating CSP for general routes, always verify the admin route CSP includes the same domains in `script-src` and `connect-src`.

## Related

- [Architecture](../architecture.md) — Next.js configuration
