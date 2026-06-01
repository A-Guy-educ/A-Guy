# Issue #2297: Admin footer shows unversioned 'vdev' label

## What was done

**Root cause:** The `VersionInfo` component in `src/ui/admin/VersionInfo/index.tsx` used `process.env.NEXT_PUBLIC_APP_VERSION || 'dev'` to get the version. Since `NEXT_PUBLIC_APP_VERSION` was never set in the environment, it always fell back to `'dev'`, displaying `vdev` in the admin footer.

**Fix approach:** 
1. Created a new API route `src/app/api/version/route.ts` that reads the version directly from `package.json` at runtime using `fs/promises` — mirroring how the frontend `Footer` component (`src/ui/web/footer/Component.tsx`) already does it via `getVersion()`.
2. Updated `VersionInfo` to be a client component that fetches from `/api/version` on mount instead of using the missing env var.

**Files changed:**
- `src/app/api/version/route.ts` — New API endpoint returning `{ version }` from package.json
- `src/ui/admin/VersionInfo/index.tsx` — Changed from static env var to client-side fetch from `/api/version`
- `tests/e2e/admin-version-footer.e2e.spec.ts` — New E2E test verifying admin footer shows proper vX.Y.Z and matches frontend version

**Why this approach:** The frontend footer already reads version from package.json at runtime. The admin was using a different (broken) approach with an env var that was never set. Making the admin fetch from a new API endpoint aligns it with the same source of truth as the frontend while keeping the admin component as a client component (required for Payload's `beforeDashboard` slot).
