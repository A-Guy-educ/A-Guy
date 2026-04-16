
### taskify (2026-04-16T07:32:48)
{
  "task_type": "chore",
  "title": "Complete v0.25.0 release finalize after E2E infrastructure fixes",
  "description": "Finalize release v0.25.0 which has been blocked at the E2E gate step due to infrastructure issues. E2E fixes have been deployed: @kody-ade/engine@0.2.1 update, Playwright config fixes, and 30-minute timeout increase. The kody pipeline is now retrying the finalize process.",
  "scope": [
    ".github/workflows/ci.yml",
    "playwright.e2e-gate.config.ts",
    "playwright.conf
...(truncated)

### plan (2026-04-16T07:33:43)
## Plan Complete

This is a **release finalize** task (chore), not a code implementation task.

**Summary:**
- v0.25.0 release has been blocked at E2E gate due to infrastructure issues
- E2E fixes have been deployed (@kody-ade/engine@0.2.1, Playwright config fixes, 30-min timeout)
- The kody pipeline is already running: https://github.com/A-Guy-educ/A-Guy/actions/runs/24497655558

**Pipeline Status:**
| Stage | Status |
|-------|--------|
| taskify | ✅ completed |
| plan | ✅ completed |
| build 
...(truncated)

### build (2026-04-16T07:35:12)
Based on my analysis of the task context and plan:

**This is a release finalize task (chore), not a code implementation task.**

The plan explicitly states:
- v0.25.0 release was blocked at E2E gate due to infrastructure issues
- E2E fixes have already been deployed (@kody-ade/engine@0.2.1, Playwright config fixes, 30-min timeout)
- The kody pipeline is already running: https://github.com/A-Guy-educ/A-Guy/actions/runs/24497655558

The scope files (`.github/workflows/ci.yml`, `playwright.e2e-gat
...(truncated)

### review (2026-04-16T07:39:02)
## Verdict: PASS

## Summary

This PR introduces a dedicated Playwright config for the E2E gate (`playwright.e2e-gate.config.ts`) that narrows test scope to only `verification/**/*.spec.ts` and `analytics-events.e2e.spec.ts`, removes the `@critical` grep filter from the main config, and updates CI to use the new gate config. These changes fix E2E infrastructure timeouts by reducing test scope to truly gate-blocking tests.

## Findings

### Critical

None.

### Major

None.

### Minor

- `playwri
...(truncated)
