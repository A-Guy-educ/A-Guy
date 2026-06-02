## Fix Summary

**Failing test**: `tests/int/media-cleanup-workflow.int.spec.ts` → "should use required secrets"

**Root cause**: The test expected the literal string `secrets.CRON_ENDPOINT` to appear in the workflow's `run:` script, but the workflow correctly passes secrets via the `env:` block (the standard GitHub Actions pattern). The run script references `$CRON_ENDPOINT` (shell variable), not `secrets.CRON_ENDPOINT`.

**Fix**: Updated the test to verify:
1. The `env:` block contains `${{ secrets.CRON_ENDPOINT }}` and `${{ secrets.CRON_SECRET }}`
2. The run script uses shell variables `$CRON_ENDPOINT` and `$CRON_SECRET`

The workflow itself was correct — only the test assertion was wrong.
