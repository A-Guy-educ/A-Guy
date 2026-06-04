Fixed CSP img-src policy blocking Gravatar avatar images on /admin routes.

Root cause: The previous fix from task #1791 added `gravatar.com` to the img-src directive for admin routes, but `gravatar.com` as a CSP host-source does not reliably match `www.gravatar.com` subdomain in all browser contexts. The Gravatar avatar URL is `https://www.gravatar.com/avatar/{hash}` which is a subdomain of `gravatar.com`.

Fix: Changed `gravatar.com` to `*.gravatar.com` in the admin route CSP img-src directive (next.config.js line 185). The `*.gravatar.com` pattern explicitly matches all subdomains including `www.gravatar.com`, `secure.gravatar.com`, and CDN subdomains (`0.gravatar.com`, `1.gravatar.com`, etc.).

Files changed:
- `next.config.js` — changed `gravatar.com` to `*.gravatar.com` in admin CSP img-src
- `tests/int/csp-vercel-feedback-admin.int.spec.ts` — updated test to check for `*.gravatar.com` instead of `gravatar.com`

Verification:
- `pnpm exec vitest run tests/int/csp-vercel-feedback-admin.int.spec.ts` — 4 tests pass
- `pnpm lint` — passes (warning in unrelated file)
- `mcp__kody-verify__verify` — ok: true

Note: Pre-existing typecheck issues in `src/app/(frontend)/stats/_components/StudyActivityChart.tsx` (recharts module resolution) may appear in local typecheck runs but do not block the quality gate in the verify environment.
