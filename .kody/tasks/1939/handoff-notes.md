# Fix: Admin Footer Shows vdev Instead of Version Number

## What

Admin footer was displaying `vdev• Built ...` instead of `v0.25.8`.

## Root Cause

`src/ui/admin/VersionInfo/index.tsx` read version from `NEXT_PUBLIC_APP_VERSION` env var, falling back to `'dev'` when unset. The frontend `Footer` correctly read from `package.json` directly.

## Fix

Changed `VersionInfo` to import `version` directly from `../../../../package.json`, matching the frontend approach. Removed the unused `VERSION` constant and the env var fallback.

## Files Changed

- `src/ui/admin/VersionInfo/index.tsx` — import version from package.json instead of env var
- `tests/e2e/admin-version-footer.e2e.spec.ts` — new e2e test verifying admin footer shows semantic version

## Verification

TypeScript passes, lint passes (no new warnings), verify tool passed.