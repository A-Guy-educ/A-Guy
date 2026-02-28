# Plan: Cody Dashboard — Missing Status Indicators in List Items

## Expert Review Feedback (Incorporated)

**Web Expert**: Approved with 4 concerns:
1. Bot icon should go **after** `#NNN` (not before) to preserve number alignment ✅ Fixed
2. `clarifyWaiting` from labels is fragile — pipeline doesn't set labels ✅ Fixed (detail-only)
3. Fix `timed_out` column bug while adding `isTimeout` ✅ Fixed
4. Merge Steps 2+3 into one atomic step ✅ Fixed

**Cody Expert**: Approved with critical corrections:
1. `pipeline.controlMode` is **NOT persisted** — field is always `undefined` at runtime ✅ Fixed (gate type detail-only)
2. Pipeline does NOT set any GitHub labels — label checks are dead code ✅ Documented
3. `workflowRun.conclusion === 'timed_out'` is correct but currently falls through to `open` — bug ✅ Fixed
4. Gate type can only be determined from comment body parsing (detail route only) ✅ Fixed

## Research Summary

### Complete Cody State Map

| # | State | Signal Source | Currently Shown? | Fix |
|---|-------|--------------|-----------------|-----|
| 1 | **Unassigned** (backlog) | No assignees | ✅ "Backlog" label | — |
| 2 | **Assigned to Cody** | `isCodyAssigned` | ⚠️ Small text, not prominent | Step 1: Bot icon |
| 3 | **Building** | workflow `in_progress` | ✅ Spinner + pipeline bar | — |
| 4 | **Gate: Risk** | `gate-request` comment with `🚦` | ⚠️ Generic "Gate" label | Step 2: Distinguish |
| 5 | **Gate: Hard Stop** | `gate-request` comment with `🚫` | ❌ Not distinguished | Step 2: Show "Hard Stop" |
| 6 | **Clarify Stop** | `clarify-stop` comment | ❌ Not shown | Step 2: "Needs Answer" |
| 7 | **Retrying** | `supervisor-retry` comment | ✅ "Retrying" label | — |
| 8 | **Failed** | workflow `failure` | ✅ "Failed" label | — |
| 9 | **Timeout** | workflow `timed_out` | ❌ Falls through to "open" (BUG) | Step 2: Fix + show |
| 10 | **Retries Exhausted** | `supervisor-exhausted` comment | ❌ Grouped into "Failed" | Step 2: Distinguish |
| 11 | **In Review** | Associated PR | ✅ "In Review" + PR link | — |
| 12 | **Done** | `agent:done` / closed | ✅ "Done" label | — |
| 13 | **Supervisor Error** | `supervisor-error` comment | ❌ Not shown | Step 2: "System Error" |

### Critical Data Discovery

- **`pipeline.controlMode` is NOT persisted** — always `undefined` (engine resolves dynamically per G42)
- **`pipeline.gatePoint` is NOT persisted** — always `undefined` (cleared in V1 format conversion)
- **Pipeline does NOT set GitHub labels** — `agent:running`, `agent:error`, `agent:done` label checks in `getColumnForIssue` are dead code
- **`workflowRun.conclusion === 'timed_out'` is a valid GitHub value** but currently NOT handled by `getColumnForIssue` (falls through to `open` — BUG)
- **Gate type and clarify-stop can ONLY be determined from comment parsing** (detail route)

### Data Availability by Route

| Field | List Route (bulk) | Detail Route (per-task) |
|-------|------------------|------------------------|
| `isTimeout` | ✅ `workflowRun.conclusion === 'timed_out'` | ✅ `timeout` comment type |
| `gateType` | ❌ Not available (no labels, no pipeline field) | ✅ Comment body `🚫` vs `🚦` |
| `gateStage` | ❌ Not available | ✅ Comment body parsing |
| `clarifyWaiting` | ❌ Not available (no labels set by pipeline) | ✅ `clarify-stop` comment type |
| `isExhausted` | ❌ Requires comments | ✅ `supervisor-exhausted` comment |
| `isSupervisorError` | ❌ Requires comments | ✅ `supervisor-error` comment |

---

## Plan: 2 Steps

### Step 1: Make Cody Assignment Visually Prominent

**Problem**: You can't quickly scan which items Cody owns. The `🤖 Cody` text is small and blends into the meta row.

**Files to Touch**:
- `src/ui/cody/components/TaskList.tsx` (MODIFIED — lines 162-201)

**Exact Behavior**:
- Move the Bot icon from the meta row to **immediately after** the `#NNN` issue number, inline:
  ```tsx
  <span className="text-xs text-muted-foreground font-mono shrink-0 inline-flex items-center gap-1">
    #{task.issueNumber}
    {task.isCodyAssigned && <Bot className="w-3 h-3 text-blue-400" />}
  </span>
  ```
- This keeps numbers vertically aligned while making Cody ownership scannable
- Remove the separate `🤖 Cody` line from the meta indicators section (lines 189-193)
- Keep the human assignee indicator (`👤 username`) in the meta row — it stays as-is for non-Cody assignees

