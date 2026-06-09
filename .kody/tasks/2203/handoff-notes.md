## Fix Summary

**Root cause**: `ai-docs-refresh.yml` had `version: 10` hardcoded in the `pnpm/action-setup@v4` step (line 30), but `package.json` already pins the pnpm version via the `packageManager` field (`pnpm@10.33.0`). The pnpm action-setup v4 detects this duplicate version specification and fails with `ERR_PNPM_BAD_PM_VERSION`.

**What changed**: Removed the `with: version: 10` block from the Setup pnpm step in `.github/workflows/ai-docs-refresh.yml`. The workflow now defers to the `packageManager` field for pnpm version, which is the correct single source of truth.

**Why this is the right fix**: When `packageManager` is set in `package.json`, pnpm v10+ requires that the action-setup action NOT also specify a version — the two conflict. Removing the explicit version from the workflow lets the action read from `packageManager`, keeping one authoritative version source.
