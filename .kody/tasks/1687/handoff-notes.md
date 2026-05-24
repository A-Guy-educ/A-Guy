# CI Fix: Prettier formatting on kody.config.json

## What was failing
The CI "Fast Gate" step was failing at the Prettier format check. The error log showed:
```
[warn] kody.config.json
Code style issues found in the above file. Run Prettier with --write to fix.
```

## What was done
Ran `pnpm format` locally which reformatted `kody.config.json`. The file's content was valid JSON but had formatting inconsistencies that Prettier's `--check` mode flags. After running the formatter, all quality gates passed (typecheck, lint, format check, tests).

## Verification
- `pnpm format:check` now returns "All matched files use Prettier code style!"
- `mcp__kody-verify__verify` returned `ok: true`
