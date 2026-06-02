## Task 1659: Kody Inbox Feed

**What was done:** Removed explicit `version: 10` from `pnpm/action-setup` step in `.github/workflows/repo-hygiene-report.yml`. The `pnpm/action-setup@v4` action reads the pnpm version automatically from the `packageManager` field in `package.json` (`pnpm@10.33.0`). Having an explicit `version: 10` caused a mismatch/conflict.

**Why it matters:** The workflow was failing due to version conflict between the explicit `version: 10` and the locked `pnpm@10.33.0` in package.json.

**Files changed:**
- `.github/workflows/repo-hygiene-report.yml` — removed `with: version: 10` block from pnpm/action-setup step
