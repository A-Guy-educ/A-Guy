## Task 2430: Verify CSP fix on fly.dev preview

Verified the CSP fix from PR #2430 / task #2417 is deployed and correct on the fly.dev preview URL.

**Verification performed:**
1. Navigated to `https://kp-866cab-8111e4-pr-2430.fly.dev/admin` — redirects to login (admin requires auth)
2. Ran `curl -sI` against the same URL to inspect CSP response header
3. Confirmed `img-src ... *.gravatar.com` (wildcard) is present in the deployed CSP
4. All 4 CSP integration tests pass (`pnpm exec vitest run tests/int/csp-vercel-feedback-admin.int.spec.ts`)
5. Quality gates (typecheck, lint, tests): all green

**No code changes were needed** — the existing fix (`gravatar.com` → `*.gravatar.com` in next.config.js line 185) was already correct and is now confirmed deployed on the preview.
