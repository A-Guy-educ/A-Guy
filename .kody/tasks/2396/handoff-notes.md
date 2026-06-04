Fixed issue #2396: Gravatar images blocked by CSP on /admin routes.

Root cause: The admin CSP img-src had `gravatar.com` but browsers load avatars from `www.gravatar.com` (after a server-side redirect from `gravatar.com`). A bare `gravatar.com` in CSP does not match `www.gravatar.com` after redirect.

Fix: Changed `gravatar.com` to `*.gravatar.com` wildcard in next.config.js admin CSP img-src directive (line 185). Also strengthened the test assertion from a weak `toContain('gravatar.com')` substring check to `toMatch(/\*\.gravatar\.com/)` which verifies the wildcard is present.

Files changed:
- next.config.js: `gravatar.com` → `*.gravatar.com` in admin CSP img-src
- tests/int/csp-vercel-feedback-admin.int.spec.ts: test now asserts `*.gravatar.com` wildcard is present
