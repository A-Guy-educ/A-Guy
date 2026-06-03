## Handoff Notes

### What was failing
CI `format:check` step was failing with Prettier formatting drift in `kody.config.json`.

### What was changed
`kody.config.json` — reformatted with Prettier (`pnpm format`).

### Why it fixes the failure
The format check (`prettier --check`) requires all files to match Prettier's formatting. `kody.config.json` had drift (likely from a merge or manual edit). Running `pnpm format` auto-fixes it.

### Verification
All quality gates pass (`typecheck`, `lint`, `format:check`).
