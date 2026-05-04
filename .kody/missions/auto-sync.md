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

## State

`data.perPr` is a map of PR number → `{ lastSha: string, attempts: number, stuck: boolean, lastActionAt: string | null }`.

On tick start:
1. Read `data.perPr` from prior state (default `{}`).
2. List candidate PRs: `gh pr list --state open --json number,isDraft,headRefOid,baseRefName,mergeable,labels,statusCheckRollup`.
3. Filter to non-draft PRs that are `MERGEABLE` (skip `CONFLICTING` and `UNKNOWN`) and do not have label `kody:no-sync`.
4. For **every** candidate, compute commits-behind: `gh api repos/{owner}/{repo}/compare/{base}...{head} --jq '.behind_by'`. Do not skip any candidate from this enumeration; the behind-count check decides per PR, not the prompt.

For each candidate PR `n` with current head SHA `currentSha`, behind-count `behind`, and current time `now`, decide an action:
- If `behind < 5`: action = `skip`.
- If any check in `statusCheckRollup` has `status` of `IN_PROGRESS` or `QUEUED`: action = `skip`.
- If `perPr[n]?.lastSha !== currentSha`: reset `perPr[n] = { lastSha: currentSha, attempts: 0, stuck: false, lastActionAt: null }` (this is a state-only change, not an action).
- If `perPr[n].stuck === true`: action = `skip`.
- If `perPr[n].lastActionAt` is within the last 6 hours of `now`: action = `skip`.
- If `perPr[n].attempts >= 2`: action = `mark-stuck` (post stuck comment, add `kody:stuck-sync` label).
- Otherwise: action = `sync` (comment `@kody sync` on the PR).

Apply each action. **State-mutation rules (strict):**
- Only update `perPr[n].lastActionAt` and `perPr[n].attempts` on a PR `n` when you actually posted a comment on PR `n` in this tick. Never bump these fields speculatively, in batch, or for PRs you decided to skip.
- The `lastSha` reset on SHA-change is the only state mutation that is not gated on a posted comment.
- If a PR is skipped (any reason), its `perPr[n]` entry must be byte-identical to what was read in (other than the `lastSha` reset rule above).

There is no per-tick action cap. Iterate every candidate and act on each one whose decision was `sync` or `mark-stuck`.

Garbage collection:
- Drop entries from `data.perPr` whose PR is no longer in the open, non-draft candidate set (merged, closed, returned to draft, or labeled `kody:no-sync`).

On tick end: emit the updated `data.perPr` inside the next state block.
