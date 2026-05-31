---
every: 15m
staff: cto
mentions: aguyaharonyair
disabled: false
---

# Dev CI health

> Standing watch on the **`dev`** branch's own CI, executed by the **CTO**
> persona. Every 15 minutes, check whether any CI check on `dev`'s tip commit
> is red and, if so, autonomously open a fix PR that targets `dev`. Cadence is
> enforced by the engine via `every: 15m`; no prose cadence guard needed.
>
> Why this duty exists: the PR-repair verbs (`fix-ci`, `sync`, `resolve`) all
> require a `--pr <n>`, but `dev` is a long-lived branch with **no PR** — so a
> broken `dev` build is invisible to `pr-health-triage`. This duty closes that
> gap by routing the repair through a fix PR (`@kody run` on a tracking issue),
> which is the only Kody-native way to land a change on a bare branch.

## Job

Each tick: read the **check-runs on `dev`'s HEAD commit**. If any check failed
and no fix is already in flight for that commit, open one tracking issue
describing the failure and dispatch `@kody run` on it via `workflow_dispatch` —
which opens a PR into `dev` with the fix. **At most one dev-CI fix per commit.**

The CTO persona defines only *who* runs this; all authority, scope limits, and
formats below belong to **this job**.

## Scope (hard limits)

- The only write actions this job may ever take, per tick: create **one**
  tracking issue, dispatch `kody.yml` **once** (`executable=run`), and post
  **one** notify comment on that issue.
- Never edit, create, or delete any file in the working tree. Never
  `git commit`, `git push`, or open a PR directly. The fix lands as a normal
  PR produced by the dispatched `run` — **this duty never writes code.**
- No `merge`, `approve`, `close`, `revert`, `sync`, `resolve`, label edits, or
  any action on other branches / other PRs — entirely out of scope here.

## Tick procedure

### 1. Read dev's HEAD check status (check-runs — the authoritative signal)

**Do NOT use `gh run list`.** Its per-run `conclusion` can disagree with the
commit's real check status, and it can't tell you which checks gate `dev`.
A normal `dev` build is gated by checks that run on **`pull_request`,
`dynamic` (CodeQL), `schedule`, etc. — not `push`** — so an `event=="push"`
filter misses the real CI entirely. Read the **check-runs on `dev`'s tip
commit**, which is exactly what GitHub shows as the branch's CI health:

```
sha=$(gh api repos/A-Guy-educ/A-Guy/commits/dev --jq .sha)
gh api repos/A-Guy-educ/A-Guy/commits/$sha/check-runs --paginate \
  --jq '.check_runs[] | {name, status, conclusion, details_url}'
gh api repos/A-Guy-educ/A-Guy/commits/$sha/status \
  --jq '{state, statuses: [.statuses[] | {context, state}]}'
```

`$sha` is `dev`'s tip — use it as `headSha` for dedup. Decide:

- Any check-run with `status` ∈ `queued` / `in_progress` (not `completed`) →
  **CI still running.** Decide nothing this tick; leave it alone.
- All checks completed **and** none has `conclusion` ∈ `failure`, `timed_out`,
  `startup_failure`, `action_required` **and** the combined `status.state` is
  not `failure` → **green.** Nothing to do.
- Otherwise → **red.** Collect every failing check (its `name` and
  `details_url`). Any event, any workflow — CodeQL, CI, lint, tests all count.
  Ignore `success` / `skipped` / `neutral` / `cancelled` conclusions.

### 2. Dedup + in-flight guard (REQUIRED — runs before any write)

Two independent checks; **stop the tick if either says "already handled":**

1. **Same-commit guard (state):** if the prior state's `lastFixedSha` equals
   `headSha`, you already opened a fix for this exact commit. **Stop** — wait
   for a new commit on `dev`.
2. **In-flight guard (GitHub, survives state loss):**
   ```
   gh issue list --state open --search 'in:title "dev CI red on"' --json number,title
   ```
   If any open issue's title starts with `dev CI red on ` → a fix is already in
   flight. **Stop.** This is the loop-breaker and it does not depend on state.

Only if **both** checks pass do you proceed to act.

### 3. Gather failure context

For each failing check, parse the workflow run id from its `details_url` (the
number after `/runs/`), then pull the failed-step log tail:

```
gh run view <runId> --log-failed 2>/dev/null | tail -c 12000
```

