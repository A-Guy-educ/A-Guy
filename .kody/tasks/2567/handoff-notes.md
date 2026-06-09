Fixed GET /api/health returning version: "unknown" by replacing `process.env.npm_package_version` with a direct `require('../../../../package.json')` read.

**Root cause**: `npm_package_version` is only set at npm runtime (via `npm start` injecting it into `process.env`), not at Next.js runtime. The VersionInfo admin component already used the correct approach of reading package.json directly.

**Changes**:
- `src/app/api/health/route.ts`: replaced `process.env.npm_package_version || 'unknown'` with `packageJson.version || 'unknown'` where `packageJson` is loaded via `require('../../../../package.json')`
- `tests/int/health.api.int.spec.ts`: added new test "returns the actual app version from package.json, not unknown" that asserts `version !== 'unknown'` and matches `package.json` version

**Pattern**: mirrors `src/ui/admin/VersionInfo/index.tsx` which already correctly reads package.json at build time.
