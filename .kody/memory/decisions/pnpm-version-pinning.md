---
title: pnpm Version Pinned to 10.33.0
type: decision
updated: 2026-05-13
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1609
---

The project pins `pnpm` to `10.33.0` via the `packageManager` field in `package.json`. This field is read by corepack, making the version explicit and reproducible across local dev, CI, and any runner environment.

## Why Pin

Kody runner images activate `pnpm@latest` (11.x) by default. pnpm 11 introduced stricter `overrides`-config validation — it rejects the existing lockfile with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` even though pnpm 10 reads the same lockfile without complaint. Pinning to 10.33.0 eliminates the version mismatch between runner and the lockfile format.

## Related

- [architecture.md](../architecture.md) — tooling section
