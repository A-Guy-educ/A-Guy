# Task: Engine Contract — Dashboard-Engine Interface

## 1. Scope

```yaml
Feature: KodyEngineContract — convention-based interface between dashboard and any CI/CD engine
Type: feature
Impact: high
```

The dashboard defines 2 contracts. Any engine that follows them works with the dashboard. No imports, no config files, no registration. Communication flows through GitHub (comments, labels, workflow runs). Dashboard validates all incoming data with Zod at runtime.

**Assumption**: The platform is GitHub.

---

## 2. Contracts

### Contract 1: Actions (Dashboard → Engine)

The 5 things a dashboard can tell an engine to do.

```typescript
type EngineAction =
  | { action: 'run'; command: string }
  | { action: 'approve' }
  | { action: 'reject' }
  | { action: 'rerun'; fromStage?: string; feedback?: string }
  | { action: 'abort' }
```

**Trigger convention**: `@{engine} {action} [args]` (comment) or `workflow_dispatch({ issue_number, command })`.

**`run`**: `command` is free-form — each engine parses its own syntax (e.g., `@kody impl --fresh`, `@myengine deploy --env staging`). Kody parses this into typed modes (spec, impl, rerun, fix, full, design-system) at its own layer via `parseCommentInputs`.

**State machine** — which actions are valid per pipeline state:

| State | Valid actions |
|---|---|
| _(none)_ | run |
| running | abort |
| paused | approve, reject, abort |
| failed | rerun, run |
| timeout | rerun, run |
| completed | rerun, run |

### Contract 2: State (Engine → Dashboard)

How the engine communicates state back to the dashboard. Two channels, each with a clear role:

#### Channel A: Labels (quick state for kanban)

**Format**: `{engine}:{suffix}`

| Pipeline state | Label suffix |
|---|---|
| running | `building` |
| completed | `done` |
| failed | `failed` |
| paused | `paused` |
| timeout | `timeout` |

Engine swaps labels on every state transition (removes previous, adds new). Dashboard reads labels for kanban column placement. O(1) — labels are on the issue object, no extra API call.

#### Channel B: Status Comment (rich progress)

**Convention**: The engine owns the status comment lifecycle. Both sides identify it by a marker convention.

**Marker format**: `<!-- {engine}-status:{taskId} -->`

**Engine writes status**:
1. Engine starts a run, knows `issue_number` + `taskId` + its own name
2. Engine scans issue comments for its marker (one API call for typical 5-20 comment issues)
3. If found → PATCH it (edit in place)
4. If not found → POST a new comment with the marker
5. Engine holds `commentId` in process memory for the rest of the run — subsequent updates are PATCH by ID

Engine is stateless between runs. On next run (rerun, fix), it scans again. No persistent state needed.

**Dashboard reads status**:
1. Dashboard checks task record for cached `statusCommentId`
2. If cached → GET by ID (O(1)), use ETag for polling
3. If not cached → scan issue comments for marker (one-time), cache `statusCommentId` on task record
4. If cache is stale (comment deleted/not found) → rescan, re-cache

**Real-time polling strategy**:
- Pipeline running: poll every 3s with `If-None-Match` (ETag). 304 = no change, doesn't count against rate limit.
- Pipeline idle/completed: poll every 30s or stop.

**Comment structure**: The comment body contains a hidden marker and a JSON block:

```html
<!-- {engine}-status:{taskId} -->

{human-readable progress summary — markdown, rendered for GitHub readers}

<!--pipeline-data
{
  "taskId": "task-123",
  "state": "running",
  "startedAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:01:00Z",
  "completedAt": null,
  "currentStage": "implement",
  "stages": {
    "plan": { "state": "completed", "startedAt": "...", "completedAt": "...", "elapsed": 12, "retries": 0 },
    "implement": { "state": "running", "startedAt": "...", "retries": 0 },
    "review": { "state": "pending", "retries": 0 }
  },
  "triggeredBy": "user-login",
  "issueNumber": 42,
  "runUrl": "https://github.com/..."
}
-->
```

