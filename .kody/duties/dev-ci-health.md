---
every: 15m
staff: cto
mentions: aguyaharonyair
disabled: false
---

# Dev CI health

> Standing watch on the **`dev`** branch's own CI, executed by the **CTO**
> persona. Every 15 minutes, check whether the latest CI on `dev`'s tip commit
> is red and, if so, autonomously open a fix PR that targets `dev`. Cadence is
> enforced by the engine via `every: 15m`; no prose cadence guard needed.
>
> Why this duty exists: the PR-repair verbs (`fix-ci`, `sync`, `resolve`) all
> require a `--pr <n>`, but `dev` is a long-lived branch with **no PR** — so a
> broken `dev` build is invisible to `pr-health-triage`. This duty closes that
> gap by routing the repair through a fix PR (`@kody run` on a tracking issue),
> which is the only Kody-native way to land a change on a bare branch.

## Job

Each tick: look at the most recent CI run on `dev`'s HEAD commit. If it failed
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

### 1. Read dev's HEAD CI status (one call)

```
gh run list --branch dev --limit 20 \
  --json databaseId,headSha,workflowName,conclusion,status,event,createdAt
```

Consider only runs with `event: "push"` (these are `dev`'s own branch CI —
ignore `pull_request`, `schedule`, and `workflow_dispatch` runs). Find the
newest `headSha` (dev's tip) and look at every push-run on that sha:

- Any run on that HEAD still `in_progress` or `queued` → **CI is still
  running.** Decide nothing this tick; leave it alone.
- All completed and none failed (`conclusion` ∈ `success`/`skipped`/`neutral`)
  → **green.** Nothing to do.
- Any completed run on that HEAD with `conclusion` ∈ `failure`, `timed_out`,
  `startup_failure`, `action_required` → **red.** Continue. Let `headSha` be
  that tip sha and `runId` / `workflowName` be the failing run.

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

```
gh run view <runId> --log-failed 2>/dev/null | tail -c 12000
```

Keep that tail (≤ ~12 KB). Capture `workflowName` and the run's web URL
(`gh run view <runId> --json url -q .url`).

### 4. Open the tracking issue (one)

```
gh issue create \
  --title "dev CI red on <shortSha> — <workflowName>" \
  --body-file -
```

The title MUST start with the literal `dev CI red on ` (the step-2 in-flight
guard greps for that prefix). `<shortSha>` is the first 7 chars of `headSha`.
Body — the dispatched `run` reads this as its task, so make the failure
self-contained:

```
{{mentions}} 🔴 **`dev` branch CI is failing.**

- Branch: `dev` @ `<headSha>`
- Workflow: **<workflowName>** — <runUrl>
- Failure (log tail):

​```text
<logTail>
​```

**Task:** diagnose the failure above and open a PR into `dev` that fixes it.
Keep the change minimal and scoped to the failing workflow. If the failure is
flaky / infrastructure (not a code defect), make the smallest change that makes
CI green — or none, and say so in the PR description.
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
`<shortSha>` (<workflowName>). The fix lands as a PR into `dev`; that PR's own
CI must pass before it can merge, and `pr-health-triage` will repair the PR if
its checks fail.
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

- `gh run list --branch dev --limit 20 --json databaseId,headSha,workflowName,conclusion,status,event,createdAt`
  — the single CI-status read.
- `gh run view <id> --log-failed` and `gh run view <id> --json url -q .url`
  — failing-log tail + run URL, only for the detected red run.
- `gh issue list --state open --search 'in:title "dev CI red on"' --json number,title`
  — the in-flight guard.
- `gh issue create --title "dev CI red on ..." --body-file -` — one tracking issue.
- `gh workflow run kody.yml -f executable=run -f issue_number=<n>` — dispatch the fix.
- `gh issue comment <n> --body "..."` — one notify comment.

## Restrictions

- Step 2 (dedup + in-flight guard) is mandatory and runs **before** any write.
- Maximum per tick: one tracking issue + one `workflow_dispatch` + one comment.
- Never dispatch for a sha already recorded in `lastFixedSha`.
- Never act while `dev`'s HEAD CI is still running — only on a completed red.
- Never `merge`, `approve`, `close`, `label`, or touch any PR/branch other than
  creating the single tracking issue described above.
