## Fix: Admin Dashboard Footer — Missing Build Date (CI Regression)

**Root Cause:** The `VersionInfo` component (`src/ui/admin/VersionInfo/index.tsx`) was updated in task 2274 to read version from `package.json` (fixing the `vdev` placeholder), but the build date display was omitted from the implementation. The component only rendered `v{VERSION}` without `Built {date}`.

**CI Failure:** The test `tests/unit/admin/version-info.test.tsx` (from task 2274) had a third test "displays the build date" that expected `Built 2026-05-31`, but the component never rendered it — causing the test to fail.

**Fix Applied:**
1. Updated `src/ui/admin/VersionInfo/index.tsx` to add `const buildDate = process.env.BUILD_DATE || new Date().toISOString().split('T')[0]` and render `· Built {buildDate}` alongside the version string.
2. Updated `tests/unit/ui/admin/version-info.test.tsx` — a pre-existing test file with a conflicting assertion (`should not render a build date string`) that encoded the old broken behavior. Changed to `should render a build date string` to align with the intended fix.

**Files Changed:**
- `src/ui/admin/VersionInfo/index.tsx` — added build date rendering
- `tests/unit/ui/admin/version-info.test.tsx` — updated conflicting assertion

**Verification:** All 6 tests in both version-info test files pass. Full quality gates (typecheck, lint, unit tests) pass.
