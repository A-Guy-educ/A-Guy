---
every: 15m
staff: cto
mentions: aguyaharonyair
disabled: false
---

# Dev CI health

Watch the `dev` branch's own CI. Every 15 minutes: if a CI check on `dev`'s tip
commit is failing **and no auto-fix is already in flight**, open the single
tracking issue and dispatch `@kody run` to fix it. The fix lands as a PR into
`dev`.

Why this exists: `fix-ci` / `sync` / `resolve` all need a `--pr`, but `dev` has
no PR — so a broken `dev` build is invisible to `pr-health-triage`. This routes
the repair through a fix PR.

## The one rule that prevents duplicates

There is only ever **ONE** dev-CI-fix issue, with the **fixed title**:

    dev CI is red — Kody auto-fix

It carries **no commit SHA** (the SHA lives in the body). While it is open, a
fix is in flight — **never open a second one, even on a new commit.** Its fix PR
closes it on merge; only then may a later tick open a fresh one. This single
reused issue is the entire dedup — there is nothing per-commit to duplicate.

## Tick

### 1. Is a fix already in flight? (do this FIRST, every tick)

```
gh issue list --state open --limit 100 --json title
gh pr list    --state open --limit 100 --json headRefName
```

**STOP and do nothing** if either is true:

- an open issue's title is exactly `dev CI is red — Kody auto-fix`, or
- an open PR's head branch contains `dev-ci-is-red`.

Use `gh issue list` (above), **not** `gh issue list --search` — the search
index lags behind a just-created issue and would let a duplicate slip through.

### 2. Read dev's HEAD checks (the real CI signal)

```
sha=$(gh api repos/A-Guy-educ/A-Guy/commits/dev --jq .sha)
gh api repos/A-Guy-educ/A-Guy/commits/$sha/check-runs --paginate \
  --jq '.check_runs[] | {name, status, conclusion, details_url}'
```

Ignore Kody's own jobs (`name` ∈ `run`, `kody`, `job-tick`, `goal-tick`,
`worker-ask`, `chat`). From the remaining checks:

- any `conclusion` ∈ `failure`, `timed_out`, `startup_failure`,
  `action_required` → **RED** (act — even if other checks are still running).
- else if any is still `queued` / `in_progress` → **PENDING**, stop.
- else → **GREEN**, stop.

(Do **not** use `gh run list` — its per-run conclusion can disagree with the
commit's real check status, and an `event=="push"` filter misses CodeQL/CI,
which run on `dynamic`/`pull_request`.)

### 3. Open the one issue (RED only)

```
gh issue create --title "dev CI is red — Kody auto-fix" --body-file -
```

The title MUST be exactly that (no SHA). Body — the dispatched `run` reads it
as its task:

```
{{mentions}} 🔴 `dev` branch CI is failing.

- Commit: `<sha>`
- Failing checks: <names> ( <details_url> for each )
- Log tail:

​```text
<gh run view <runId> --log-failed | tail -c 12000, or "external status check">
​```

Task: diagnose the failing check(s) and open a PR into `dev` that makes them
green. Keep the change minimal; if a failure is flaky / scanner-config rather
than a code defect, make the smallest change that helps — or none, and say so.
```

### 4. Dispatch the fix

A bot-authored `@kody run` comment is **dropped** (self-dispatch guard) — use
`workflow_dispatch`, the same path `pr-health-triage` uses:

```
gh workflow run kody.yml -f executable=run -f issue_number=<n>
```

### 5. Notify — one comment on the issue

```
🧭 **CTO auto-ran** — dispatched `@kody run` (failing: <names>). The fix lands
as a PR into `dev`; its own CI must pass before merge.
```

## Tick output (MANDATORY)

End every tick with this block (no SHA bookkeeping — the open issue is the
dedup):

```kody-job-next-state
{ "cursor": "idle", "data": {}, "done": false }
```

## Limits

- At most one issue + one dispatch + one comment per tick, and only when step 1
  found none in flight.
- Never edit files, `git commit`, `git push`, `merge`, `approve`, `close`, or
  label anything. The only writes are: create the one issue, dispatch it, and
  post the one notify comment.
