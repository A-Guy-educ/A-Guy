Fixed CSP img-src policy blocking Gravatar avatar images on /admin routes.

Root cause: The `img-src` directive in the `/admin/:path*` CSP header (next.config.js line 177) was missing `gravatar.com`. The user avatar images are loaded from `https://www.gravatar.com/avatar/...` which was blocked by the CSP.

Fix: Added `gravatar.com` to the `img-src` directive in the admin routes CSP, alongside existing allowed image sources (`avatars.githubusercontent.com`, `*.blob.vercel-storage.com`, etc.).

Files changed:
- `next.config.js` — added `gravatar.com` to admin CSP img-src
- `tests/int/csp-vercel-feedback-admin.int.spec.ts` — added test asserting gravatar.com is present in admin img-src

Test: `pnpm exec vitest run tests/int/csp-vercel-feedback-admin.int.spec.ts` — 4 tests pass.
