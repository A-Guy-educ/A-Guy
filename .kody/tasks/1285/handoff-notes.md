## Handoff Notes

### What was failing
CI `format:check` step was failing — the log truncated the filename to `kody.config.json` but the actual file with drift was `CHANGELOGOG.md`.

### What was changed
`CHANGELOGOG.md` — reformatted with `prettier --write`.

### Why it fixes the failure
The format check (`prettier --check`) requires all files to match Prettier's formatting. `CHANGELOGOG.md` had drift (likely from a merge or manual edit). Running `prettier --write` auto-fixes it.

### Verification
All quality gates pass (`typecheck`, `lint`, `format:check`).
