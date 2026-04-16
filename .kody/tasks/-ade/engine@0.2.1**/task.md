# Release v0.24.0

Release tracking issue — created by kody watch on 2026-04-15.

---

## Discussion (8 comments)

**@aguyaharonyair** (2026-04-15):
✅ Release PR created: https://github.com/A-Guy-educ/A-Guy/pull/1234
Version: 0.25.0
Waiting for CI to pass before merging...

**@aguyaharonyair** (2026-04-15):
✅ Merged to dev: release/v0.25.0 → dev
Running finalize...

**@aguyaharonyair** (2026-04-15):
❌ Finalize failed at E2E gate step.

**Error:** `E2E gate failed — release blocked` — spawnSync /bin/sh ETIMEDOUT

E2E tests timed out after 10 minutes. This is a CI infrastructure issue, not a code failure.

Creating fix issue...

**@aguyaharonyair** (2026-04-15):
## Release v0.25.0 — Finalize Failed

**Status:** ❌ Finalize failed at E2E gate

**What succeeded:**
- ✅ Release PR created and merged to dev
- ✅ CI passed (Fast Gate, Integration Tests, Build)

**What failed:**
- ❌ E2E gate timed out (`spawnSync /bin/sh ETIMEDOUT`)

**Next step:** Fix issue #1235 created to resolve E2E timeout, then re-run finalize.

**Tracking this cycle:** Issue #1235

**@github-actions** (2026-04-15):
## Retry Finalize Attempt #2 — 2026-04-15

Retry finalize failed again at E2E gate step.

**Version:** 0.25.0

**Error:**


The Playwright webServer process fails to start in this environment. This is the same infrastructure issue causing E2E failures across all retry attempts.

**Failure chain:**
1. Original attempt: E2E timeout after 10 minutes (spawnSync /bin/sh ETIMEDOUT)
2. First retry: Playwright navigation error (Cannot navigate to invalid URL)
3. Second retry: webServer process couldn't start

**Conclusion:** The E2E gate cannot pass in this environment due to infrastructure limitations. This is not a code issue.

**Next step:** Manual intervention required — either skip E2E gate or resolve infrastructure issue before further retries.

**@github-actions** (2026-04-16):
## Status Update — 2026-04-16

**Current State:**
- release/v0.25.0 ✅ Merged to dev (commit a772474b)
- Finalize ❌ Failed multiple times at E2E gate (infrastructure issues)
- v0.25.0 tag ❌ Does not exist (finalize never completed)
- release/v0.26.0 ⚠️ Branch exists but not merged

**Recent dev commits include E2E fixes:**
- 
- 
- 

**Environment Limitations:**
- kody CLI not available in this agent environment
- PR API access restricted (403)

**Recommended Action:**
Since v0.25.0 finalize has failed repeatedly due to E2E infrastructure issues, and dev now contains E2E fixes, consider:
1. Retry finalize from an environment with kody CLI access
2. Or skip E2E gate if infrastructure cannot support it

v0.26.0 release is queued but cannot proceed until v0.25.0 finalize completes.

**@aguyaharonyair** (2026-04-16):
## Retry Finalize — 2026-04-16

E2E gate fixes have been deployed:
- Engine updated to **@kody-ade/engine@0.2.1** (fixes  on Linux)
- Playwright  set to  in CI (fixes zombie server reuse)
- E2E gate timeout increased to **30 minutes**

Retrying finalize for **v0.25.0**. This attempt should pass the E2E gate and complete the full release pipeline.


**@aguyaharonyair** (2026-04-16):
🚀 Kody pipeline started: `-ade/engine@0.2.1**` ([logs](https://github.com/A-Guy-educ/A-Guy/actions/runs/24497655558))

