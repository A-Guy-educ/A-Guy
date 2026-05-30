---
staff: ceo
mentions: aguyaharonyair
---

# job-gap-scan

## Job

Once a day, propose **one** new high-ROI duty the system does not yet
have, and write the proposal to a report. Read `.kody/memory/` first to
honour prior verdicts — never re-propose something the operator already
rejected, and respect the 30-day cool-off after a dismiss.

A proposal is **advisory only**. It surfaces by overwriting
`.kody/reports/job-gap-scan.md` (the dashboard Reports page renders it).
This duty never writes a new duty markdown itself — the operator decides
Approve / Reject / Dismiss.

## Tick procedure — REQUIRED

This tick is **fully scripted**. The script
[job-gap-scan-tick.py](.kody/scripts/job-gap-scan-tick.py) is the
**single source of truth** for cadence enforcement, candidate filtering,
report generation, and state mutation.

Run the script:

```
python3 .kody/scripts/job-gap-scan-tick.py
```

The script:

1. Loads `state.json` (cadence is engine-enforced via `every:` in the
   duty markdown; `JOB_GAP_SCAN_FORCE=1` is accepted for live tests).
2. Reads `.kody/memory/` looking for any memory file whose `name` starts
   with `verdict-ceo-proposal-<slug>` to learn the operator's last
   verdict on each candidate.
3. Filters the built-in catalogue (`CATALOGUE` in the script) by:
   - Skipping slugs already filed as a duty in `.kody/duties/`.
   - Skipping slugs whose latest verdict is `reject` (permanent).
   - Skipping slugs whose latest verdict is `dismiss` within the last
     30 days (re-surface eligible after the cooling-off window).
4. Picks the candidate with the highest ROI score from the filtered
   set. If nothing qualifies, writes a "all caught up" report.
5. Overwrites `.kody/reports/job-gap-scan.md` with:
   - `## Current proposal` — headline, scoring table, "Why now", and a
     fenced block containing the draft duty markdown.
   - `## History` — every slug ever proposed, with first-suggested date
     and the most-recent verdict (if any).
6. Records `state.proposed[<slug>] = { firstSuggestedISO, lastWrittenISO }`
   and bumps `state.lastRunISO`. Commits + pushes the state and the
   report.

## Restrictions

- **One proposal per tick.** Never write more than one "Current proposal".
- **Never author duty code.** The draft markdown inside the report is a
  starting point; the operator decides whether to commit it.
- **Never re-surface a rejected slug.** A reject is permanent; only the
  catalogue maintainer (human) can revisit by changing the slug.
- **Dismiss has a 30-day cooling-off.** If signal grows after that,
  re-surface is allowed (but most dismissed slugs simply stay dismissed).
- **Stop on uncertainty.** If no candidate qualifies, write the
  "all caught up" report; do not invent new candidates.

## State

The script persists state in
[job-gap-scan.state.json](.kody/jobs/job-gap-scan.state.json) alongside
this file. Schema:

```json
{
  "lastRunISO": "2026-05-28T10:00:00Z",
  "proposed": {
    "sentry-digest": {
      "firstSuggestedISO": "2026-05-20T12:37:00Z",
      "lastWrittenISO": "2026-05-28T10:00:00Z"
    }
  }
}
```
