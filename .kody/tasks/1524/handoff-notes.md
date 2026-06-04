## CI Fix for PR #1524

### Root Cause
`pnpm format:check` was failing because `CHANGELOGOG.md` had Prettier formatting deviations. The CI log showed `kody.config.json` flagged but local check showed `CHANGELOGOG.md` — the file may have been updated between CI run and local check.

### Fixes Applied
1. **`CHANGELOGOG.md`**: Ran `pnpm format -- CHANGELOGOG.md` to auto-fix Prettier deviations

### Verification
All quality gates pass: typecheck, lint, format:check.

### Status
Format check now green. CI should be green on re-run.
