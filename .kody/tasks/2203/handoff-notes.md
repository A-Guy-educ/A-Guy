DONE

COMMIT_MSG: fix(ci): align pnpm version in doc-link-fixer workflow with package.json

The Doc Link Fixer (Daily) workflow was failing at the pnpm setup step because:
- `.github/workflows/doc-link-fixer.yml` specified `version: 9`
- `package.json` specifies `"packageManager": "pnpm@10.33.0"`

The `pnpm/action-setup@v4` action rejects conflicting versions. Fixed by updating
the workflow's `version` from `9` to `10.33.0` (line 34 of the workflow file).

Note: A prior run on this same PR already fixed `.github/workflows/ai-docs-refresh.yml`
for the same issue. This run fixes the remaining `doc-link-fixer.yml` workflow.
