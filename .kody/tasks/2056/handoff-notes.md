Fixed: Added `gravatar.com` to the img-src CSP directive for `/admin/:path*` routes in `next.config.js`.

Root cause: The admin route CSP headers did not include `gravatar.com` in the `img-src` directive, causing user avatar images from Gravatar to be blocked.

Changes:
- `next.config.js`: Added `gravatar.com` to img-src in admin route CSP
- `tests/int/csp-vercel-feedback-admin.int.spec.ts`: Added test asserting gravatar.com is in img-src for admin routes

All quality gates passed on first attempt.
