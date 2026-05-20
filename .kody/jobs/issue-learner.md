---
every: 6h
worker: coo
---

# issue-learner

## Job

Scan recently closed issues on this repo and drop one sticky note per
issue not yet memorialised. Closed-as-completed becomes a `lesson`
(what the resolution was), closed-as-not-planned becomes a `decision`
(why we chose not to fix). The `memory-writer` job files the sticky
on its next tick.

## Tick procedure — REQUIRED

This tick is **fully scripted**. The script
[issue-learner-tick.py](.kody/scripts/issue-learner-tick.py) is the
**single source of truth** for the lookback window, the dedup rule,
and the sticky-note shape.

Run the script:

```
python3 .kody/scripts/issue-learner-tick.py
```

The script:

1. Lists the last `LOOKBACK_DAYS` (default 14) of closed issues via
   `gh issue list --state closed`.
2. For each issue, **dedups** by checking whether
   `.kody/memory/issue-<n>.md` already exists or whether a sticky for
   the same issue number is already in `.kody/memory/inbox/`. Skips if
   either is true.
3. Otherwise drops a sticky note into `.kody/memory/inbox/`:
   - `type: lesson` if the issue was closed as completed (state COMPLETED)
   - `type: decision` if closed as not-planned (state NOT_PLANNED)
   - `body` contains: issue URL, author, closed date, title, first
     ~600 chars of body, and the linked closing PR (if any).
   - `source: job:issue-learner`
4. Skips low-signal issues (bot-generated, label-only chatter, empty
   bodies with non-descriptive titles).
5. Logs how many were dropped and exits 0.

No state file required — `.kody/memory/issue-<n>.md` (or the inbox
JSON awaiting filing) is the persistent dedup record.

## Restrictions

- Never writes to `.kody/memory/*.md` directly — only drops sticky
  notes. The memory-writer job is the only filer.
- Never modifies issues (no comments, no labels, no reopens).
- Skips issues labeled `kody:cto-decisions`, `kody:ceo-proposal`, or
  `kody:system-audit` — those are kody-internal tracking issues, not
  product issues worth remembering as resolution history.

## Scope

What this job remembers is **what was closed and roughly why**. It
does not capture review back-and-forth, CI noise, or duplicate
labelling history — those would be separate scanner concerns.
