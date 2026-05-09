# Memorize

## Job

Daily synthesis of recently merged PRs into the project's long-term memory at `.kody/memory/` — a markdown knowledge base of decisions, conventions, and component knowledge that future kody runs can recall.

**Cadence guard.** Run at most once every 20 hours. If `data.lastRunISO` is within 20 hours of now, emit unchanged state and exit.

**Per tick (one rolling PR):**

1. Compute `since` = `data.lastMemoryUpdateISO` if set, else 36 hours ago.
2. List merged PRs since `since`:
   ```
   gh pr list --state merged --base $(gh repo view --json defaultBranchRef -q .defaultBranchRef.name) \
     --search "merged:>$since" --json number,title,url,mergedAt,body --limit 25
   ```
3. If the list is empty: emit unchanged state with bumped `lastRunISO`, `cursor: idle`, exit.
4. Index the existing memory: `find .kody/memory -name '*.md' -type f` (cap 200 entries). For each, read just the frontmatter to know `title` and `type`.
5. For each merged PR, read its diff if needed (`gh pr diff <n>`), decide which concept page(s) it affects — `architecture/<area>.md`, `conventions/<topic>.md`, `decisions/<slug>.md`, `components/<name>.md` — and update or create those pages. **Edit only files under `.kody/memory/`.**
6. Open or update the single rolling PR:
   - Look for an open PR with label `kody:memorize`: `gh pr list --label kody:memorize --state open --json number,headRefName --limit 1`.
   - If none: create branch `kody-memorize-$(date -u +%Y%m%d)` off the default branch, commit the memory edits, push, then `gh pr create --label kody:memorize --title "memory: memorize $(date -u +%Y-%m-%d)" --body "<2–6 line summary of pages touched and why>"`.
   - If one exists: check out its head branch, commit on top, push, and `gh pr edit <n> --body "<refreshed summary>"`.
   - If the label doesn't exist: `gh label create kody:memorize --description "Kody job: memory synthesis"` then retry.

## Allowed Commands

- `gh pr list`, `gh pr view`, `gh pr diff`, `gh pr create`, `gh pr edit`, `gh repo view`, `gh label create`, `gh api` (read-only)
- `git checkout`, `git add .kody/memory`, `git commit`, `git push` — **only on the `kody-memorize-*` branch, never on the default branch**

## Restrictions

- Edit files only under `.kody/memory/`. Never touch other paths.
- Never push to or open PRs against any branch except the rolling `kody-memorize-*` branch.
- Each memory page captures *what was decided* and *why* — not how the code looks. The code is authoritative for that.
- Be terse. One short paragraph per fact, bullets where useful, links instead of recapping.
- Skip PRs whose intent is unclear — don't invent.
- If nothing meaningful to add (PRs are trivial chores or already captured): emit unchanged state with `cursor: idle` and exit. Don't open an empty PR.
- Maximum one PR opened or updated per tick.

## Page conventions

Frontmatter on every page:

```yaml
---
title: <Human Title>
type: architecture | convention | decision | component | runbook
updated: <YYYY-MM-DD>
sources:
  - <PR URL or file path>
---
```

Body: one short intro paragraph, then sections. Cross-reference siblings with relative links: `[executor](../architecture/executor.md)`.

## State

- `cursor`: `idle` | `awaiting-merge`
- `data.lastRunISO`: ISO timestamp of the previous tick (any outcome)
- `data.lastMemoryUpdateISO`: ISO timestamp passed as `since` on the next tick. Bump to `now` only when this tick actually committed memory changes.
- `data.openPr`: number of the currently-open rolling PR (or null)
- `data.nextEligibleISO`: `data.lastRunISO + 20h`. Always emit, every tick. Surfaced as "next run" on the dashboard.
- `done`: always `false`

## Tick output

End with:

```kody-job-next-state
{
  "cursor": "<idle|awaiting-merge>",
  "data": {
    "lastRunISO": "<now>",
    "lastMemoryUpdateISO": "<since-or-now>",
    "openPr": <number-or-null>,
    "nextEligibleISO": "<now+20h>"
  },
  "done": false
}
```
