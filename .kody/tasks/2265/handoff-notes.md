# Task 2265: Fix media-cleanup-workflow integration test

## What I did

Fixed the failing integration test `tests/int/media-cleanup-workflow.int.spec.ts` which was checking for `secrets.CRON_ENDPOINT` in the workflow's `run` script string, but the workflow correctly uses GitHub Actions secrets via the separate `env:` block.

**Root cause:** The test at line 75 used `expect(runScript).toContain('secrets.CRON_ENDPOINT')` but the workflow's `run` script uses shell variables (`$CRON_ENDPOINT`, `$CRON_SECRET`) populated from the `env:` block — which is the correct GitHub Actions pattern that prevents secrets from appearing in logs.

**Fix:** Changed the assertion to verify the secrets are configured in the `env` block of the step rather than in the `run` string.

**Before:** `expect(runScript).toContain('secrets.CRON_ENDPOINT')`
**After:** `expect(cleanupStep.env.CRON_ENDPOINT).toContain('secrets.CRON_ENDPOINT')`

## Why

The workflow correctly passes secrets via the `env:` block (`CRON_ENDPOINT: ${{ secrets.CRON_ENDPOINT }}`), which is the documented GitHub Actions pattern. The test was checking the wrong part of the YAML structure.
