## Task 2338 — CI failure on PR #2249-docs-drift-admin-components-2161

### Root Cause
CI workflow run 26801418722 failed at `pnpm format:check` because `kody.config.json` had formatting issues:
- Arrays were spread across multiple lines instead of single-line format
- Missing trailing newline at end of file

### Fix Applied
Commit `6278b770c` ("fix(ci): format kody.config.json") already applied the fix by running `prettier --write kody.config.json`. The fix reformatted array members to single lines and added the trailing newline.

### Current State
- HEAD (`a5a72e8c9`) includes the fix commit `6278b770c`
- All quality gates pass locally (`pnpm ci:local` / `mcp__kody-verify__verify` → ok: true)
- No additional changes needed — the CI failure was from a pre-fix run
