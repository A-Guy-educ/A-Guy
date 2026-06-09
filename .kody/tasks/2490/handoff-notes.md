Fixed failing CI test `csp-vercel-feedback-admin.int.spec.ts` — `should include www.gravatar.com in img-src for /admin routes`.

Root cause: The admin routes CSP in `next.config.js` (line 185) had `*.gravatar.com` in img-src but NOT `www.gravatar.com`. In CSP, a wildcard subdomain (`*.gravatar.com`) does NOT match a specific subdomain (`www.gravatar.com`) — they are distinct source list entries. Gravatar avatar images are loaded from `https://www.gravatar.com/avatar/...`, so `www.gravatar.com` must be explicitly listed.

Fix: Added `www.gravatar.com` to the img-src directive alongside the existing `*.gravatar.com`.

File changed: `next.config.js` — one-line addition to admin CSP img-src.

All quality gates pass (typecheck, lint, integration tests).
