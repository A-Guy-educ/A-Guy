---
disabled: true
staff: cto
every: 7d
---

# Architecture Audit

## Job

Periodic **architecture-health sweep** of the codebase — boundaries and
coupling, not line-level style. Writes a single report to
`.kody/reports/architecture-audit.md`. The dashboard Reports page renders
it; the operator decides whether any finding is worth a fix PR.

Scope of the sweep:

- **Module boundaries / single responsibility** — god-modules and
  god-routes that have accreted multiple jobs.
- **Dependency direction** — layering violations (a shared/core util
  importing a feature/app layer) and any import cycles.
- **Premature / dead abstractions** — interfaces or layers with a single
  implementation and no second caller; abstractions no longer used.
- **Duplication** — logic re-implemented where an existing sibling
  already solves it.

**Cadence.** Set by the `every:` frontmatter (default `every: 7d`) and
enforced by the engine.

## Tick procedure — REQUIRED

This tick is **fully scripted**. The script
[architecture-audit-tick.py](.kody/scripts/architecture-audit-tick.py)
is the **single source of truth** for the sweep and report generation.

Run the script:

```
python3 .kody/scripts/architecture-audit-tick.py
```

The script:

1. Scans the repo for the four finding categories above.
2. Overwrites `.kody/reports/architecture-audit.md` with findings grouped
   by severity (BLOCK / WARN), each citing real `file:line` and naming
   the existing pattern the code should follow.
3. If no findings qualify, writes an "all clear" report.
4. Bumps `state.lastRunISO` and commits + pushes the state and the
   report.

## Restrictions

- **Report only.** Never open issues, never push fix PRs, never edit
  source files. The operator decides which findings merit follow-up.
- **Cite real `file:line` for every finding.** No vague claims.
- **Stop on uncertainty.** If a finding can't be cited concretely, drop
  it rather than guess.

## State

State lives in
[architecture-audit.state.json](.kody/jobs/architecture-audit.state.json):

```json
{
  "lastRunISO": "2026-05-29T00:00:00Z",
  "nextEligibleISO": "2026-06-05T00:00:00Z"
}
```

- `data.lastRunISO`: ISO timestamp of last tick that wrote the report.
- `data.nextEligibleISO`: `data.lastRunISO + 7d`. **Always emit this,
  every tick.** Surfaced as "next run" on the dashboard.
- `done`: always `false`.
