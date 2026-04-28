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
- One action per tick per PR.

## State

`data.perPr` is a map of PR number → `{ lastSha: string, attempts: number, stuck: boolean, lastActionAt: string | null }`.

On tick start:
1. Read `data.perPr` from prior state (default `{}`).
2. List candidate PRs: `gh pr list --state open --json number,isDraft,headRefOid,baseRefName,mergeable,labels,statusCheckRollup`.
3. Filter to non-draft PRs that are `MERGEABLE` (skip `CONFLICTING` and `UNKNOWN`) and do not have label `kody:no-sync`.
4. For each candidate, compute commits-behind: `gh api repos/{owner}/{repo}/compare/{base}...{head} --jq '.behind_by'`.

For each candidate PR `n` with current head SHA `currentSha`, behind-count `behind`, and current time `now`:
- If `behind < 5`: skip.
- If any check in `statusCheckRollup` has `status` of `IN_PROGRESS` or `QUEUED`: skip.
- If `perPr[n]?.lastSha !== currentSha`: reset `perPr[n] = { lastSha: currentSha, attempts: 0, stuck: false, lastActionAt: null }`.
- If `perPr[n].stuck === true`: skip.
- If `perPr[n].lastActionAt` is within the last 6 hours of `now`: skip.
- If `perPr[n].attempts >= 2`: set `perPr[n].stuck = true`, post stuck comment, add `kody:stuck-sync` label, skip.
- Otherwise: comment `@kody sync` on the PR, set `perPr[n].lastSha = currentSha`, set `perPr[n].lastActionAt = now`, increment `perPr[n].attempts`.

Garbage collection:
- Drop entries from `data.perPr` whose PR is no longer in the open, non-draft candidate set (merged, closed, returned to draft, or labeled `kody:no-sync`).

On tick end: emit the updated `data.perPr` inside the next state block.