#### PipelineStatus schema (generic base)

What the dashboard validates from the JSON block. Any engine must provide these fields:

```typescript
interface PipelineStatus {
  taskId: string
  state: 'running' | 'completed' | 'failed' | 'paused' | 'timeout'
  startedAt: string
  updatedAt: string
  completedAt?: string
  currentStage: string | null
  stages: Record<string, {
    state: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'paused' | 'timeout' | 'observing'
    startedAt?: string
    completedAt?: string
    elapsed?: number
    retries: number
    error?: string
  }>
  triggeredBy: string
  issueNumber?: number
  runUrl?: string
}
```

Stage names are dynamic — the engine defines its own stages. Dashboard reads them from the `stages` field and renders them in insertion order.

Extra engine-specific fields are preserved via Zod `.passthrough()` — not stripped.

#### KodyPipelineStatus (Kody extension)

Kody extends the generic schema with engine-specific fields. These are preserved by `.passthrough()` on the generic schema and validated by a separate `KodyPipelineStatusSchema` at the Kody dashboard layer.

```typescript
interface KodyPipelineStatus extends PipelineStatus {
  // Cost tracking
  totalCost?: number
  stages: Record<string, KodyStageStatus>

  // Control
  controlMode?: 'auto' | 'supervised' | 'manual'
  pipeline?: string  // e.g., 'spec', 'impl', 'full'
  mode?: string

  // Audit
  actorHistory?: Array<{
    action: string  // 'pipeline-triggered', 'gate-approved', 'gate-rejected', 'stage-retried'
    actor: string   // GitHub login
    timestamp: string
    details?: Record<string, unknown>
  }>
}

interface KodyStageStatus extends StageStatus {
  // Cost per stage
  cost?: number
  tokenUsage?: { input: number; output: number; cacheRead?: number }

  // Feedback loops
  feedbackLoops?: number
  feedbackErrors?: string[]
  fixAttempt?: number
  maxFixAttempts?: number

  // Review details
  issuesFound?: number
  reviewSummary?: string
  sessionId?: string
}
```

**PR review routing**: Kody-specific trigger adapter. Translates GitHub PR `changes_requested` review events into `{ action: 'rerun', feedback: reviewBody }` before dispatching through the generic `EngineAction` contract. Lives above the contract, not in it.

#### Priority

Labels and the status comment should be consistent. If they diverge:
- **Labels** win for kanban column (fast, always available on the issue object)
- **Status comment** wins for detailed progress (stages, timing, errors)

---

## 3. Behaviors to Cover

### Contract 1: Actions

**Should**:
1. Should accept `run` action with any free-form command string
2. Should accept `approve` action only when pipeline state is `paused`
3. Should accept `reject` action only when pipeline state is `paused`
4. Should accept `rerun` action with optional `fromStage` and `feedback`
5. Should accept `abort` action only when pipeline state is `running` or `paused`
6. Should reject actions that violate the state machine (e.g., approve when running)
7. Should parse comment triggers matching `@{engine} {action} [args]` format
8. Should parse workflow_dispatch triggers with `{ issue_number, command }` inputs

### Contract 2: State

**Labels — should**:
1. Should read labels matching `{engine}:*` pattern from GitHub issues
2. Should map label suffix back to pipeline state
3. Should determine kanban column from label
4. Should ignore labels that don't match the `{engine}:*` pattern

**Status comment — should**:
1. Should find status comment by scanning for `<!-- {engine}-status:{taskId} -->` marker
2. Should cache `statusCommentId` on task record after first discovery
3. Should read cached status comment by ID on subsequent reads (O(1))
4. Should rescan if cached comment is stale (deleted/not found)
5. Should extract the `<!--pipeline-data ... -->` JSON block from the comment body
6. Should validate the JSON against PipelineStatus Zod schema (`.passthrough()`)
7. Should reject data missing required fields (taskId, state, startedAt, updatedAt, stages)
8. Should accept extra engine-specific fields (preserved, not stripped)
9. Should accept any stage names in the `stages` record
10. Should render stages in insertion order from the record
11. Should map `PipelineStatus.state` to kanban columns (running→building, completed→done, failed→failed, paused→gate-waiting, timeout→failed)
12. Should use ETag conditional requests for polling (304 = no change, free)

