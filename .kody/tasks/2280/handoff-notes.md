Fixed CSP img-src blocking Gravatar avatar images on /admin routes.

Root cause: The `img-src` directive in the `/admin/:path*` CSP header (next.config.js line 185) had `gravatar.com` but Payload loads user avatars from `https://www.gravatar.com/avatar/...?`. In CSP, `gravatar.com` does NOT match `www.gravatar.com` — subdomains require a wildcard prefix `*.gravatar.com`.

Fix: Changed `gravatar.com` to `*.gravatar.com` in the admin CSP img-src directive.

Files changed:
- `next.config.js` — changed `gravatar.com` to `*.gravatar.com` in admin CSP img-src
- `tests/int/csp-vercel-feedback-admin.int.spec.ts` — updated test to assert `*.gravatar.com` (wildcard) instead of bare `gravatar.com`
