---
every: 1d
staff: tech-writer
mentions: aguyaharonyair
disabled: false
---

# Docs Drift — feature READMEs

## Job

Catch the case where a **merged PR changed a documented feature but didn't
update that feature's doc**, and recommend the doc update to the inbox. This
is the per-PR, targeted half of doc maintenance (the broad code-header half is
[`docs-code.md`](./docs-code.md)). It writes nothing itself — it flags drift
and lets the operator approve the actual edit.

A-Guy's docs are **feature-organized**: each area is a `docs/<feature>/README.md`,
and the authoritative feature→doc map is the **"Additional Documentation"**
table in [`AGENTS.md`](../../AGENTS.md). Read that table to learn which docs
exist; do not hardcode a guess.

`disabled: true` until the dispatch verb is verified in the engine README.
Flip to `disabled: false` once checked.

**Cursor.** `data.lastCheckedMergedAt` is an ISO timestamp — the high-water
mark of merged PRs already inspected. The first run with no cursor set should
record "now" and exit (don't retro-scan history).

**Per tick (catch up on every PR merged since the cursor):**

1. Load the feature→doc map once: read `AGENTS.md`, section "Additional
   Documentation" — it lists each documented feature and its
   `docs/<feature>/README.md`.
2. List recently merged PRs newest-first (base branch is `dev`):
   `gh pr list --state merged --base dev --json number,title,mergedAt,files --limit 30`
3. Take **every** PR whose `mergedAt > data.lastCheckedMergedAt`, oldest-first
   (a daily tick may cover several merges). If none, idle. Process each in
   turn, then advance the cursor once at the end (step 6).
4. For each PR, infer which documented feature(s) its changed `files[].path`
   belong to, using the map from step 1 (e.g. payment code →
   `docs/payment/README.md`, exercise-import code →
   `docs/exercise-import/README.md`). A-Guy's source is layered (`src/server`,
   `src/lib`, `src/ui`, `src/client`, `src/infra`), so map by **feature**, not
   by a single path prefix.
   - Touched **no** mapped feature → nothing to flag; move to the next PR.
   - Touched a mapped feature **and also changed that feature's
     `docs/<feature>/README.md`** in the same PR → author updated the doc;
     move on.
   - Touched a mapped feature but **left its README untouched** → drift. Do
     step 5 for it, then move to the next PR.
5. Dedup, then flag (one issue + one inbox rec per drifted feature):
   - Title: `docs-drift: <feature> (#<pr>)`. If an open issue with that title
     already exists
     (`gh issue list --label kody:docs --state open --json number,title --limit 50`),
     skip — already tracked.
   - Otherwise open a tracking issue (create the label first if missing —
     `gh label create kody:docs --description "Kody: documentation drift"` —
     never skip the label):
     ```
     gh issue create --title "docs-drift: <feature> (#<pr>)" --label kody:docs \
       --body "<see body template>"
     ```
   - Post one inbox recommendation (format below).
6. After all PRs are processed, advance `data.lastCheckedMergedAt` to the
   **newest** processed PR's `mergedAt` (one write, at the end).

### Issue body template

```
A merged PR changed code for a documented feature, but that feature's doc was
not updated in the same PR — the doc may now be stale.

- **PR:** #<pr> — <title>
- **Documented feature touched:** <feature>
- **Doc that likely needs updating:** `docs/<feature>/README.md`
- **Changed files for that feature:** <files joined as `code, code, code`>

A human or coding agent reading `docs/<feature>/README.md` would now get an
out-of-date picture. On approval, the writer should read the PR diff, reconcile
the doc, and open a PR with the update — or close this issue with a comment if
the change was doc-irrelevant (internal refactor, no behavior change).
```

## Inbox recommendation format

One comment, terse. It **MUST** `@`-mention the operator on the first line —
that mention is the only thing that routes it into the dashboard inbox:

```
{{mentions}} 📝 **Docs may be stale** — `update`

PR #<pr> changed `<feature>` but didn't touch `docs/<feature>/README.md`.
Approving dispatches a doc-update PR; dismiss if the change was doc-irrelevant.

<!-- kody-cmd: @kody chore --issue <tracking> -->

_Confirm or dismiss in the dashboard inbox. The writer will not edit docs on its own._
```

On approve, the Approve button posts the `kody-cmd` line verbatim, so it MUST
be one line, ≤ 300 chars, and name a real engine verb. **Verify `chore --issue`
in the engine README before enabling this duty** (per the persona's hard rule);
if the engine takes a different form for "open a PR from this issue", use that
form here instead. Never emit `@kody approve` — the engine has no `approve`
verb.

## Allowed Commands

- `gh pr list`, `gh pr view`.
- `gh issue list`, `gh issue create`, `gh issue comment`, `gh label create`.
- Read tool on `AGENTS.md` (for the feature→doc map).

## Restrictions

- **Advisory only.** Never edit, commit, or push a doc; never open a PR; never
  merge/approve/label a PR. You flag and recommend — the operator approves the
  edit, the engine writes it.
- **Catch up on all PRs merged since the cursor** each tick (batch — it's
  light bookkeeping), **one issue + one rec** per drifted feature.
- **Dedup by tracking-issue title** (`docs-drift: <feature> (#<pr>)`); skip if
  an open one already exists.
- **Never retro-scan**: the first run sets the cursor to "now" and exits. Only
  PRs merged after the cursor are ever inspected.
- All writes go through `gh` — never `git commit`/`git push`.

## State

- `cursor`: `idle` | `flagged`.
- `data.lastCheckedMergedAt`: ISO timestamp high-water mark of inspected merged
  PRs. Authoritative anti-re-scan guard. Set to "now" on the first ever run.
- `data.nextEligibleISO`: always emit — surfaced as "next run" on the dashboard.
- `done`: always `false` — doc maintenance is evergreen.
