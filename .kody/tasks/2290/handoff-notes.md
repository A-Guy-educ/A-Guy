Fixed CSP blocking Gravatar images on /admin routes (issue #2290).

Root cause: The img-src directive in the /admin/:path* CSP header (next.config.js line 185) had `gravatar.com` (exact host match), but Gravatar images load from `www.gravatar.com`. In CSP, a bare host like `gravatar.com` does NOT match subdomains like `www.gravatar.com` — the wildcard form `*.gravatar.com` is required.

Fix: Changed `gravatar.com` to `*.gravatar.com` in next.config.js admin CSP img-src.

Test updated: tests/int/csp-vercel-feedback-admin.int.spec.ts — the gravatar test now asserts `*.gravatar.com` (subdomain wildcard) rather than just `gravatar.com` (bare host).
