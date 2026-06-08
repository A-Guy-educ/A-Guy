## Root Cause

`atlas-integration.yml` had `version: 9` hardcoded in `pnpm/action-setup@v4`, while `package.json` pins `pnpm@10.33.0` via the `packageManager` field. The pnpm/action-setup action errors when both are specified.

## Status

Fix already present in dev (commit 4a6a5b370). CI run 27123713146 hit an older commit (690058fb8) that predated the fix. The fix removes `version: 9` from the `with:` block in `.github/workflows/atlas-integration.yml`, allowing the action to read the version from `packageManager` in package.json. No code changes were needed in this session — the fix was already merged.

## Verification

- `pnpm/action-setup@v4` step in atlas-integration.yml has no `version` parameter (fix confirmed)
- QA gates (typecheck, lint) passed with `mcp__kody-verify__verify`
