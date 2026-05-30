---
disabled: true
staff: kody
every: 7d
---

# Type Debt Tracker

## Job

Weekly tracking of TypeScript escape hatches: occurrences of `any`,
`@ts-ignore`, `@ts-expect-error`, and `@ts-nocheck` across `src/**` and
`tests/**`. Writes a single report to `.kody/reports/type-debt.md` with
current counts and week-over-week trend. The dashboard Reports page
renders it; the operator decides whether the growth warrants a cleanup.

**Cadence.** Set by the `every:` frontmatter (default `every: 7d`) and
enforced by the engine — runs on Wednesday UTC.

## Tick procedure — REQUIRED

This tick is **fully scripted**. The script
[type-debt-tick.py](.kody/scripts/type-debt-tick.py) is the **single
source of truth** for counting and writing the report.

Run the script:

```
python3 .kody/scripts/type-debt-tick.py
```

The script:

1. Counts occurrences of `any`, `@ts-ignore`, `@ts-expect-error`, and
   `@ts-nocheck` across `src/**` and `tests/**`, excluding
   `payload-types.ts` and `*.d.ts` from generated bundles.
2. Compares against `state.lastCount` to compute week-over-week growth.
3. Overwrites `.kody/reports/type-debt.md` with:
   - Headline counts in the format `any=<N> ts-ignore=<N>
     ts-expect-error=<N> ts-nocheck=<N> | total=<N>`.
   - Delta versus prior week and growth percentage.
   - **Growth alert** if total grew by >5%, plus the 5 lowest-effort
     occurrences to address first (prefer dead-code paths and test
     files).
4. Updates `state.lastCount` and bumps `state.lastRunISO`. Commits and
   pushes state and report.

## Restrictions

- **Report only.** Never edit source files, never push cleanup PRs,
  never open issues.
- **Growth threshold is 5%.** Don't lower it from inside the script —
  edit this file if the threshold needs tuning.
- **Exclude generated files.** `payload-types.ts` and `*.d.ts` bundles
  are not type debt.

## State

State lives in
[type-debt.state.json](.kody/jobs/type-debt.state.json):

```json
{
  "lastRunISO": "2026-05-27T00:00:00Z",
  "lastCount": {
    "any": 42,
    "ts-ignore": 3,
    "ts-expect-error": 8,
    "ts-nocheck": 0,
    "total": 53,
    "capturedISO": "2026-05-27T00:00:00Z"
  },
  "nextEligibleISO": "2026-06-03T00:00:00Z"
}
```

- `data.lastRunISO`: ISO timestamp of last tick that wrote the report.
- `data.lastCount`: prior count snapshot (used for trend).
- `data.nextEligibleISO`: next Wednesday 00:00 UTC at or after
  `data.lastRunISO + 6d`. **Always emit this, every tick.** Surfaced as
  "next run" on the dashboard.
- `done`: always `false`.
