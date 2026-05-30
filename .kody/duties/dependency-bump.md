---
disabled: true
staff: kody
every: 7d
---

# Dependency Bump

## Job

Weekly tracking of stale production dependencies. Writes a single report
to `.kody/reports/dependency-bump.md` proposing the **single most-stale
package** to bump next. The dashboard Reports page renders it; the
operator decides whether to take the bump.

**Cadence.** Set by the `every:` frontmatter (default `every: 7d`) and
enforced by the engine — runs on Monday UTC.

## Tick procedure — REQUIRED

This tick is **fully scripted**. The script
[dependency-bump-tick.py](.kody/scripts/dependency-bump-tick.py) is the
**single source of truth** for picking the candidate and writing the
report.

Run the script:

```
python3 .kody/scripts/dependency-bump-tick.py
```

The script:

1. Runs `pnpm outdated --prod --json` to get current stale packages.
2. Filters out packages attempted within the last 30 days (see
   `state.history`).
3. Picks the candidate with the largest semver gap (ties broken by
   oldest published date).
4. Overwrites `.kody/reports/dependency-bump.md` with:
   - Headline: which package and the proposed jump.
   - Reason (semver gap, age, any matching `@types/*`).
   - Recent history of attempts and their outcomes.
   - "Nothing eligible" message if the filtered set is empty.
5. Appends `{ pkg, attemptedISO, outcome: "proposed" }` to
   `state.history` (capped at 50 entries — drops oldest).
6. Bumps `state.lastRunISO` and commits + pushes state and report.

## Restrictions

- **Report only.** Never push bump PRs, never edit `package.json`,
  never run `pnpm add`/`pnpm up`.
- **One proposal per tick.** Don't list every stale package — pick the
  single highest-priority one.
- **Honor the 30-day cool-off.** Don't re-surface a recently-attempted
  package even if it's still the stalest.

## State

State lives in
[dependency-bump.state.json](.kody/jobs/dependency-bump.state.json):

```json
{
  "lastRunISO": "2026-05-25T00:00:00Z",
  "history": [
    { "pkg": "next", "attemptedISO": "2026-05-18T00:00:00Z", "outcome": "proposed" }
  ],
  "nextEligibleISO": "2026-06-01T00:00:00Z"
}
```

- `data.lastRunISO`: ISO timestamp of last tick that wrote the report.
- `data.history`: rolling list `[{ pkg, attemptedISO, outcome }]`,
  capped at 50.
- `data.nextEligibleISO`: next Monday 00:00 UTC at or after
  `data.lastRunISO + 6d`. **Always emit this, every tick.** Surfaced as
  "next run" on the dashboard.
- `done`: always `false`.
