## Fix: Admin Dashboard Footer vdev Placeholder

**Root Cause:** The `VersionInfo` component at `src/ui/admin/VersionInfo/index.tsx` used `process.env.NEXT_PUBLIC_APP_VERSION || 'dev'` as the version source. Since `NEXT_PUBLIC_APP_VERSION` was never set in the environment, it always fell back to `'dev'`, displaying as `vdev` in the footer.

**Fix:** Changed the component to read version directly from `package.json` using the Vite `?raw` import syntax:
```tsx
import packageJsonRaw from '../../../../package.json?raw'
const packageJson = JSON.parse(packageJsonRaw)
const VERSION = packageJson.version || 'dev'
```

**Files Changed:**
- `src/ui/admin/VersionInfo/index.tsx` - Fixed version source from env var to package.json
- `src/env.d.ts` - Added TypeScript declaration for `*.json?raw` imports
- `src/types/package-json-raw.d.ts` - Additional declaration file for `package.json?raw`
- `tests/unit/admin/version-info.test.tsx` - Unit test that verifies version display shows actual version (v0.25.10) not placeholder (vdev)

**Note:** The prior art task `.tasks/260214-version-info-footer/` had the same intended fix (import package.json as raw) but it appears the implementation was not completed - the component was still using the env var fallback.