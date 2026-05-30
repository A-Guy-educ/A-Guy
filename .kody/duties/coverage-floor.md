---
disabled: true
staff: kody
every: 1d
---

# Coverage Floor

## Job

Daily check that test coverage on `dev` hasn't fallen below the floor.
Floor: **80% statements, 75% branches**. Writes a single report to
`.kody/reports/coverage-floor.md` summarising current coverage, breach
status, and the top uncovered files. The dashboard Reports page renders
it; the operator decides whether to act.

**Cadence.** Set by the `every:` frontmatter (default `every: 1d`) and
enforced by the engine.

## Tick procedure — REQUIRED

This tick is **fully scripted**. The script
[coverage-floor-tick.py](.kody/scripts/coverage-floor-tick.py) is the
**single source of truth** for fetching coverage and writing the report.

Run the script:

```
python3 .kody/scripts/coverage-floor-tick.py
```

The script:

1. Finds the most recent successful CI run on `dev` and downloads its
   `coverage-summary` artifact to `/tmp/kody-cov-<runId>/`.
2. Parses `total.statements.pct` and `total.branches.pct` and compares
   against the floor (80% / 75%).
3. Overwrites `.kody/reports/coverage-floor.md` with:
   - Current `stmts` / `branches` percentages and floor status.
   - Trend versus prior tick (`data.lastCoverage`).
   - If below floor: top 5 files by uncovered-line count.
4. Records `state.lastCoverage` and bumps `state.lastRunISO`. Commits
   and pushes the state and the report.
5. If the coverage artifact is missing, writes a "no coverage artifact
   on latest run" report and exits cleanly.

## Restrictions

- **Report only.** Never open issues, never push fix PRs, never edit
  source files.
- **Never error loudly on missing artifact.** Write the report stating
  the gap and exit 0.
- **Do not invent uncovered files.** If coverage data isn't parseable,
  drop the top-files section rather than guess.

## State

State lives in
[coverage-floor.state.json](.kody/jobs/coverage-floor.state.json):

```json
{
  "lastRunISO": "2026-05-29T00:00:00Z",
  "lastCoverage": {
    "stmts": 81.4,
    "branches": 76.2,
    "runId": "1234567890",
    "capturedISO": "2026-05-29T00:00:00Z"
  },
  "nextEligibleISO": "2026-05-29T20:00:00Z"
}
```

- `data.lastRunISO`: ISO timestamp of last tick that wrote the report.
- `data.lastCoverage`: prior coverage snapshot (used for trend).
- `data.nextEligibleISO`: `data.lastRunISO + 20h`. **Always emit this,
  every tick.** Surfaced as "next run" on the dashboard.
- `done`: always `false`.
