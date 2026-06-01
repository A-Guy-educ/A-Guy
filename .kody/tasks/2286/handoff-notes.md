Fixed CSP img-src policy blocking Gravatar avatar images on /admin pages (issue #2286).

Root cause: The `img-src` directive in the `/admin/:path*` CSP header (next.config.js line 185) had `gravatar.com` which does NOT match `www.gravatar.com` when the base domain itself has subdomains. CSP host matching requires `*.gravatar.com` wildcard for subdomain matching.

Fix: Changed `gravatar.com` to `*.gravatar.com` in the admin route CSP img-src directive. Also updated the existing integration test to assert `*.gravatar.com` instead of `gravatar.com`.

Files changed:
- `next.config.js` — changed `gravatar.com` to `*.gravatar.com` in admin CSP img-src
- `tests/int/csp-vercel-feedback-admin.int.spec.ts` — updated test assertion to check for `*.gravatar.com`

Note: Task #1791 previously added `gravatar.com` to fix a missing entry, but did not address the subdomain matching issue.
