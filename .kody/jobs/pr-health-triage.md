---
every: 15m
worker: cto
---

# PR health triage

> Standing PR-health triage, executed by the **CTO** persona
> (`worker: cto`). Every 15 minutes, read the open pull requests, detect
> which ones need a mechanical repair, and — per the operator's trust
> ledger — either recommend the repair or (once that verb has graduated)
> dispatch it. Cadence is enforced by the engine via `every: 15m`; no
> prose cadence guard needed.

## Job

Each tick, look at every open PR, pick at most one repair per PR (by the
priority order below), and either recommend it or — if its verb has
graduated in the trust ledger — dispatch it. All authority, scope limits,
and comment formats are defined by your worker persona; this job defines
only the per-tick procedure and state.

### Enumerate

One list call — never `gh` once per PR:

```
gh pr list --state open --limit 100 \
  --json number,title,headRefName,baseRefName,isDraft,mergeable,statusCheckRollup,updatedAt
```

Skip draft PRs (`isDraft: true`) — they aren't ready for repair.

### Read the trust ledger (do this first, every tick)

```
gh issue list --state open --label kody:cto-decisions --limit 5 \
  --json number,body
```

Take the lowest-numbered match, find the fenced ```json block between
`<!-- kody-cto-decisions:start -->` and `<!-- kody-cto-decisions:end -->`,
and read `actions.<verb>.mode` for each of `fix-ci`, `sync`, `resolve`.
Interpret `mode` exactly as your persona's "Authority — the trust ledger"
section dictates (auto → may self-dispatch; anything else → recommend).

### Detect the repair (priority order — first match wins, one per PR)

For each open non-draft PR, evaluate in this exact order, stop at first hit:

1. **Conflicts → `resolve`.** `mergeable === "CONFLICTING"`.
2. **CI failed → `fix-ci`.** `statusCheckRollup` contains any check with
   `conclusion` of `FAILURE`, `TIMED_OUT`, or `ACTION_REQUIRED` (treat
   `STARTUP_FAILURE` the same). Ignore still-running checks
   (`status: IN_PROGRESS`/`QUEUED`).
3. **Stale branch → `sync`.** Only if neither of the above. Measure drift:

   ```
   gh api repos/{owner}/{repo}/compare/{baseRefName}...{headRefName} --jq .behind_by
   ```

   `> 10` → `sync`. `<= 10` → leave alone (small drift is normal).

No hit on any of the three → leave the PR alone this tick. `{owner}/{repo}`
is the current repo. Run the `compare` call **only** for PRs that passed
checks 1 and 2 (not conflicting, CI green).

### Act on the repair

Let `<verb>` be the detected primitive and `<n>` the PR number; the command
is always `@kody <verb> --pr <n>`.

- **Verb not graduated** → post one recommendation comment on PR `<n>`
  (use your persona's recommendation format). Stage → `<verb>-recommended`.
- **Verb graduated** → dispatch it (use your persona's auto-run format).
  Stage → `<verb>-auto`. Notify, not ask — do not wait. Still honour the
  dedup ledger: never auto-run the same repair on the same PR twice for
  the same fingerprint.

## Allowed Commands

- `gh pr list --state open --limit 100 --json number,title,headRefName,baseRefName,isDraft,mergeable,statusCheckRollup,updatedAt`
  — the single enumeration call.
- `gh api repos/{owner}/{repo}/compare/{base}...{head} --jq .behind_by`
  — only for non-conflicting, CI-green PRs, to measure staleness for `sync`.
- `gh issue list --state open --label kody:cto-decisions --limit 5 --json number,body`
  — read the trust ledger once per tick.
- `gh pr comment <n> --body "..."` — the only write path: a recommendation
  comment, or (only when that verb is graduated) the `@kody <verb> --pr
  <n>` dispatch + its notify-only follow-up.

## Restrictions

Your worker persona's scope/hard-limit rules apply in full and win over
anything here. In addition, per-tick:

- One comment per PR per tick, and only when the repair is **new**
  (fingerprint changed — see State). Re-posting every 15 minutes is the
  primary failure mode; the dedup ledger prevents it.
- Never call `gh` once per PR in a loop — one `pr list` drives the tick;
  the per-PR `compare` runs only for the healthy subset.

## State

`cursor`: always `"idle"` — phases are per-PR, not global.

`data`:

- `prs` (object) — keyed by PR number. Each value:
  - `fp` (string) — fingerprint = `"<verb>|<updatedAt>"`. The dedup key:
    only post a new comment when `fp` changes.
  - `stage` (string) — one of: `fix-ci-recommended`, `sync-recommended`,
    `resolve-recommended`, `fix-ci-auto`, `sync-auto`, `resolve-auto`,
    `dismissed`.
  - `lastActAt` (ISO string) — when the last comment was posted.
    Diagnostic only.
- Prune entries for PRs no longer in the open list so `data` does not grow
  unbounded.

(Engine-managed fields like `lastFiredAt` live under `data` automatically;
do not write or rely on them from the prompt.)

`done`: always `false` — PR-health triage is evergreen.
