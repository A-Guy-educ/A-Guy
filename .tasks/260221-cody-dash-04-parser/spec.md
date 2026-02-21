# TASK-04: Bot Comment Parser

## Summary
Parse all Cody/Supervisor bot comment types from GitHub issue comments into structured data. This is the most critical parsing logic — all kanban column derivation depends on it.

## Task Type
implement_feature

## Dependencies
- TASK-02 (types)

## Requirements

### R1: Create task-parser.ts
- File: `src/lib/cody/task-parser.ts`

**Exports**:
```typescript
// Parse a single GitHub comment into structured data (or null if unrecognized)
export function parseComment(comment: { body: string; created_at: string; user?: { login: string } }): ParsedComment | null

// Parse all comments, filtering out nulls
export function parseAllComments(comments: Array<{ body: string; created_at: string; user?: { login: string } }>): ParsedComment[]

// Find the latest comment of a specific type (by created_at date)
export function getLatestByType(comments: ParsedComment[], type: CommentType): ParsedComment | null

// Extract stage progress from a running status comment body
export function extractStageProgress(body: string): StageProgress[]
```

### R2: Comment type detection regexes

**IMPORTANT**: Comments are NOT edited in-place. Each `postComment()` call creates a NEW comment. Multiple comments of the same type may exist. Always use `getLatestByType()` to find the most recent.

| Type | Detection | Extract |
|------|-----------|---------|
| `task-marker` | `/🎯 Task created: \`(\d{6}-[a-zA-Z0-9-]+)\`/` | taskId, mode from `(\`{mode}\` mode)` |
| `running-status` | `/^🔄 Cody running for \`(\d{6}-[a-zA-Z0-9-]+)\`/` | taskId, stages via extractStageProgress |
| `success` | `/✅ Cody completed for \`(\d{6}-[a-zA-Z0-9-]+)\`/` | taskId |
| `failure` | `/❌ Pipeline failed for \`([^`]+)\`:\s*(.+)$/s` | taskId, error |
| `cody-failed` | `/❌ Cody failed for \`([^`]+)\`/` | taskId |
| `timeout` | `/⏰ Cody timed out for \`([^`]+)\`/` | taskId |
| `gate-hard-stop` | `/## 🚫 Hard Stop/` | (no taskId in gate comments) |
| `gate-risk` | `/## 🚦 Risk Gate/` | (no taskId in gate comments) |
| `clarify-stop` | `/stopped at clarify stage/` | — |
| `supervisor-retry` | `/\[supervisor-retry:\s*(\d+)\/(\d+)\]/` | retryNumber, maxRetries, taskId from backticks |
| `supervisor-exhausted` | `/Max Retries Exhausted/` AND has `[supervisor-retry:` | retryNumber, taskId |
| `supervisor-error` | `/## Supervisor Error/` | — |
| `gate-approval` | `/^\/cody\s+approve/` | (must NOT be from bot) |
| `gate-rejection` | `/^\/cody\s+reject/` | (must NOT be from bot) |
| `vercel-preview` | `/\[Visit Preview\]\((https:\/\/[^\)]+)\)/` | previewUrl (from vercel[bot] comment on PR) |

### R3: extractStageProgress
Parses the stage lines from running status comments:
```
  ✅ taskify (2s)
  ✅ spec (45s)
  🔄 architect
  ⏳ build
```
Returns `StageProgress[]` with name, icon, elapsed.

### R4: Comment ordering
`getLatestByType` sorts by `createdAt` descending and returns the first match. This handles the case where multiple status comments exist (since editComment is unimplemented).

## Files to Create
- `src/lib/cody/task-parser.ts` (NEW)
- `tests/unit/lib/cody/task-parser.test.ts` (NEW)

## Tests

Test file: `tests/unit/lib/cody/task-parser.test.ts`

Use real comment samples derived from the codebase:

1. **Parse task marker**: Input: `🎯 Task created: \`260219-auto-98\` (\`full\` mode)\nRun: https://github.com/owner/repo/actions/runs/123` → type: 'task-marker', taskId: '260219-auto-98', mode: 'full'

2. **Parse running status**: Input: `🔄 Cody running for \`260219-auto-98\` (mode: full)\nRun: https://...\n\n  ✅ taskify (2s)\n  ✅ spec (1m 30s)\n  🔄 architect` → type: 'running-status', stages: [{name: 'taskify', icon: '✅', elapsed: '2s'}, ...]

3. **Parse success**: Input: `✅ Cody completed for \`260219-auto-98\`!\nMode: full` → type: 'success'

4. **Parse failure (catch block)**: Input: `❌ Pipeline failed for \`260219-auto-98\`: Stage "build" failed after 2 retries` → type: 'failure', error contains 'Stage "build" failed'

5. **Parse failure (status)**: Input: `❌ Cody failed for \`260219-auto-98\`` → type: 'cody-failed'

6. **Parse timeout**: Input: `⏰ Cody timed out for \`260219-auto-98\`` → type: 'timeout'

7. **Parse hard-stop gate**: Input: `## 🚫 Hard Stop: Approval Required\n\nThis task has been classified as **high risk**...` → type: 'gate-hard-stop'

8. **Parse risk gate**: Input: `## 🚦 Risk Gate: Approval Required\n\nThis task has been classified as **medium risk**...` → type: 'gate-risk'

9. **Parse clarify stop**: Input: `🔄 Cody stopped at clarify stage - questions need answering:\n\n## Questions...` → type: 'clarify-stop'

10. **Parse supervisor retry**: Input: `[supervisor-retry: 2/3]\n\n## Failure Analysis\n\n**Failed stage:** \`build\`\n**Error:** ...\n\n---\n/cody rerun 260219-auto-98 --feedback "..."` → type: 'supervisor-retry', retryNumber: 2, maxRetries: 3

11. **Parse supervisor exhausted**: Input: `[supervisor-retry: 3/3]\n\n## Supervisor: Max Retries Exhausted\n\nSupervisor exhausted **3/3** retry attempts for \`260219-auto-98\`.` → type: 'supervisor-exhausted'

12. **Parse gate approval (human)**: Input: `/cody approve`, user: { login: 'aguy' } → type: 'gate-approval'

13. **Parse gate rejection (human)**: Input: `/cody reject`, user: { login: 'aguy' } → type: 'gate-rejection'

14. **Ignore bot gate commands**: Input: `/cody approve`, user: { login: 'github-actions[bot]' } → returns null

15. **Unknown comment**: Input: `Thanks for the update!` → returns null

16. **getLatestByType**: Given multiple success comments with different dates, returns the latest one

17. **parseAllComments**: Filters out nulls, returns only parsed comments

## Acceptance Criteria
- [ ] All 17 tests pass
- [ ] `pnpm tsc --noEmit` passes
- [ ] Every bot comment type from `scripts/cody/cody-utils.ts` and `scripts/supervisor/retry-tracker.ts` is covered
- [ ] getLatestByType correctly sorts by date and returns newest

## Notes
- The actual comment format is defined in `scripts/cody/cody-utils.ts` (postComment, formatStatusComment, ensureTaskMarkerComment) and `scripts/supervisor/retry-tracker.ts` (formatRetryTag, formatExhaustedComment, formatAnalysisComment).
- gate-approval/rejection: Only count human comments (not bot). Check `user.login !== 'github-actions[bot]'`.
- supervisor-exhausted has BOTH the retry tag AND "Max Retries Exhausted" text. Parse both the retry count and the exhausted flag.
