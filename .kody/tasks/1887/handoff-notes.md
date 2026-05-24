## Fix: Gravatar avatar blocked by CSP in admin panel (#1887)

### What was done
Added `www.gravatar.com` to the `img-src` directive in the `/admin/:path*` CSP header in `next.config.js` (line 177). Also added a regression test in `tests/int/csp-vercel-feedback-admin.int.spec.ts` that asserts `www.gravatar.com` is present in the admin route's `img-src` CSP directive.

### Root cause
The admin route CSP header did not include `www.gravatar.com` in its `img-src` directive, causing browser CSP violations when loading user avatars from Gravatar.

### Files changed
- `next.config.js`: Added `www.gravatar.com` to `img-src` for `/admin/:path*` route
- `tests/int/csp-vercel-feedback-admin.int.spec.ts`: Added `should include www.gravatar.com in img-src for /admin routes` test

### Reproduction
Test at `tests/int/csp-vercel-feedback-admin.int.spec.ts` failed before fix with:
`expected '\'self\' *.blob.vercel-storage.com im…' to contain 'www.gravatar.com'`
After fix: all 4 tests pass.
