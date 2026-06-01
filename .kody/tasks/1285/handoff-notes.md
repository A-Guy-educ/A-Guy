## Handoff Notes

### What was failing
CI `format:check` step was failing with Prettier formatting drift in `kody.config.json`.

### What was changed
1. `kody.config.json` — reformatted with Prettier (`pnpm format`).
2. `src/payload-types.ts` — regenerated (`pnpm generate:types`) because the PR's schema changes made the types stale.

### Why it fixes the failure
The format check (`prettier --check`) requires all files to match Prettier's formatting. `kody.config.json` had drift (likely from a merge or manual edit). Running `pnpm format` auto-fixes it. The `generate:types:check` step requires committed types to match the current schema — the PR introduced changes that required regeneration.

### Verification
All quality gates pass (`typecheck`, `lint`, `format:check`, `generate:types:check`).
