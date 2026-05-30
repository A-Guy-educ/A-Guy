---
disabled: true
staff: kody
every: 30d
---

# Dead Code Sweep

## Job

Monthly cleanup audit of unused exports, files, and dependencies. Writes
a single report to `.kody/reports/dead-code-sweep.md` grouping findings
from `knip`, `ts-prune`, and `depcheck` by category. The dashboard
Reports page renders it; the operator decides which categories merit a
cleanup PR.

**Cadence.** Set by the `every:` frontmatter (default `every: 30d`) and
enforced by the engine.

## Tick procedure — REQUIRED

This tick is **fully scripted**. The script
[dead-code-sweep-tick.py](.kody/scripts/dead-code-sweep-tick.py) is the
**single source of truth** for running the tools and writing the report.

Run the script:

```
python3 .kody/scripts/dead-code-sweep-tick.py
```

The script:

1. Runs `knip`, `ts-prune`, and `depcheck` against the working tree.
2. Filters findings by the do-not-delete list (below).
3. Overwrites `.kody/reports/dead-code-sweep.md` grouped into five
   categories:
   1. **unused exports** — `ts-prune` findings.
   2. **unused files** — `knip` findings.
   3. **unused devDependencies** — `depcheck` findings.
   4. **unused dependencies (prod)** — `depcheck` findings (high
      confidence only).
   5. **unused exports from `src/lib/**`** — highest-signal cleanups.
4. Categories with zero findings render as "no findings".
5. Bumps `state.lastRunISO` and commits + pushes the state and report.

### Do-not-delete list

- Anything under `src/payload/collections/**` (dynamically registered).
- Anything imported via `payload-config.ts`.
- Anything in `scripts/**` flagged solely by `knip` (often invoked via
  package.json scripts knip can't see).
- Files under `messages/**` (i18n).
- Anything matching `**/*.spec.ts` or `**/*.test.ts`.

## Restrictions

- **Report only.** Never delete files, never open issues, never push
  cleanup PRs. Operator decides.
- **Honor the do-not-delete list.** No exceptions from within the
  script.
- **Cite real `file:line` for every finding.** No category-level
  generalities.

## State

State lives in
[dead-code-sweep.state.json](.kody/jobs/dead-code-sweep.state.json):

```json
{
  "lastRunISO": "2026-05-29T00:00:00Z",
  "nextEligibleISO": "2026-06-28T00:00:00Z"
}
```

- `data.lastRunISO`: ISO timestamp of last tick that wrote the report.
- `data.nextEligibleISO`: `data.lastRunISO + 30d`. **Always emit this,
  every tick.** Surfaced as "next run" on the dashboard.
- `done`: always `false`.
