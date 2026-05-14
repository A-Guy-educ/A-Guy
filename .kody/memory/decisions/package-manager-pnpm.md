---
title: pnpm version via packageManager field
type: decision
updated: 2026-05-14
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1609
  - https://github.com/A-Guy-educ/A-Guy/pull/1602
---

## Decision

Use the `packageManager` field in `package.json` to pin pnpm version, not the `version` in `pnpm/action-setup` CI action.

## Why

The Kody runner image uses `pnpm@latest` (11.x), which rejects the lockfile with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` due to stricter overrides-config checks. The project's lockfile is compatible with pnpm 10.33.0.

## Implementation

- `package.json` includes `"packageManager": "pnpm@10.33.0"`
- CI removes `version: 10` from all `pnpm/action-setup@v4` steps — the action reads the version from `packageManager`
- This is the single source of truth for pnpm version

## Trade-offs

- Developers must use the specified pnpm version (or newer if lockfile is regenerated)
- CI is simpler — no version mismatch between action and project
- Runner images can be updated without breaking the build
