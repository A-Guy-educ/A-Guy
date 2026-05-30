---
disabled: true
staff: kody
every: 1d
---

# Flaky Test Quarantine

## Job

Daily detection of flaky tests by watching CI failure patterns on `dev`
and `main`. Writes a single report to
`.kody/reports/flaky-test-quarantine.md` listing flip candidates and
flagging any that have crossed the quarantine threshold. The dashboard
Reports page renders it; the operator decides whether to quarantine.

**Cadence.** Set by the `every:` frontmatter (default `every: 1d`) and
enforced by the engine.

## Tick procedure — REQUIRED

This tick is **fully scripted**. The script
[flaky-test-quarantine-tick.py](.kody/scripts/flaky-test-quarantine-tick.py)
is the **single source of truth** for fetching CI runs and writing the
report.

Run the script:

```
python3 .kody/scripts/flaky-test-quarantine-tick.py
```

The script:

1. Fetches the last 25 completed CI runs on `dev` and the last 25 on
   `main`.
2. Identifies **flip candidates** — runs where the same `headSha` had a
   failed attempt followed by a successful re-run. For each, parses
   failed test names from job logs (vitest/playwright failure lines).
3. Updates `state.candidates[testId] = { flips, lastSeenSha,
   lastSeenISO }`. Only counts one flip per (testId, headSha) pair.
4. Garbage-collects candidates whose `lastSeenISO` is older than 14
   days.
5. Overwrites `.kody/reports/flaky-test-quarantine.md` with:
   - **Quarantine candidates** — testIds with `flips >= 3`, sorted by
     flip count.
   - **Watch list** — testIds with `flips` between 1 and 2.
   - For each: latest SHAs and last-seen timestamp.
6. Bumps `state.lastRunISO` and commits + pushes state and report.

## Restrictions

- **Report only.** Never edit test files, never push quarantine PRs,
  never open issues.
- **Threshold is 3 flips.** Don't lower it from inside the script —
  edit this file if the threshold needs tuning.
- **Drop candidates older than 14 days.** Stale data shouldn't drive
  quarantine decisions.

## State

State lives in
[flaky-test-quarantine.state.json](.kody/jobs/flaky-test-quarantine.state.json):

```json
{
  "lastRunISO": "2026-05-29T00:00:00Z",
  "candidates": {
    "tests/e2e/login.spec.ts > login flow": {
      "flips": 4,
      "lastSeenSha": "abc123",
      "lastSeenISO": "2026-05-28T00:00:00Z"
    }
  },
  "nextEligibleISO": "2026-05-29T20:00:00Z"
}
```

- `data.lastRunISO`: ISO timestamp of last tick that wrote the report.
- `data.candidates`: `{ [testId]: { flips, lastSeenSha, lastSeenISO } }`.
- `data.nextEligibleISO`: `data.lastRunISO + 20h`. **Always emit this,
  every tick.** Surfaced as "next run" on the dashboard.
- `done`: always `false`.
