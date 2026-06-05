Fixed CSP img-src blocking Gravatar avatar images on /admin routes.

Root cause: The img-src directive in the admin routes CSP had `gravatar.com` but NOT `www.gravatar.com`. In CSP, `gravatar.com` does not match `www.gravatar.com` — subdomains must be explicitly listed. User avatar images are loaded from `https://www.gravatar.com/avatar/...`, which was being blocked.

Fix: Added `www.gravatar.com` to the img-src directive in the admin routes CSP (next.config.js line 185).

Files changed:
- `next.config.js` — added `www.gravatar.com` to admin CSP img-src
- `tests/int/csp-vercel-feedback-admin.int.spec.ts` — added test asserting www.gravatar.com is present in admin img-src

Test: Added `should include www.gravatar.com in img-src for /admin routes` which initially failed (confirming the bug) and passes after the fix. All 5 CSP tests now pass.
