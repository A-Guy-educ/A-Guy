# Task 2262: dev CI red on b655aa2 — CodeQL

## What was wrong
The `ai-docs-refresh.yml` workflow specified `version: 10` for pnpm/action-setup, while:
- `package.json` has `"packageManager": "pnpm@10.33.0"`
- `doc-link-fixer.yml` uses `version: 10.33.0`

This version mismatch caused `ERR_PNPM_BAD_PM_VERSION` when the workflow ran.

## Fix applied
Changed `.github/workflows/ai-docs-refresh.yml` line 30 from `version: 10` to `version: 10.33.0`.

## Verification
Quality gates passed (typecheck, lint, tests).