**Tests**:
- `tests/unit/ui/cody/task-list-assignment.test.tsx`:
  1. Render TaskList with `isCodyAssigned: true` → expect Bot icon adjacent to issue number
  2. Render TaskList with `isCodyAssigned: false, assignees: [{login: 'aguy'}]` → expect User icon in meta row, NO Bot icon near issue number
  3. Render TaskList with `isCodyAssigned: false, assignees: []` → expect NO Bot icon, NO User icon

**Acceptance Criteria**:
- [ ] Tasks assigned to Cody have a blue bot icon right after `#NNN`
- [ ] Tasks not assigned have no bot icon
- [ ] Issue numbers remain vertically aligned
- [ ] Human assignees still show in meta row
- [ ] Mobile layout preserved

---

### Step 2: Add Missing Substatus Indicators + Fix Timeout Bug

**Problem**: Several Cody states are invisible or misclassified in the list UI.

**Files to Touch**:
- `src/ui/cody/types.ts` (MODIFIED — add substatus fields to CodyTask)
- `src/app/api/cody/tasks/route.ts` (MODIFIED — fix timeout bug, derive `isTimeout`)
- `src/app/api/cody/tasks/[taskId]/route.ts` (MODIFIED — derive all substatus fields from comments)
- `src/ui/cody/components/TaskList.tsx` (MODIFIED — render substatus variations)

#### 2a. Type Changes (`types.ts`)

Add to `CodyTask` interface:
```ts
// Substatus fields — progressively populated
// List view: only isTimeout available
// Detail view: all fields populated from comment parsing
gateType?: 'hard-stop' | 'risk-gated'    // which gate type
gateStage?: string                         // which stage ('taskify' | 'architect')
clarifyWaiting?: boolean                   // waiting for user answers
isTimeout?: boolean                        // pipeline timed out
isExhausted?: boolean                      // retries exhausted (terminal)
isSupervisorError?: boolean                // infrastructure error
```

#### 2b. API Bug Fix + Data Wiring (`route.ts` list route)

**Bug fix** in `getColumnForIssue` — add `timed_out` handling:
```ts
if (workflowRun?.status === 'completed') {
  if (workflowRun.conclusion === 'failure') return 'failed'
  if (workflowRun.conclusion === 'timed_out') return 'failed'  // FIX: was falling through to 'open'
  if (workflowRun.conclusion === 'cancelled') return 'failed'  // Also handle cancelled
}
```

**Data wiring** — set `isTimeout` on task:
```ts
isTimeout: workflowRun?.conclusion === 'timed_out',
```

Note: `gateType`, `gateStage`, `clarifyWaiting`, `isExhausted`, `isSupervisorError` are NOT available in the list route (require comment parsing). They will be `undefined` in list view and populated in detail view.

#### 2c. Detail Route Data Wiring (`[taskId]/route.ts`)

After parsing comments in `buildCodyTask`, derive substatus fields:
```ts
// In buildCodyTask, after existing comment parsing:
const lastGateRequest = [...comments].reverse().find(c => c.type === 'gate-request')
const lastGateApproval = [...comments].reverse().find(c => c.type === 'gate-approval')
const hasClarifyStop = comments.some(c => c.type === 'clarify-stop')
const hasExhausted = comments.some(c => c.type === 'supervisor-exhausted')
const hasSupervisorError = comments.some(c => c.type === 'supervisor-error')
const hasTimeout = comments.some(c => c.type === 'timeout')

// Gate type from comment body
let gateType: 'hard-stop' | 'risk-gated' | undefined
let gateStage: string | undefined
if (lastGateRequest && (!lastGateApproval || lastGateRequest.createdAt > lastGateApproval.createdAt)) {
  gateType = lastGateRequest.body.includes('🚫 Hard Stop') ? 'hard-stop' : 'risk-gated'
  // Extract gate stage from body (e.g., "paused at architect gate")
  const stageMatch = lastGateRequest.body.match(/at (\w+) gate/)
  gateStage = stageMatch?.[1]
}

// Set on task
task.gateType = gateType
task.gateStage = gateStage
task.clarifyWaiting = hasClarifyStop && column !== 'done'
task.isTimeout = hasTimeout
task.isExhausted = hasExhausted
task.isSupervisorError = hasSupervisorError
```

#### 2d. UI Rendering (`TaskList.tsx`)

Replace the generic status label with substatus-aware rendering. The status label badge (lines 173-186) becomes:

**For `gate-waiting` column**:
- Default: Yellow pill "Gate" (current)
- If `gateType === 'hard-stop'`: Red-orange pill "🚫 Hard Stop"
- If `gateType === 'risk-gated'`: Yellow pill "🚦 Review Gate"
- If `gateStage`: Append " · {stage}" (e.g., "Hard Stop · architect")

**For `failed` column**:
- Default: Red pill "Failed" (current)
- If `isTimeout`: Orange pill "⏰ Timeout"
- If `isExhausted`: Dark red pill "Exhausted"
- If `isSupervisorError`: Red pill "System Error"

