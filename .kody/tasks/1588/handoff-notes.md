# Merge Conflict Resolution for #1587

## What was done

Resolved 7 identical conflicts in `.github/workflows/ci.yml`. The conflict was purely cosmetic — the pnpm version was specified as `10.33.0` (HEAD/PR branch) vs `'10.33.0'` (origin/dev) in all 7 occurrences.

## Resolution

Kept the HEAD/PR branch version: `version: 10.33.0` (without quotes), consistent with the `packageManager` field in `package.json` which uses `pnpm@10.33.0` without quotes around the version.

## Conflicts resolved

- `fast-gate` job pnpm setup
- `integration-tests` job pnpm setup
- `build` job pnpm setup
- `e2e-gate` job pnpm setup
- `e2e-system-tests` job pnpm setup
- `qa-scenarios-core` job pnpm setup
- `qa-scenarios-full` job pnpm setup

## Note

The lint warning in `src/ui/web/shared/LatexDocumentViewer/index.tsx:113` is pre-existing and unrelated to this merge.
