## Root Cause

`atlas-integration.yml` had `version: 9` hardcoded in `pnpm/action-setup@v4`, while `package.json` pins `pnpm@10.33.0` via the `packageManager` field. The pnpm/action-setup action errors when both are specified.

## Fix Applied

Removed `version: 9` from the `with:` block in `.github/workflows/atlas-integration.yml`. The action now reads the version from `packageManager` in package.json, consistent with the project's established pattern (documented in `.kody/memory/decisions/package-manager-pnpm.md` and confirmed by the `ci.yml` workflow which has no version in its pnpm/action-setup steps).

## Why This Is the Right Fix

The project's convention is to pin pnpm via `packageManager` in `package.json` and leave `pnpm/action-setup` without an explicit version. Adding `version: 9` was a mistake introduced in the atlas workflow that diverged from the rest of CI.
