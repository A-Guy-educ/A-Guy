## Status: Code fix complete, environmental configuration pending

**Root cause (already fixed):** `media-cleanup.yml` used `${{ secrets.CRON_ENDPOINT }}` with `environment: production`, requiring an environment-scoped secret that was never configured.

**Fix already applied (commit `705acaf3c`):**
- `CRON_ENDPOINT` changed from `${{ secrets.CRON_ENDPOINT }}` to `${{ vars.CRON_ENDPOINT }}` (URLs are not secrets)
- `environment: production` block removed
- `env:` block moved to job-level
- Workflow header comments updated to distinguish vars from secrets
- Test file `tests/int/media-cleanup-workflow.int.spec.ts` updated to match

**Verification:**
- Workflow YAML is correct (no environment block, uses `vars.CRON_ENDPOINT`)
- Integration tests pass: `pnpm exec vitest run tests/int/media-cleanup-workflow.int.spec.ts` → 10/10 pass
- `exercise-conversion-runner.yml` uses the same `vars.PREVIEW_URL` pattern without issues

**Remaining blocker:** `CRON_ENDPOINT` repository variable is not set in GitHub Settings > Variables > Actions. This is an infrastructure configuration step — the code is correct and the tests verify it.

**Action required:** Someone with repo admin access must add `CRON_ENDPOINT` as a GitHub Actions repository variable (pointing to the production app URL). Until then, the scheduled workflow will continue to fail the guard check.
