## Merge conflict resolution for PR #2402

**File resolved:** `tests/int/csp-vercel-feedback-admin.int.spec.ts`

**Conflict:** The gravatar img-src test had two versions:
- HEAD (PR branch): single test with comment `*.gravatar.com (wildcard) to cover www.gravatar.com and other subdomains`
- origin/dev: same test but with a more explanatory comment + an additional second test validating the wildcard pattern with `toMatch`

**Resolution:** Took HEAD's first test (preserves PR authorship), included origin/dev's second test (adds CSP wildcard validation). Both sides agreed on `*.gravatar.com` — the conflict was purely about test structure/comment style.

**Verification:** ESLint passed with no errors. No conflict markers remain.
