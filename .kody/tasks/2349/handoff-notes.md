# Task 2349: dev CI hygiene fix

## What I did
Fixed the `repo-hygiene-report.yml` workflow to use `pnpm@10.33.0` (matching `package.json` `packageManager` spec) instead of `pnpm@10`.

## Why
The GitHub Actions workflow `repo-hygiene-report.yml` used `pnpm/action-setup@v4` with `version: 10`, but `package.json` specified `packageManager: "pnpm@10.33.0"`. This version mismatch caused `ERR_PNPM_BAD_PM_VERSION` and the workflow failed at the `Setup pnpm` step.

## Key files changed
- `.github/workflows/repo-hygiene-report.yml`: Changed `version: 10` → `version: 10.33.0`

## Pre-existing issues (not fixed, informational only)
- `knip` reports a parse error in `src/payload.config.ts` (`ParseError: Unexpected token, expected ","`). This has been failing since at least May 24 but does not cause CI failure because `repo-hygiene-report.ts` script always exits 0.
- A test failure in `tests/unit/components/split-pane-layout-mobile-chat.test.tsx` was observed during verify, but it is unrelated to this change.
