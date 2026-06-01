## CI Fix for PR #1524

### Root Cause
`pnpm format:check` was failing because `kody.config.json` had Prettier formatting deviations. Secondary issue: `src/payload-types.ts` was stale (not regenerated after schema changes in this branch), causing `pnpm typecheck` to fail.

### Fixes Applied
1. **`kody.config.json`**: Ran `pnpm format -- kody.config.json` to auto-fix Prettier deviations
2. **`src/payload-types.ts`**: Ran `pnpm generate:types` to regenerate stale types, then staged the result

### Verification
All quality gates pass: typecheck, lint, format:check.

### Status
Both files staged and verified. CI should now be green.
