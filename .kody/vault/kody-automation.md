---
title: Kody Automation
type: architecture
updated: 2026-05-08
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1482
  - https://github.com/A-Guy-educ/A-Guy/pull/1456
  - https://github.com/A-Guy-educ/A-Guy/pull/1457
---

# Kody Automation

## Overview

Kody is an autonomous AI agent that handles CI automation, issue triage, and routine maintenance tasks.

## Kody Engine Version

`@kody-ade/kody-engine@latest` (pinned in `kody.yml`)

## Jobs vs Missions

**Kody engine 0.4.0 renames `mission` to `job`**:

| Old | New |
|-----|-----|
| `mission-tick` | `job-tick` |
| `mission-scheduler` | `job-scheduler` |
| `.kody/missions/` | `.kody/jobs/` |

## Job Files

Four job files under `.kody/jobs/`:
- Executable `.md` files
- Scheduled via `job-scheduler` (every 30 min)
- Dashboard at `/jobs` page

## pnpm Version Compatibility

```
engines.pnpm: ^9 || ^10 || ^11
```

Kody runners install pnpm via `npm install -g pnpm`, which resolves to 11.x. The CI workflow pre-installs pnpm 10 to avoid kody's own version-agnostic install.

```yaml
# In GitHub Actions workflow
- run: npm install -g pnpm@10
```

This ensures `isOnPath('pnpm')` short-circuits kody's install logic.

## Common Issues

### Lockfile Mismatch

pnpm 11 rejects `overrides` block mismatches with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`. Fix: ensure pnpm 10 is on PATH before kody runs.

### Mission → Job Migration

When upgrading kody engine, move files from `.kody/missions/` to `.kody/jobs/`. The engine looks for jobs in the new location by default.
