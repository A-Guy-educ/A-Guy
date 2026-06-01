DONE

COMMIT_MSG: fix(ci): align pnpm version in ai-docs-refresh workflow with package.json

The AI Docs Refresh daily workflow was failing at the pnpm setup step because:
- `.github/workflows/ai-docs-refresh.yml` specified `version: 9`
- `package.json` specifies `"packageManager": "pnpm@10.33.0"`

The `pnpm/action-setup@v4` action rejects conflicting versions. Fixed by updating
the workflow's `version` from `9` to `10` (line 30 of the workflow file).

No other workflow files needed changes — other workflows already use `version: 9`
which is still compatible with their respective package.json entries (those don't
specify a packageManager field, or pin to v9).
