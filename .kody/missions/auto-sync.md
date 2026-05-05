# auto sync

## Mission

For every open, non-draft pull request that is not yet merged: if its branch is sufficiently behind its base branch, post the comment `@kody sync` on the PR to update it. Otherwise do nothing.

A PR enters this mission's scope as soon as it becomes ready for review (non-draft, open). It leaves scope when it is merged, closed, or labeled `kody:no-sync`.

## Allowed Commands

`@kody sync`

## Restrictions

- Only act when the PR is at least 5 commits behind its base branch.
- Skip PRs whose `mergeable` is `CONFLICTING` — those belong to auto-resolve.
- Skip PRs with the label `kody:no-sync`.
- Skip PRs whose latest CI run is in progress (`status` of `IN_PROGRESS` or `QUEUED` on any check) — don't cancel a fresh run.
- Do not post `@kody sync` on the same PR more than once every 6 hours, regardless of state.
- Do not re-issue `@kody sync` on the same head SHA more than 2 times.
- After 2 failed attempts on a SHA: post the comment `kody sync stuck — needs human` on the PR, add the label `kody:stuck-sync`, and skip the PR until its head SHA changes or the label is removed.
- Do not modify the issue, the PR body, the PR title, labels (except as instructed above), or any code.

## Tick procedure

**Step 1 — Compute the candidate set.** Run:

```
bash .kody/scripts/auto-sync-candidates.sh
```

This script is the **single source of truth** for which PRs are candidates this tick and what their `behind` / CI / prior-state values are. Its output is a JSON array of objects with these fields: `pr`, `head_sha`, `base`, `behind`, `ci_in_progress`, `prior` (the prior `perPr[pr]` entry or `null`).

You **must not**:
- Call `gh pr list` yourself.
- Call `gh api .../compare/...` yourself.
- Filter out, add to, or reorder the array.
- "Skip checking" any element because it wasn't in prior `perPr`.

The script's array is your candidate set, exactly. Every element gets a per-PR action decision in step 2. Treat its output as authoritative even if it conflicts with anything you remember from prior ticks.

**Step 2 — Get the current UTC time** for `lastActionAt` stamping:

```
date -u +%Y-%m-%dT%H:%M:%SZ
```

Capture this once and use it verbatim as `now`. Do not round, snap to half-hour, or add any offset.

**Step 3 — For each candidate `c` in the array (iterate every element, skip none):** decide an action using `c.behind`, `c.ci_in_progress`, `c.prior`, and `now`:

1. If `c.behind < 5`: action = `skip`. Do not carry `c.prior` forward (GC).
2. Else if `c.ci_in_progress == true`: action = `skip`. Carry `c.prior` forward unchanged.
3. Else compute `effectivePrior`:
   - If `c.prior` is `null` or `c.prior.lastSha != c.head_sha`: `effectivePrior = { lastSha: c.head_sha, attempts: 0, stuck: false, lastActionAt: null }`.
   - Else `effectivePrior = c.prior`.
4. If `effectivePrior.stuck == true`: action = `skip`. Carry `effectivePrior` forward.
5. Else if `effectivePrior.lastActionAt` is non-null and within 6 hours of `now`: action = `skip`. Carry `effectivePrior` forward.
6. Else if `effectivePrior.attempts >= 2`: action = `mark-stuck`. Post `kody sync stuck — needs human` on PR `c.pr`, add label `kody:stuck-sync`. New entry: `{ ...effectivePrior, stuck: true, lastActionAt: now }`.
7. Else: action = `sync`. Post `@kody sync` on PR `c.pr`. New entry: `{ lastSha: c.head_sha, attempts: effectivePrior.attempts + 1, stuck: false, lastActionAt: now }`.

**Step 4 — Render a table** before posting any comments. One row per candidate, in the order returned by the script. Columns: `pr | head_sha[:8] | behind | ci | prior_summary | action | reason`. The table must list every element of the script's array, including skipped ones.

**Step 5 — Apply actions.** For each row whose action is `sync` or `mark-stuck`, post the corresponding comment / labels.

**Step 6 — Build the new `perPr`** by collecting the carry-forward / new entries from step 3. PRs whose action was `skip` due to `behind < 5` are not included (GC). PRs not in the script's array at all are dropped (already GC'd by exclusion from the candidate set).

**State-mutation rules (strict):**
- Only update `perPr[n].lastActionAt` and `perPr[n].attempts` on a PR `n` when you actually posted a comment on PR `n` in this tick. Never bump these fields speculatively, in batch, or for PRs you decided to skip.
- The `lastSha` reset on SHA-change is the only state mutation that is not gated on a posted comment.
- If a PR is skipped (any reason), its `perPr[n]` entry must equal `effectivePrior` (i.e. equal to the prior entry, except for the `lastSha` reset rule).
- `lastActionAt` must be the literal `now` from step 2 — no rounding, no snapping.

**Step 7 — Emit the next state block:**

```
\`\`\`kody-mission-next-state
{
  "cursor": "auto-sync-<now>",
  "data": { "perPr": <new perPr> },
  "done": false
}
\`\`\`
```

## State shape

`data.perPr` is a map of PR number → `{ lastSha: string, attempts: number, stuck: boolean, lastActionAt: string | null }`.