Keep the tail (≤ ~12 KB total across failing checks). If a check has no
fetchable run log (e.g. an external status check), just record its `name` and
`details_url`. Capture the failing check names + URLs for the issue body.

### 4. Open the tracking issue (one)

```
gh issue create \
  --title "dev CI red on <shortSha> — <failing check name>" \
  --body-file -
```

The title MUST start with the literal `dev CI red on ` (the step-2 in-flight
guard greps for that prefix). `<shortSha>` is the first 7 chars of `headSha`.
Body — the dispatched `run` reads this as its task, so make the failure
self-contained:

```
{{mentions}} 🔴 **`dev` branch CI is failing.**

- Branch: `dev` @ `<headSha>`
- Failing checks: <comma-separated check names>
- Details:
  - <checkName> — <details_url>
- Failure (log tail):

​```text
<logTail>
​```

**Task:** diagnose the failing check(s) above and open a PR into `dev` that
fixes them. Keep the change minimal and scoped to the failure. If a failure is
flaky / infrastructure / scanner-config (not a code defect), make the smallest
change that makes the check green — or none, and say so in the PR description.
```

### 5. Dispatch the fix (cross-run, via workflow_dispatch)

Posting `@kody run` as a comment would be **dropped** — the engine ignores
bot-authored `@kody` comments to break self-dispatch loops, so the comment
fires but never executes. Use `workflow_dispatch`, the same cross-run
bot→engine path `pr-health-triage` uses for auto-runs:

```
gh workflow run kody.yml -f executable=run -f issue_number=<n>
```

`<n>` is the issue from step 4. The engine runs `run` on that issue → a fix PR
targeting `dev` (the default branch).

### 6. Notify (audit trail — one comment)

```
gh issue comment <n> --body "..."
```

Body:

```
🧭 **CTO auto-ran** — dev-CI fix

Dispatched `@kody run` on this issue via workflow_dispatch — `dev` CI was red on
`<shortSha>` (failing: <comma-separated check names>). The fix lands as a PR
into `dev`; that PR's own CI must pass before it can merge, and
`pr-health-triage` will repair the PR if its checks fail.
```

This is a record + notification, not an ask — do not wait.

## State

`cursor`: always `"idle"`.

`data`:

- `lastFixedSha` (string) — the `dev` HEAD sha you last opened a fix for. The
  same-commit guard reads it so a stable red commit is fixed once, not every
  15 minutes.
- `lastActAt` (ISO string) — when the last fix was dispatched. Diagnostic only.

`done`: always `false` — dev-CI health is evergreen.

## Tick output (MANDATORY)

End every tick with the fenced block below — **this is how `lastFixedSha`
persists.** Carry forward the prior value; only overwrite it when you actually
dispatched a fix this tick.

```kody-job-next-state
{
  "cursor": "idle",
  "data": {
    "lastFixedSha": "<sha-or-prior-value-or-empty>",
    "lastActAt": "<iso-or-prior-value-or-empty>"
  },
  "done": false
}
```

## Allowed Commands

- `gh api repos/A-Guy-educ/A-Guy/commits/dev --jq .sha` — resolve dev's tip sha.
- `gh api repos/A-Guy-educ/A-Guy/commits/<sha>/check-runs --paginate --jq '.check_runs[] | {name, status, conclusion, details_url}'`
  — the authoritative branch-CI read.
- `gh api repos/A-Guy-educ/A-Guy/commits/<sha>/status --jq '{state, statuses}'`
  — legacy commit statuses (Vercel, etc.).
- `gh run view <id> --log-failed` — failed-step log tail, only for a failing check's run.
- `gh issue list --state open --search 'in:title "dev CI red on"' --json number,title`
  — the in-flight guard.
- `gh issue create --title "dev CI red on ..." --body-file -` — one tracking issue.
- `gh workflow run kody.yml -f executable=run -f issue_number=<n>` — dispatch the fix.
- `gh issue comment <n> --body "..."` — one notify comment.

## Restrictions

- Step 2 (dedup + in-flight guard) is mandatory and runs **before** any write.
- Maximum per tick: one tracking issue + one `workflow_dispatch` + one comment.
- Never dispatch for a sha already recorded in `lastFixedSha`.
- Never act while `dev`'s HEAD checks are still running — only on a completed red.
- Never `merge`, `approve`, `close`, `label`, or touch any PR/branch other than
  creating the single tracking issue described above.
