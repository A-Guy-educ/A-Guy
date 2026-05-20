---
every: 6h
worker: coo
---

# pr-learner

## Job

Scan recently merged pull requests on the default branch and drop one
sticky note per PR that has not been memorialised yet. Every drop is a
`type: decision` sticky — the PR title is the headline, the PR body
summary is the rationale, the URL is the link out. The `memory-writer`
job files the sticky on its next tick.

## Tick procedure — REQUIRED

This tick is **fully scripted**. The script
[pr-learner-tick.py](.kody/scripts/pr-learner-tick.py) is the **single
source of truth** for the lookback window, the dedup rule, and the
sticky-note shape.

Run the script:

```
python3 .kody/scripts/pr-learner-tick.py
```

The script:

1. Lists the last `LOOKBACK_DAYS` (default 14) of merged PRs via
   `gh pr list --state merged`.
2. For each PR, **dedups** by checking whether
   `.kody/memory/pr-<n>.md` already exists or whether a sticky note for
   the same PR number is already in `.kody/memory/inbox/`. If either
   is true, skip.
3. Otherwise drops a sticky note JSON into `.kody/memory/inbox/` with:
   - `type: decision`
   - `name: pr-<n>`
   - `body: PR url, author, merged date, title, first ~600 chars of body`
   - `source: job:pr-learner`
4. Logs how many were dropped and exits 0.

No state file required — the presence of `.kody/memory/pr-<n>.md` (or
the inbox JSON awaiting filing) is the persistent dedup record.

## Restrictions

- Never writes to `.kody/memory/*.md` directly — only drops sticky
  notes. The memory-writer job is the only filer.
- Never modifies PRs (no comments, no labels, no closes).
- Skips PRs with empty bodies if the title alone provides no signal
  (heuristic in the script).

## Scope

What this job remembers is **what was merged and roughly why**. It does
not capture review discussions, CI outcomes, or rollback events — each
of those is a separate scanner concern.
