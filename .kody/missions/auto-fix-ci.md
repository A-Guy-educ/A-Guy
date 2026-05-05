# auto fix-ci

## Mission

For every open, non-draft pull request that is not yet merged: if its CI is failing, post the comment `@kody fix-ci` on the PR. Otherwise do nothing.

A PR enters this mission's scope as soon as it becomes ready for review (non-draft, open). It leaves scope when it is merged or closed.

## Allowed Commands

`@kody fix-ci`

## Restrictions

- Only act when the PR's CI rollup is failing — at least one check is `FAILURE`/`TIMED_OUT` and no checks are still `IN_PROGRESS`/`QUEUED`. Skip passing, pending, draft, merged, closed.
- Do not modify the issue, the PR body, the PR title, labels (except as instructed below), or any code.
- Do not re-issue `@kody fix-ci` on the same head SHA more than 2 times.
- After 2 failed attempts on a SHA: post `kody fix-ci stuck — needs human` and add label `kody:stuck-ci`; skip until SHA changes or label is removed.

## Tick procedure — REQUIRED

This tick is **fully scripted**. The script [auto-fix-ci-tick.sh](.kody/scripts/auto-fix-ci-tick.sh) is the **single source of truth** for which PRs are candidates, what state mutations to make, and which comments to post.

Other missions in this repo silently dropped candidates or hallucinated PR state when driven by prose iteration alone. The script removes that failure mode entirely.

You **MUST**:

1. Run exactly: `bash .kody/scripts/auto-fix-ci-tick.sh`
2. Emit the script's stdout verbatim — including the markdown summary table and the `kody-mission-next-state` fenced block at the end.

You **MUST NOT**:

- Call `gh pr list` yourself.
- Filter, decide actions, post comments, or mutate state outside the script.
- Use any prior knowledge of PR numbers in this repo. The script's output is your only data source for this tick.
- Re-run the script (it has side effects). One invocation per tick.

If the script exits non-zero, surface its stderr and emit a state block with the prior `perPr` unchanged so progress isn't lost.

## State shape

`data.perPr` is a map of PR number → `{ lastSha: string, attempts: number, stuck: boolean }`.
