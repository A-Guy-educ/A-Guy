# auto resolve

## Mission

For every open, non-draft pull request that is not yet merged: if it has a merge conflict, post the comment `@kody resolve` on the PR. Otherwise do nothing.

A PR enters this mission's scope as soon as it becomes ready for review (non-draft, open). It leaves scope when it is merged or closed.

## Allowed Commands

`@kody resolve`

## Restrictions

- Only act when the PR's mergeable state is `CONFLICTING`. Skip `MERGEABLE`, `UNKNOWN`, draft, merged, closed.
- Do not modify the issue, the PR body, the PR title, labels (except as instructed below), or any code.
- Do not re-issue `@kody resolve` on the same head SHA more than 2 times.
- After 2 failed attempts on a SHA: post `kody resolve stuck — needs human` and add label `kody:stuck-conflict`; skip until SHA changes or label is removed.

## Tick procedure

The tick is fully scripted — past iterations of this mission hallucinated PR numbers and posted `@kody resolve` on long-closed PRs. All filtering, posting, and state mutation now lives in [auto-resolve-tick.sh](.kody/scripts/auto-resolve-tick.sh).

**Step 1 — Run the tick script:**

```
bash .kody/scripts/auto-resolve-tick.sh
```

**Step 2 — Emit the script's stdout verbatim**, including the markdown summary table and the `kody-mission-next-state` fenced block. Do not paraphrase, edit, reorder, or compute anything yourself.

If the script exits non-zero, surface its stderr and emit a state block with the prior `perPr` unchanged so progress isn't lost.

## State shape

`data.perPr` is a map of PR number → `{ lastSha: string, attempts: number, stuck: boolean }`.
