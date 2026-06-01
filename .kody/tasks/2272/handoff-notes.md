## Fix: Gravatar image blocked by CSP on /admin

**Root cause**: The admin route CSP had `gravatar.com` in img-src, but Gravatar
serves images from `secure.gravatar.com`. CSP does not match subdomains
automatically — `gravatar.com` ≠ `secure.gravatar.com`.

**Files changed**:
- `next.config.js` — admin route img-src: `gravatar.com` → `*.gravatar.com`
- `tests/int/csp-vercel-feedback-admin.int.spec.ts` — updated test name and
  assertion from `gravatar.com` to `*.gravatar.com` to match the wildcard form

**What *.gravatar.com covers**: secure.gravatar.com, 0.gravatar.com,
1.gravatar.com (the actual hash-based CDN hosts), and any future subdomains.