**Kody extension — should**:
1. Should validate Kody-specific fields (totalCost, controlMode, actorHistory, etc.) via `KodyPipelineStatusSchema`
2. Should validate Kody stage extensions (cost, tokenUsage, feedbackLoops, etc.) via `KodyStageStatusSchema`
3. Should translate PR review events into `EngineAction` (Kody trigger adapter)

---

## 4. Expected Outcomes

### Actions
- Valid action + valid state → action is dispatched (comment posted or workflow triggered)
- Valid action + invalid state → action is rejected with user feedback (button disabled or error message)
- Comment matching `@{engine} {action}` → parsed into `EngineAction` union type
- Workflow dispatch with `{ issue_number, command }` → parsed into `{ action: 'run', command }`

### State
- Label `kody:building` on issue → dashboard maps to `running` state, shows in "building" column
- No matching labels → dashboard falls back to status comment data
- Label swap (remove `kody:building`, add `kody:done`) → dashboard updates column
- Status comment with valid `<!--pipeline-data-->` block → Zod parse succeeds, dashboard renders pipeline view
- Status comment with invalid/missing JSON → Zod parse fails, dashboard shows error state
- Extra fields in pipeline data → preserved (`.passthrough()`), no validation error
- Unknown stage names → rendered as-is in the pipeline progress UI
- ETag match on poll → 304, no data transfer, no rate limit consumed
- Cached commentId stale → dashboard rescans, re-caches, self-heals

### Kody Extension
- Kody status comment with cost/actor/feedback fields → `KodyPipelineStatusSchema` validates all fields
- PR `changes_requested` review → translated to `{ action: 'rerun', feedback }` via trigger adapter
- Kody-specific stage fields (tokenUsage, feedbackLoops) → validated and rendered in Kody dashboard

---

## 5. Out of Scope

- Engine implementation (how any engine updates the status comment, manages labels, etc.)
- Engine-specific command parsing (e.g., `@kody impl --fresh --turbo` parsing logic — lives in engine)
- Third-party engine implementation (how other engines implement the contracts)
- Direct API communication between dashboard and engine (all via GitHub)
- E2E tests for the full dashboard-engine roundtrip via GitHub
- GitHub webhook handling (future enhancement for true real-time)
- Engine registration or discovery
- Non-GitHub platforms (assumed GitHub-only for now)

---

## 6. Test Boundaries

```yaml
Test level: integration
Mocking: GitHub API only
External services: mocked (GitHub API)
Database: real (test MongoDB)
```

### What to test

**Zod schemas** (unit):
- `EngineAction` schema validates/rejects action payloads
- `PipelineStatus` schema validates/rejects pipeline data payloads (with `.passthrough()`)
- `KodyPipelineStatus` schema validates Kody-specific extensions
- State machine validates/rejects action+state combinations

**Action dispatch** (integration):
- Dashboard correctly posts `@{engine} {action}` comments via GitHub API
- Dashboard correctly triggers workflow_dispatch via GitHub API
- State machine enforces valid transitions

**State reading** (integration):
- Dashboard scans comments for marker, finds status comment
- Dashboard caches `statusCommentId` on task record
- Dashboard reads cached comment by ID on subsequent reads
- Dashboard rescans when cached comment is stale
- Dashboard extracts `<!--pipeline-data-->` JSON block
- Dashboard correctly maps status to kanban columns
- ETag polling returns 304 when unchanged

**Label parsing** (unit):
- `{engine}:{suffix}` pattern matching
- Suffix-to-state mapping

**Kody extension** (unit):
- `KodyPipelineStatusSchema` validates cost, actor history, control mode
- `KodyStageStatusSchema` validates tokenUsage, feedbackLoops, fixAttempts
- PR review trigger adapter produces correct `EngineAction`

