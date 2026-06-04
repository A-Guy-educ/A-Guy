## Fix: CSP img-src blocks Gravatar images on /admin

**Root cause:** The CSP `img-src` directive in `next.config.js` for `/admin/:path*` routes listed `gravatar.com` (exact host) but the actual image URL was `https://www.gravatar.com/avatar/...`. In CSP, an exact-host pattern like `gravatar.com` does NOT match `www.gravatar.com` — they are distinct hosts. The wildcard pattern `*.gravatar.com` is required to match subdomains like `www`.

**Files changed:**
- `next.config.js` — changed `gravatar.com` to `*.gravatar.com` in the admin route CSP img-src directive (line 185)
- `tests/int/csp-vercel-feedback-admin.int.spec.ts` — added new test verifying `*.gravatar.com` wildcard pattern is used (not just `gravatar.com` string containment)

**Why 2 errors per page:** The admin panel loads the logged-in user's avatar from Gravatar. Each page load triggered 2 identical CSP violation messages (likely the browser retrying the blocked request). The test file already existed but only checked for string containment of `gravatar.com`, which passed even with the wrong (non-wildcard) pattern.
