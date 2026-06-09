## Fix Summary

**Root cause**: `media-cleanup.yml` treated `CRON_ENDPOINT` (a base URL) as a GitHub Actions secret scoped to the `production` environment. Since no such secret was configured, the workflow's guard check `if [ -z "$CRON_ENDPOINT" ]` fired and caused exit code 1.

**What changed**: 
- `CRON_ENDPOINT` changed from `${{ secrets.CRON_ENDPOINT }}` to `${{ vars.CRON_ENDPOINT }}` — URLs are not secrets, they belong in repository variables.
- Removed `environment: production` block — the `exercise-conversion-runner.yml` workflow already uses `vars.PREVIEW_URL` for its base URL without any environment block, establishing the correct pattern.
- `env:` block moved from step-level to job-level for cleaner structure.
- Updated workflow header comments to distinguish GitHub Variables (CRON_ENDPOINT) from GitHub Secrets (CRON_SECRET).
- Updated test file `tests/int/media-cleanup-workflow.int.spec.ts` to match the new structure.

**Why this is the right fix**: A URL is not a secret — it doesn't need to be encrypted or protected like a token. Using a repository variable avoids the environment-locked secret configuration that was causing the failure, while `CRON_SECRET` (the actual auth token) remains a secret.
