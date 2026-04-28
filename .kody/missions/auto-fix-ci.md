# auto fix-ci

## Mission

For every open, non-draft pull request that is not yet merged: if its CI is failing, post the comment `@kody fix-ci` on the PR. Otherwise do nothing.

A PR enters this mission's scope as soon as it becomes ready for review (non-draft, open). It leaves scope when it is merged or closed.

## Allowed Commands

`@kody fix-ci`

## Restrictions

- Only act when the PR's CI status is `failure`. Do not act on PRs that are passing, pending, draft, merged, or closed.
- Do not modify the issue, the PR body, the PR title, labels (except as instructed below), or any code.
- Do not re-issue `@kody fix-ci` on the same head SHA more than 2 times.
- After 2 failed attempts on a SHA: post the comment `kody fix-ci stuck — needs human` on the PR, add the label `kody:stuck-ci`, and skip the PR until its head SHA changes or the label is removed.
- One action per tick per PR. Do not loop within a single tick.

## State

`data.perPr` is a map of PR number → `{ lastSha: string, attempts: number, stuck: boolean }`.

On tick start:
1. Read `data.perPr` from prior state (default `{}`).
2. List candidate PRs: `gh pr list --state open --json number,isDraft,headRefOid,mergeable,statusCheckRollup`.
3. Filter to non-draft PRs whose latest commit status rollup is `FAILURE`.

For each candidate PR `n` with current head SHA `currentSha`:
- If `perPr[n]?.lastSha !== currentSha`: reset `perPr[n] = { lastSha: currentSha, attempts: 0, stuck: false }`.
- If `perPr[n].stuck === true`: skip.
- If `perPr[n].attempts >= 2`: set `perPr[n].stuck = true`, post stuck comment, add `kody:stuck-ci` label, skip.
- Otherwise: comment `@kody fix-ci` on the PR, set `perPr[n].lastSha = currentSha`, increment `perPr[n].attempts`.

Garbage collection:
- Drop entries from `data.perPr` whose PR is no longer in the open, non-draft candidate set (merged, closed, or returned to draft).

On tick end: emit the updated `data.perPr` inside the next state block.
