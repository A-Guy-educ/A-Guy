## Fix: Add www.gravatar.com to admin CSP img-src (Issue #2374)

**Root cause:** The CSP `img-src` directive for `/admin/:path*` routes included `gravatar.com` but not `www.gravatar.com`. According to CSP rules, a host without a leading wildcard only matches exact hosts — `gravatar.com` does NOT match `www.gravatar.com`. The browser requests `https://www.gravatar.com/avatar/...`, which was blocked.

**Files changed:**
- `next.config.js` — added `www.gravatar.com` to img-src directive in admin routes CSP (line 185)
- `tests/int/csp-vercel-feedback-admin.int.spec.ts` — added test asserting `www.gravatar.com` is present in img-src

**Fix:** Added `www.gravatar.com` to the img-src directive alongside `gravatar.com`.

**No follow-ups needed** — targeted one-line fix with a specific test.
