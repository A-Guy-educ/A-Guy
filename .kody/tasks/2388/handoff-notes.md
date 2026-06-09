## CI Fix: CSP Test Assertions for gravatar.com

**Root cause**: The CSP integration tests at lines 95 and 116 expected `*.gravatar.com` (wildcard format) but the implementation uses `gravatar.com www.gravatar.com` (explicit format). Both formats are CSP-valid and allow `www.gravatar.com`, but the tests weren't updated when the explicit format was chosen.

**What failed**: Two tests in `tests/int/csp-vercel-feedback-admin.int.spec.ts`:
1. `should include gravatar.com in img-src for /admin routes` (line 95) — expected `*.gravatar.com`
2. `should allow www.gravatar.com in img-src for /admin routes (not just gravatar.com)` (line 116) — regex expected `*.gravatar.com`

**Fix applied**: Updated both tests to check for `gravatar.com` AND `www.gravatar.com` explicitly (matching the implementation). The tests now correctly assert that both domains are present in img-src, which is the CSP-valid way to allow www.gravatar.com.

**Note**: The `*.gravatar.com` wildcard format (which matches any subdomain) would also be valid CSP and more concise. The current implementation uses explicit domains which is fine — both approaches correctly allow www.gravatar.com.

**Files changed**: `tests/int/csp-vercel-feedback-admin.int.spec.ts`
