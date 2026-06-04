## Fix Summary

**Issue**: Monaco editor web workers (blob: workers) blocked by CSP on /admin routes — `worker-src` directive was missing from the admin route CSP.

**Root Cause**: The admin routes CSP in next.config.js did not include a `worker-src` directive, so blob URL workers created by Monaco editor were blocked.

**Files Changed**:
1. `next.config.js` — Added `worker-src 'self' blob:;` to the admin routes CSP header
2. `tests/int/csp-vercel-feedback-admin.int.spec.ts` — Added `extractWorkerSrc` helper and test case asserting `worker-src` contains `blob:` for admin routes

**Repro Test**: `tests/int/csp-vercel-feedback-admin.int.spec.ts` — "should include worker-src with blob: for /admin routes to allow Monaco editor workers"

**Verification**: Test passes; all 5 CSP tests green; `pnpm ci:local` passes.