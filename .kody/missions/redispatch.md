# redispatch

## Mission

For every open issue that kody is actively working on but appears stuck: post the comment `@kody resume` on the issue so the engine re-dispatches from its last persisted state. Otherwise do nothing.

This mission is a safety net, not a fix. It catches issues where the state machine ended a phase (e.g. `CLASSIFIED_AS_BUG`) but never advanced to the next executable. It does not diagnose why the stall happened — that is for the engine team to debug from the resume log.

An issue enters this mission's scope when it has a kody state block (`<!-- kody:state:v1:begin -->` … `<!-- kody:state:v1:end -->`), is open, and the persisted `core.status` is `running`. It leaves scope when it is closed, when `core.status` is no longer `running`, or when its most recent history entry is fresh.

## Allowed Commands

`@kody resume`

## Restrictions

- **Dry-run mode is currently ENABLED.** While dry-run is on: do NOT post the `@kody resume` comment, do NOT post the stuck comment, and do NOT add the `kody:stuck` label. Instead, for every issue that *would* have been actioned, append an entry to `data.dryRunLog` (max 50 most recent entries) with `{ issueNumber, action: "resume" | "mark-stuck", reason, plannedAt: ISO }`. To disable dry-run, remove this bullet entirely.
- **Live-test scope gate is currently ENABLED.** When dry-run is OFF, only act (post `@kody resume`, post the stuck comment, add `kody:stuck`) on issues that carry the label `kody:test-redispatch`. While dry-run is ON, this gate is ignored — continue logging all candidates to `data.dryRunLog` so the gate's effect on live behavior can be previewed. To go full live (act on every stuck issue, opt-out via `kody:no-redispatch`), remove this bullet entirely.
- Only act when ALL of the following are true for the issue:
  - `core.status === "running"` in the most recent kody state block.
  - The most recent `history[*].timestamp` (or `core.lastOutcome.timestamp` if history is empty) is older than **40 minutes**.
  - No in-progress `workflow_run` references this issue (`gh run list --json status,databaseId,event,headBranch,displayTitle` filtered to active runs that mention the issue number in title or branch).
  - No open kody-authored PR is linked to this issue.
  - No comment authored by `kody` (or the engine bot) has been posted on the issue in the last 40 minutes.
- Do not act on issues with the label `kody:stuck`, `kody:no-redispatch`, or `kody:stalled`.
- Do not modify the issue body, the issue title, labels (except as instructed below), or any code.
- Do not re-issue `@kody resume` on the same issue more than **1 time per UTC day**.
- After 1 failed auto-resume attempt that did not advance the state within 40 minutes: post the comment `kody resume did not advance state — needs human` on the issue, add the label `kody:stuck`, and skip the issue until the label is removed or the state advances.
- One action per tick per issue. Do not loop within a single tick.

## State

`data.perIssue` is a map of issue number → `{ lastResumedAt: string (ISO), lastResumedHistoryTimestamp: string (ISO), attemptsToday: number, stuck: boolean }`.

`data.dryRunLog` is an array (FIFO, capped at 50) used only while dry-run mode is enabled. Each entry: `{ issueNumber: number, action: "resume" | "mark-stuck", reason: string, plannedAt: string (ISO) }`.

On tick start:
1. Read `data.perIssue` from prior state (default `{}`).
2. Reset `attemptsToday` to `0` for entries whose `lastResumedAt` is on a prior UTC day.
3. List candidate issues: `gh issue list --state open --limit 200 --json number,labels,updatedAt,body` (also fetch full body via `gh issue view <n>` when the listing truncates the state block).
4. For each issue, parse the latest kody state block from the body or comments. Skip issues with no state block.
5. Filter to issues where `core.status === "running"` AND the latest history/lastOutcome timestamp is older than 40 minutes.
6. Drop any issue with the labels `kody:stuck`, `kody:no-redispatch`, or `kody:stalled`.
7. Drop any issue with an in-flight workflow run that references the issue, or an open kody-authored PR linked to it, or a kody comment newer than 40 minutes.

For each remaining candidate issue `n`:
- Compute `currentHistoryTimestamp` = the most recent `history[*].timestamp` (or `core.lastOutcome.timestamp`).
- If `perIssue[n]?.stuck === true`: skip.
- If `perIssue[n]?.attemptsToday >= 1`:
  - If `currentHistoryTimestamp === perIssue[n].lastResumedHistoryTimestamp` (state did not advance after the prior resume): set `perIssue[n].stuck = true`, post the stuck comment, add the `kody:stuck` label, skip.
  - Otherwise: skip silently (we already resumed today and the state did move; let it run).
- Otherwise: comment `@kody resume` on the issue, set `perIssue[n] = { lastResumedAt: now, lastResumedHistoryTimestamp: currentHistoryTimestamp, attemptsToday: (perIssue[n]?.attemptsToday ?? 0) + 1, stuck: false }`.

Garbage collection:
- Drop entries from `data.perIssue` whose issue is closed, has `core.status !== "running"`, or has the `kody:stuck` / `kody:no-redispatch` label.

On tick end: emit the updated `data.perIssue` inside the next state block.