**For `open` or `building` column**:
- If `clarifyWaiting`: Additional amber pill "💬 Needs Answer" after the main status label

**Progressive enhancement**: If substatus fields are `undefined` (list view), fall back to the current column label. When user clicks a task and detail data loads, substatus appears.

**Rendering approach** — create a helper function:
```tsx
function getStatusDisplay(task: CodyTask): { label: string; className: string } {
  const indicator = statusIndicator[task.column]
  
  // Substatus overrides for gate-waiting
  if (task.column === 'gate-waiting') {
    if (task.gateType === 'hard-stop') {
      const stage = task.gateStage ? ` · ${task.gateStage}` : ''
      return { label: `🚫 Hard Stop${stage}`, className: 'text-red-400 bg-red-500/10' }
    }
    if (task.gateType === 'risk-gated') {
      const stage = task.gateStage ? ` · ${task.gateStage}` : ''
      return { label: `🚦 Review${stage}`, className: 'text-yellow-400 bg-yellow-500/10' }
    }
  }
  
  // Substatus overrides for failed
  if (task.column === 'failed') {
    if (task.isTimeout) return { label: '⏰ Timeout', className: 'text-orange-400 bg-orange-500/10' }
    if (task.isExhausted) return { label: 'Exhausted', className: 'text-red-500 bg-red-600/10' }
    if (task.isSupervisorError) return { label: 'System Error', className: 'text-red-400 bg-red-500/10' }
  }
  
  // Default: use column label
  return { label: indicator.label, className: /* existing column styling */ }
}
```

For `clarifyWaiting`, add an **additional** badge after the main status label:
```tsx
{task.clarifyWaiting && (
  <span className="text-[11px] font-medium px-1.5 py-0.5 rounded text-amber-400 bg-amber-500/10">
    💬 Needs Answer
  </span>
)}
```

**Tests**:
- `tests/unit/ui/cody/task-list-substatus.test.tsx`:
  1. Task with `column: 'gate-waiting'` and no `gateType` → renders "Gate" (current behavior)
  2. Task with `column: 'gate-waiting', gateType: 'hard-stop', gateStage: 'architect'` → renders "🚫 Hard Stop · architect" in red-orange
  3. Task with `column: 'gate-waiting', gateType: 'risk-gated'` → renders "🚦 Review" in yellow
  4. Task with `column: 'failed'` and no substatus → renders "Failed" in red (current behavior)
  5. Task with `column: 'failed', isTimeout: true` → renders "⏰ Timeout" in orange
  6. Task with `column: 'failed', isExhausted: true` → renders "Exhausted" in dark red
  7. Task with `clarifyWaiting: true, column: 'open'` → renders "Backlog" AND "💬 Needs Answer"
  8. Task with `column: 'failed', isSupervisorError: true` → renders "System Error"
- `tests/unit/ui/cody/api-timeout-bug.test.ts`:
  1. `getColumnForIssue` with `workflowRun: { status: 'completed', conclusion: 'timed_out' }` → returns `'failed'`
  2. `getColumnForIssue` with `workflowRun: { status: 'completed', conclusion: 'cancelled' }` → returns `'failed'`
  3. Task built with `timed_out` conclusion → `isTimeout === true`

**Acceptance Criteria**:
- [ ] BUG FIX: Timed-out workflows now correctly map to `failed` column (was `open`)
- [ ] BUG FIX: Cancelled workflows now correctly map to `failed` column
- [ ] Gate-waiting tasks show "🚫 Hard Stop" or "🚦 Review" when substatus available (detail view)
- [ ] Gate-waiting tasks show generic "Gate" when substatus unavailable (list view fallback)
- [ ] Timeout failures show "⏰ Timeout" in orange in both list and detail views
- [ ] Exhausted retries show "Exhausted" in dark red (detail view only)
- [ ] Supervisor errors show "System Error" (detail view only)
- [ ] Clarify-waiting tasks show "💬 Needs Answer" badge (detail view only)
- [ ] All existing list item features still work
- [ ] No N+1 API calls added to list endpoint
- [ ] Mobile layout preserved

---

## Implementation Notes

### What NOT to change:
- Column system (ColumnId type) — substates render within existing columns
- Left color bar behavior
- Pipeline progress bar
- Mobile responsive layout
- Polling intervals or smart refresh

### Known Limitations (documented):
- Gate type, clarify-stop, exhausted, and supervisor-error are **only available in detail view** (requires comment parsing)
- In list view, only `isTimeout` is available from bulk workflow run data
- `agent:running`, `agent:error`, `agent:done` label checks in `getColumnForIssue` appear to be dead code (pipeline doesn't set labels) — not removing them to avoid breaking existing behavior in case labels are set manually

### Progressive Enhancement Pattern:
```
List view (bulk, cheap):
  workflowRun.conclusion === 'timed_out' → isTimeout ✅
  Everything else → undefined (fall back to column label)

Detail view (per-task, has comments):
  Comment parsing → gateType, gateStage, clarifyWaiting, isExhausted, isSupervisorError
  All substatus fields populated → richer UI
```
