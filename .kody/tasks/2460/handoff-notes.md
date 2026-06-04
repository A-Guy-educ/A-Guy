Fixed CSP img-src blocking Gravatar avatars on /admin routes.

Root cause: The img-src directive in the /admin/:path* CSP header (next.config.js line 185) had `gravatar.com` which only matches the exact hostname. Gravatar serves avatar images from `secure.gravatar.com` and `www.gravatar.com` subdomains, which are not covered by the non-wildcard domain.

Fix: Changed `gravatar.com` to `*.gravatar.com` in the admin routes CSP img-src directive to allow all gravatar subdomains.

Files changed:
- `next.config.js` — changed `gravatar.com` to `*.gravatar.com` in admin CSP img-src
- `tests/int/csp-vercel-feedback-admin.int.spec.ts` — updated test to check for `*.gravatar.com` wildcard

Test: `pnpm exec vitest run tests/int/csp-vercel-feedback-admin.int.spec.ts` — 4 tests pass.
