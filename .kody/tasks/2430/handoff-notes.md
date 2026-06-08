## Merge Conflict Resolution — PR #2430

**File:** `tests/int/csp-vercel-feedback-admin.int.spec.ts`

**Conflict type:** Symmetric — both sides expected `*.gravatar.com` in img-src, but differed in comment detail and test coverage.

**Resolution:** Took origin/dev's version which had:
- More detailed comments explaining why `*.gravatar.com` is needed (CSP wildcard syntax)
- An additional test case covering the `www.gravatar.com` vs `gravatar.com` distinction

**Verification:** All 5 tests in the file pass (224ms).
