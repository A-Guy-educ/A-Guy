---
title: CSP Whitelists Vercel Live Domain
type: decision
updated: 2026-05-13
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1604
---

The Vercel feedback overlay (`vercel.live`) is whitelisted in the admin route's CSP `script-src` and `connect-src` directives in `next.config.js`. This allows the Vercel dev tooling banner to load on `/admin` without violating the Content Security Policy.

## Why

Vercel's dev overlay is served from `https://vercel.live`. Without explicit allowance, the browser blocks the script and XHR connections, preventing the overlay from rendering. The same domain pattern already existed for the general route.

## Maintenance Note

Any new third-party script or API domain added to the admin panel must be added to both `script-src` and `connect-src` in the admin route's CSP config block.

## Related

- [architecture.md](../architecture.md) — security/CSP section
