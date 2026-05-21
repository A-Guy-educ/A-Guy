---
title: Kody Automation
type: architecture
updated: 2026-05-08
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1502
  - https://github.com/A-Guy-educ/A-Guy/pull/1503
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

Eleven job files under `.kody/jobs/`:

| Job | Cadence | Pattern |
|-----|---------|---------|
| `dependency-bump` | Mon weekly | [delegate-to-chore](./kody-job-patterns.md#delegate-to-chore) |
| `security-audit` | daily | [delegate-to-chore](./kody-job-patterns.md#delegate-to-chore) |
| `type-debt` | Wed weekly | [delegate-to-chore](./kody-job-patterns.md#delegate-to-chore) |
| `dead-code-sweep` | 1st of month | [delegate-to-chore](./kody-job-patterns.md#delegate-to-chore) |
| `doc-drift` | Tue weekly | [report-driven](./kody-job-patterns.md#report-driven) |
| `flaky-test-quarantine` | daily | [delegate-to-chore](./kody-job-patterns.md#delegate-to-chore) |
| `coverage-floor` | daily | [delegate-to-chore](./kody-job-patterns.md#delegate-to-chore) |

See [kody-job-patterns.md](./kody-job-patterns.md) for the two execution patterns.

Jobs are scheduled via `job-scheduler` (every 15 min via `.github/workflows/kody.yml` schedule trigger). Dashboard at `/jobs` page.

## State Backend

Jobs use `local-file` state backend (stored in `.kody/jobs/*.state.json`):

```json
// kody.config.json
{
  "jobs": { "stateBackend": "local-file" },
  "missions": { "stateBackend": "local-file" }
}
```

This keeps per-tick state in the Actions cache; reports live on the default branch for dashboard visibility.

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

`pnpm install --frozen-lockfile` fails with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` when the lockfile is missing `overrides` declared in `package.json`'s `pnpm.overrides`.

**Root cause** (PR #1503): Lockfile regeneration under pnpm 11 can produce a lockfile without the `overrides` block. CI workflow only fires on `pull_request` / `push to main` / `workflow_dispatch` — not on direct pushes to `dev` — so such regressions silently live on `dev`.

**Fix**: Regenerate `pnpm-lock.yaml` with pnpm 10.33.0 (matches CI's `pnpm/action-setup@v4 version: 10`). Verify with `pnpm install --frozen-lockfile` before commit.

### Mission → Job Migration

When upgrading kody engine, move files from `.kody/missions/` to `.kody/jobs/`. The engine looks for jobs in the new location by default.
