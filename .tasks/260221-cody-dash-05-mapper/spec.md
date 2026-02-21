# TASK-05: Board Mapper (Column Derivation)

## Summary
Derive kanban board columns from issue state, parsed comments, workflow runs, and associated PRs. This is the core logic that determines which column each task appears in.

## Task Type
implement_feature

## Dependencies
- TASK-02 (types), TASK-04 (parser — uses ParsedComment type)

## Requirements

### R1: Create board-mapper.ts
- File: `src/lib/cody/board-mapper.ts`

**Exports**:
```typescript
// Derive which column a task belongs to
export function deriveColumn(
  issue: { state: string; closed_at?: string | null },
  comments: ParsedComment[],
  workflowRun?: { status: string } | null,
  associatedPR?: { merged: boolean; merged_at?: string | null } | null,
): ColumnId

// Organize tasks into columns
export function organizeBoard(tasks: CodyTask[]): Record<ColumnId, CodyTask[]>

// Determine which columns to show (always show open/building/done, others only if populated)
export function getVisibleColumns(tasks: CodyTask[]): ColumnId[]
```

### R2: Column derivation logic

The order of checks matters — higher priority states are checked first:

1. **Done**: Latest `success` comment exists AND is newer than any `failure`/`cody-failed` comment. OR `associatedPR?.merged` is true.
2. **Failed**: Has `failure` or `cody-failed` comment AND has `supervisor-exhausted` comment.
3. **Gate Waiting**: Has `gate-hard-stop` or `gate-risk` comment AND no `gate-approval` comment that is newer than the gate comment.
4. **Retrying**: Has `supervisor-retry` comment(s) AND has `failure`/`cody-failed` AND NOT `supervisor-exhausted`.
5. **Building**: Has `task-marker` comment AND `workflowRun?.status === 'in_progress'`.
6. **Review**: Has associated PR that is not merged.
7. **Building** (fallback): Has `task-marker` comment (pipeline may be queued or between steps).
8. **Open**: No `task-marker` comment found.

### R3: organizeBoard
Groups tasks by their column. Returns a Record with all 7 column IDs as keys (empty arrays for unused columns).

### R4: getVisibleColumns
Returns column IDs that should be displayed:
- Always: 'open', 'building', 'done'
- Only if populated: 'gate-waiting', 'retrying', 'review', 'failed'
- Ordered by COLUMN_DEFS order

## Files to Create
- `src/lib/cody/board-mapper.ts` (NEW)
- `tests/unit/lib/cody/board-mapper.test.ts` (NEW)

## Tests

Test file: `tests/unit/lib/cody/board-mapper.test.ts`

11 scenarios for `deriveColumn`:

1. **No task marker → 'open'**: Empty comments, no workflow → 'open'
2. **Task marker + running workflow → 'building'**: Has task-marker, workflow status 'in_progress' → 'building'
3. **Task marker + no workflow → 'building'**: Has task-marker, no workflow → 'building' (queued)
4. **Completion → 'done'**: Has task-marker + success comment → 'done'
5. **PR merged → 'done'**: Has task-marker, associatedPR with merged=true → 'done'
6. **Failure + exhausted → 'failed'**: Has failure + supervisor-exhausted → 'failed'
7. **Hard-stop gate, no approval → 'gate-waiting'**: Has gate-hard-stop, no gate-approval → 'gate-waiting'
8. **Risk gate then approved → building**: Has gate-risk, then gate-approval (newer) → 'building'
9. **Supervisor retry, not exhausted → 'retrying'**: Has failure + supervisor-retry, no exhausted → 'retrying'
10. **Open PR (not merged) → 'review'**: Has task-marker, associatedPR with merged=false → 'review'
11. **Completion after failure (recovery) → 'done'**: Has failure then success (newer) → 'done'

3 scenarios for `getVisibleColumns`:
12. **Only open tasks**: Returns ['open', 'building', 'done'] (always-show columns)
13. **Has failed task**: Returns ['open', 'building', 'failed', 'done']
14. **All column types populated**: Returns all 7 in order

1 scenario for `organizeBoard`:
15. **Groups tasks correctly**: Given 5 tasks in different columns, organizeBoard returns correct grouping

## Acceptance Criteria
- [ ] All 15 tests pass
- [ ] `pnpm tsc --noEmit` passes
- [ ] Column derivation handles all lifecycle states
- [ ] Recovery scenario (success after failure) correctly shows 'done'

## Notes
- Import `ParsedComment`, `ColumnId`, `CodyTask` from `../types`
- Import `COLUMN_DEFS` from `../constants`
- Use `getLatestByType` from task-parser for finding newest comments
- Date comparison is critical — always compare `createdAt` timestamps when multiple comments of different types exist
