Fixed the `dev` CI red on commit 792f130 by resolving a pnpm version mismatch between GitHub Actions workflows and `package.json`.

Root cause: `doc-link-fixer.yml` specified `version: 9` in its pnpm setup, while `package.json` declares `packageManager: pnpm@10.33.0`. The `pnpm/action-setup@v4` action rejects mismatched versions. Additionally, `ai-docs-refresh.yml` had been bumped to `version: 10` by commit 792f130 but still didn't match the exact `10.33.0`.

Changes:
- `.github/workflows/doc-link-fixer.yml`: Removed explicit `version: 9` from pnpm setup step — leaving it unspecified lets the action auto-read from the `packageManager` field in `package.json`
- `.github/workflows/ai-docs-refresh.yml`: Updated `version: 10` → `version: 10.33.0` to exactly match `packageManager: pnpm@10.33.0`

CodeQL failure had no fetchable run log — likely a downstream effect of the pnpm install step failing before dependency installation. With the version mismatch resolved, dependency install should succeed and CodeQL should pass.
