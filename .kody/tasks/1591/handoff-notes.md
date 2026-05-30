# PR #1591 CI Fix

## What was failing
`pnpm format:check` was failing on `kody.config.json` — Prettier detected
formatting drift (array items were multi-line, should be condensed).

## Root cause
Prettier formatted the `operators` and `versionFiles` arrays from multi-line
to single-line compact style.

## Fix applied
Ran `npx prettier --write kody.config.json` — the file was reformatted.

## Verification
All quality gates pass: typecheck ✓, lint ✓, format:check ✓ (post-fix).
