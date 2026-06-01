# Issue #2303: dev CI is red — Kody auto-fix

## What

The Fast Gate CI job was failing on the "Check formatting with Prettier" step. The issue was a formatting violation in `kody.config.json`.

## Fix

Ran `pnpm exec prettier --write kody.config.json` which fixed the formatting issue. After the fix, all quality gates pass (typecheck, lint, format, unit tests).

## Files Changed

- `kody.config.json` — Prettier formatting fix only (no code changes)

## Verification

- `pnpm format:check` passes
- `pnpm ci:local` (full quality gates) passes
