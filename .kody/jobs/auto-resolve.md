---
every: 1h
tickScript: .kody/scripts/auto-resolve-tick.sh
---

# auto resolve

## Job

For every open, non-draft pull request that is not yet merged: if it has a merge conflict, post the comment `@kody resolve` on the PR. Otherwise do nothing.

A PR enters this job's scope as soon as it becomes ready for review (non-draft, open). It leaves scope when it is merged or closed.

## Allowed Commands

`@kody resolve`

## Restrictions

- Only act when the PR's mergeable state is `CONFLICTING`. Skip `MERGEABLE`, `UNKNOWN`, draft, merged, closed.
- Do not modify the issue, the PR body, the PR title, labels (except as instructed below), or any code.
- Do not re-issue `@kody resolve` on the same head SHA more than 2 times.
- After 2 failed attempts on a SHA: post `kody resolve stuck — needs human` and add label `kody:stuck-conflict`; skip until SHA changes or label is removed.

## Tick procedure — REQUIRED

This tick is **fully scripted**. The script [auto-resolve-tick.sh](.kody/scripts/auto-resolve-tick.sh) is the **single source of truth** for which PRs are candidates, what state mutations to make, and which comments to post.

A previous iteration of this job used prose enumeration and **hallucinated** PRs #122 and #124 as conflicting (both are long-closed) — then posted a real `@kody resolve` comment on closed PR #122. Do not repeat that.

You **MUST**:

1. Run exactly: `bash .kody/scripts/auto-resolve-tick.sh`
2. Emit the script's stdout verbatim — including the markdown summary table and the `kody-job-next-state` fenced block at the end.

You **MUST NOT**:

- Call `gh pr list` yourself.
- Filter, decide actions, post comments, or mutate state outside the script.
- Use any prior knowledge of PR numbers in this repo. The script's output is your only data source for this tick.
- Re-run the script (it has side effects). One invocation per tick.

If the script exits non-zero, surface its stderr and emit a state block with the prior `perPr` unchanged so progress isn't lost.

## State shape

`data.perPr` is a map of PR number → `{ lastSha: string, attempts: number, stuck: boolean }`.
