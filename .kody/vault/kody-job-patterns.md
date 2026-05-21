---
title: Kody Job Patterns
type: architecture
updated: 2026-05-08
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1502
---

# Kody Job Patterns

Jobs under `.kody/jobs/` follow one of two execution patterns.

## Delegate-to-Chore

The job acts as a coordinator: it inspects GitHub state via `gh`, then delegates actual scanning/fixing work to `/kody chore` via a tracked GitHub issue.

Used by: `dependency-bump`, `security-audit`, `type-debt`, `dead-code-sweep`, `flaky-test-quarantine`, `coverage-floor`

**Lifecycle per tick:**

1. Check for an in-flight tracking issue (`gh issue list --label "kody:<slug>" --state open`)
2. If one exists and is recent (<7 days): emit `cursor: awaiting-pr` and exit
3. If one exists and is stale (>7 days): post one nudge comment, exit
4. Otherwise: open a new tracking issue with `/kody chore: <directive>` in the body

**One-at-a-time rule:** Exactly one issue in flight per job at any time. The job body's next-tick "is X in flight?" check depends on the label.

**Label fallback:** If `gh issue create --label kody:<slug>` fails because the label doesn't exist, run `gh label create kody:<slug>` and retry. Do not skip the label — the next-tick guard check depends on it.

**State fields:**

- `cursor`: `idle` | `awaiting-pr` | `stalled`
- `data.lastRunISO`: ISO timestamp of last tick that opened or nudged
- `data.openIssue`: number of currently-open tracking issue (or null)

## Report-Driven

The job reads a scanner-produced report file (`.kody/reports/<name>.md`) and opens one issue per finding. The job does no scanning — it only consumes the report and orchestrates the issue lifecycle.

Used by: `doc-drift`

**Report format:**

```yaml
---
slug: <slug>
generatedAt: 2026-05-08T13:00:00Z
scannerVersion: 1
findings:
  - id: <stable-finding-id>
    severity: high | medium | low
    escalation: true | false   # true = skip; this finding is already handled
    data:
      srcArea: <src path>
      # scanner-specific fields (commit counts, expected doc paths, SHAs, etc.)
---
```

**Lifecycle per tick:**

1. Read `.kody/reports/<name>.md`
2. If file is missing: narrate and exit with `cursor: idle`
3. If `report.generatedAt <= data.lastReportGeneratedAt`: no new report — exit
4. List existing open issues (`gh issue list --label "kody:<slug>"`)
5. For each finding where `escalation: false` and no open issue has that `finding.data.srcArea` in the title → open an issue with the finding's signal (severity, commit counts, expected paths, recent SHAs) rather than a generic scan request

**Issue body describes the finding, not the request.** Dashboards reading the issue tracker see actual signal, not boilerplate.

**Scanner primitive** is TBD. The report is currently hand-authored; once the scanner exists, it produces the report file on a schedule, and the job auto-detects freshness via `generatedAt`.

## Migration Path

The six delegate-to-chore jobs can be migrated to the report-driven pattern once a scanner primitive exists for each domain. Defer migration until there's evidence the delegate-to-chore pattern hits limits.
