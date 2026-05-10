---
title: Kody Maintenance Jobs
type: architecture
updated: 2026-05-10
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1502
---

Kody jobs are autonomous agents that perform recurring repo-maintenance tasks via gh commands and tracked issues. They live under .kody/jobs/ and are scheduled by job-scheduler.

## Available Jobs

| Job | Cadence | Pattern |
|-----|---------|---------|
| dependency-bump | Weekly Monday | delegate-to-chore |
| security-audit | Daily | delegate-to-chore |
| type-debt | Weekly Wednesday | delegate-to-chore |
| dead-code-sweep | 1st of month | delegate-to-chore |
| doc-drift | Weekly Tuesday | report-driven |
| flaky-test-quarantine | Daily | delegate-to-chore |
| coverage-floor | Daily | delegate-to-chore |
| memorize | Every 20 hours | synthesis |

## Two Patterns

Delegate-to-chore: Job wakes, checks for in-flight tracking issue (by label), nudges/opens/skips. Actual work delegated to /kody chore: in the issue body.

Report-driven (doc-drift): Job consumes a scanner-produced report at .kody/reports/doc-drift.md, dedupes against open issues by finding-id, opens one issue per new finding.

## State Backend

Jobs use local-file state backend (kody.config.json: jobs.stateBackend). State lives in .kody/jobs/*.state.json files in the Actions cache.

## Label Convention

Jobs use kody:<job-name> labels (e.g., kody:deps-bump, kody:security-audit). If label doesn't exist, create it before creating the first issue.

## Related

- [architecture](./architecture.md) — Project tech stack
- [conventions](./conventions.md) — Coding standards
