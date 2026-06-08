## Fix: CSP test assertions didn't match the actual fix (CI failure)

**Root cause:** The PR #2379 fixed the CSP img-src directive in `next.config.js` by adding explicit entries `gravatar.com www.gravatar.com`. However, two existing tests in `csp-vercel-feedback-admin.int.spec.ts` still expected the wildcard pattern `*.gravatar.com` which was the incorrect form. The new test (added by the same PR) at line 119 correctly expected `www.gravatar.com` and passed — the two older tests failed because they expected the wrong pattern.

**Failing tests:**
- Line 95: expected `*.gravatar.com` but CSP has `gravatar.com www.gravatar.com`
- Line 116: regex `/\*\.gravatar\.com/` but CSP has `gravatar.com www.gravatar.com`

**Fix:** Updated both assertions to check for `gravatar.com` AND `www.gravatar.com` using `.toContain()` instead of wildcard patterns, matching what the actual CSP fix uses.

**Files changed:**
- `tests/int/csp-vercel-feedback-admin.int.spec.ts` — lines 93-96 and 113-117

**No follow-ups needed** — targeted assertion corrections only.
