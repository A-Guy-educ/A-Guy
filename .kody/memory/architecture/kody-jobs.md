---
title: Kody Maintainability Jobs
type: architecture
updated: 2026-05-09
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1502
---

The project runs 7 evergreen Kody jobs under `.kody/jobs/` that perform recurring repo-maintenance work via the existing `job-scheduler`. Each job is a coordinator — it inspects GitHub state via `gh` and delegates actual work to `/kody chore` via tracked issues. Jobs never edit code or commit.

## The 7 Jobs

| Job | Cadence | Pattern |
|---|---|---|
| `dependency-bump` | Mon weekly | delegate-to-chore |
| `security-audit` | daily | delegate-to-chore |
| `type-debt` | Wed weekly | delegate-to-chore |
| `dead-code-sweep` | 1st of month | delegate-to-chore |
| `doc-drift` | Tue weekly | report-driven |
| `flaky-test-quarantine` | daily | delegate-to-chore |
| `coverage-floor` | daily | delegate-to-chore |

## Two Orchestration Patterns

**delegate-to-chore (6 jobs):** Job wakes up, checks for an in-flight tracking issue (label: `kody:<job-slug>`), and either nudges, opens, or skips. Actual work is delegated to the `chore` executor via the `/kody chore: ...` directive in the issue body.

**report-driven (1 job — `doc-drift`):** Job consumes a scanner-produced report at `.kody/reports/doc-drift.md`. Reads YAML frontmatter, dedupes against open issues by finding-id, and opens one issue per unescalated finding. Issue bodies describe the actual finding (severity, src/doc commit counts, expected doc paths, recent SHAs) rather than requesting a scan.

The other six jobs can be migrated to report-driven once the scanner primitive is built; deferred until there's evidence the delegate-to-chore pattern hits limits.

## Cadence Guards

Each job has an internal cadence check (20-hour minimum between runs, plus day-of-week / day-of-month guards). The scheduler ticks every 15 minutes via `kody.yml`; `job-scheduler` fans out to `job-tick --job <slug>` per file under `.kody/jobs/`.

## State Backend

Job state uses `local-file` backend — per-tick state lives in the Actions cache (mirrors `missions`). Reports remain on the default branch for dashboard visibility.

## Label Convention

All jobs create their tracking label on first use if missing: `kody:<job-slug>`. The label is required for the "is X in flight?" check on subsequent ticks.