---

## 7. Stop Conditions

- [ ] 3 Zod schemas exist (EngineAction, PipelineStatus, KodyPipelineStatus) + label mapping + comment parser
- [ ] All behaviors from section 3 have passing tests
- [ ] Dashboard renders pipeline view from generic PipelineStatus
- [ ] Kody dashboard layer renders extended fields from KodyPipelineStatus
- [ ] Dashboard dispatches actions through generic EngineAction
- [ ] Status comment discovery: scan by marker, cache commentId, rescan on stale
- [ ] Real-time polling with ETag conditional requests works
- [ ] Existing Kody Engine functionality works unchanged (backward compatible)
- [ ] `pnpm typecheck && pnpm lint` pass
- [ ] `pnpm test:int` passes

---

## 8. Deliverables

```yaml
Tests: yes
  - tests/int/engine-contract-actions.int.spec.ts (~8 tests)
  - tests/int/engine-contract-state.int.spec.ts (~12 tests — labels + status comment + caching + polling + kody extension)
CI: required
Docs: yes — this spec + inline TSDoc on contract types
i18n: no
Migrations: no
Types: yes — pnpm generate:types (if Payload collections change)
```

### Files to create/modify

**New files (dashboard)**:
- `src/dashboard/contracts/actions.ts` — `EngineAction` type + Zod schema + state machine
- `src/dashboard/contracts/state.ts` — `PipelineStatus` interface + Zod schema + comment parser (scan/cache) + label mapping + ETag polling
- `src/dashboard/contracts/kody.ts` — `KodyPipelineStatus` extension + Zod schema + PR review trigger adapter
- `src/dashboard/contracts/index.ts` — barrel export

**Modified files (dashboard)**:
- `src/dashboard/lib/types.ts` — replace `KodyPipelineStatus` / `StageStatus` with imports from contracts
- Components and hooks that reference `KodyPipelineStatus` — update imports
- Action dispatching code — use `EngineAction` instead of hardcoded strings
- Task record — add `statusCommentId` cached field

---

## 9. Risk & Rollback

```yaml
Breaking: Dashboard pipeline view could break if contract types don't match existing data
Blast radius: module (dashboard only — engine is unchanged)
Rollback: revert PR (no data migration)
Data safety: low (read-only types, no data changes)
```

**Mitigation**:
- Kody Engine's existing status output MUST pass both `PipelineStatus` (generic) and `KodyPipelineStatus` (extended) Zod schemas (backward compat test)
- Extra Kody-specific fields are preserved via Zod `.passthrough()` — not stripped
- `KodyPipelineStatus extends PipelineStatus` — generic dashboard works, Kody dashboard layer adds richness

---

## Implementation Plan

### Phase 1: Define contracts + tests (TDD)

1. Create `src/dashboard/contracts/` directory
2. Define `EngineAction` Zod schema + state machine in `actions.ts`
3. Define `PipelineStatus` Zod schema (`.passthrough()`) + comment parser (scan by marker, cache commentId) + label mapping + ETag polling in `state.ts`
4. Define `KodyPipelineStatus` Zod schema + PR review trigger adapter in `kody.ts`
5. Create barrel export in `index.ts`
6. Write unit tests for all Zod schemas
7. Write unit tests for label parsing, comment parsing, state machine

### Phase 2: Backward compatibility verification

1. Verify Kody Engine's existing status data passes `PipelineStatus` Zod schema
2. Verify Kody Engine's existing status data passes `KodyPipelineStatus` Zod schema
3. Verify Kody Engine's labels match the contract label convention

### Phase 3: Integration (dashboard)

1. Update `src/dashboard/lib/types.ts` — import contract types
2. Update action dispatch hooks/functions to use `EngineAction`
3. Update status reading to use contract state parsing (scan/cache + ETag polling)
4. Add `statusCommentId` cached field to task record
5. Write integration tests

### Phase 4: Verify

1. `pnpm typecheck && pnpm lint` pass
2. `pnpm test:int` passes
3. Existing Kody functionality unchanged
