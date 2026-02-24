# Plan: Unified Graph Architecture — Pipeline-Integrated Multi-Task Orchestration for Cody

## Rerun Context

**COMPLETE REWRITE** of the previous 14-step plan. The architecture changed fundamentally:

| Previous Architecture | New Unified Architecture |
|---|---|
| `taskify` detects decomposition → sets `decomposition` field in `task.json` | No decomposition field. Architect decides. |
| Separate `decompose` stage after `clarify` | No `decompose` stage. Architect is the decision-maker. |
| Separate `decompose.md` agent | No decompose agent. `architect.md` updated to always produce `graph.json`. |
| Routing in spec pipeline based on `task.json.decomposition` | Routing in impl pipeline AFTER architect, based on `graph.levels.length` |
| `STAGE_OUTPUT_MAP` for `decompose` → `graph.json` | `STAGE_OUTPUT_MAP` for `architect` → `graph.json` (replaces `plan.md`) |

**What was removed:**
- `decomposition`, `decomposition_reason`, `estimated_nodes` from `TaskDefinition`
- `decompose` from `ALL_STAGES`, `SPEC_STAGES`, `STAGE_CONTEXT_FILES`, `stageInstructions`
- `.opencode/agents/decompose.md` agent definition
- All branching/routing conditionals around decomposition detection in taskify

**What was preserved from round 3:**
- All 5 critical security findings (C1-C5) — execSync migration, shell input validation
- All 6 high findings (H1-H6) — worktree symlinks, actor validation, graph integrity
- All blocking gaps (B1-B4) — status function call sites, stageInstructions signatures, BASE_BRANCHES fix
- All significant gaps (S1-S14) — except S4/S5/S6/S8/S14 which were decompose-specific

**New flow:**
```
taskify → spec → gap → [clarify] → architect (ALWAYS produces graph.json) → ROUTE
                                                    │
                                      ┌─────────────┴─────────────┐
                                 1 level (single node)      N levels (multi-node)
                                      │                           │
                                plan-gap → build →          plan orchestrator
                                verify → commit → pr        dispatches nodes
                                (existing pipeline)         level-by-level
```

---

## Summary

The architect agent (Opus, the most capable model) ALWAYS produces `graph.json` as its output. For simple tasks, this is a trivial 1-node graph containing the plan. For complex tasks, this is a multi-node graph with dependency edges. After architect runs in the impl pipeline, routing checks `graph.levels.length`:
- **1 level** (single node): Extract `plan.md` from the graph node, continue existing impl pipeline unchanged (plan-gap → build → commit → verify → auditor → apply-audit → pr)
- **>1 level** (multi-node): Launch plan orchestrator for parallel execution across runners

All intermediate PRs merge to a `plan/<planId>` feature branch. The head node verifies integration and creates a summary PR to `dev`.

## Architecture

```
Pipeline Flow (Unified):
  taskify → spec → gap → [clarify] → architect
                                        │
                                   graph.json produced
                                        │
                              ┌─────────┴──────────┐
                        1 level                  N levels
                        (trivial graph)          (multi-node graph)
                              │                       │
                        Extract plan.md          Create plan branch
                        from single node         Plan orchestrator:
                              │                  • dispatch level-by-level
                        plan-gap → build →       • each node: build → verify →
                        commit → verify →          commit → pr → merge
                        auditor → pr             • head node: integration PR to dev
```

```
                        dev (default branch)
                         │
        ┌────────────────┴──────────────────┐
        │    plan/260221-auth-feature        │  ← Created by orchestrator
        │    (plan feature branch)           │
        │                                    │
        │  ┌─── Level 0 (parallel) ───┐     │
        │  │ feat/01-base-setup       │     │  ← branches from plan branch
        │  │   └─ PR → plan branch    │     │    (merged after checks pass)
        │  │ feat/02-roles-schema     │     │
        │  │   └─ PR → plan branch    │     │
        │  └──────────────────────────┘     │
        │              │                     │
        │  ┌─── Level 1 (parallel) ───┐     │
        │  │ feat/03-oauth            │     │  ← branches from updated plan branch
        │  │   └─ PR → plan branch    │     │    (merged after checks pass)
        │  │ feat/04-rbac             │     │
        │  │   └─ PR → plan branch    │     │
        │  └──────────────────────────┘     │
        │              │                     │
        │  ┌─── Head Node ────────────┐     │
        │  │ Verify integration       │     │
        │  │ Run full test suite      │     │
        │  │ Create PR → dev          │     │
        │  └──────────────────────────┘     │
        └────────────────────────────────────┘
```

### Key Design Decisions

1. **Architect is the sole decision-maker** — Opus has full context (spec.md, clarified.md, task.json) and produces the graph. No separate decomposition detection.
2. **graph.json is the universal output** — 1-node for simple tasks, N-node for complex. Routing is just `graph.levels.length`.
3. **Each graph node = a Cody task** — reuses the entire existing pipeline (build → verify → commit → PR)
4. **Pre-computed specs** — architect produces `spec.md` + `plan.md` per node upfront for multi-node graphs, so Cody starts at `build` stage per node
5. **Bottom-up execution** — Level 0 (leaves, no deps) first → Level N (head) last
6. **Plan feature branch** — all intermediate PRs merge to `plan/<planId>`, isolating work from `dev`
7. **Explicit merge after checks** — orchestrator waits for CI checks to pass, then merges via `gh pr merge --squash`
8. **Dual execution** — CI via `gh workflow run plan.yml` (parallel on separate runners) or local via `git worktree`
9. **Deterministic branch derivation** — `planBranch` always computed as `plan/<planId>`, never read from mutable files
10. **Security-first** — Step 0 migrates ALL `execSync` template-literal calls before any new code

### Invariants

- **INVARIANT: One orchestrator per plan at a time.** Concurrency group `plan-<planId>` with `cancel-in-progress: false`.
- **INVARIANT: Monotonic state transitions.** Node states only move forward: `pending → dispatched → running → completed|failed`.
- **INVARIANT: `planId` validated before any use.** `validatePlanId()` called at every entry point.
- **INVARIANT: `planBranch` is deterministic.** Always `plan/<planId>`. Never derived from mutable state.
- **INVARIANT: Plan nodes use impl-only task types.** `task_type` must be `implement_feature`, `fix_bug`, `refactor`, or `ops`.
- **INVARIANT: Graph integrity verified before dispatch.** Checksum checked before any node dispatch.
- **INVARIANT: No shell injection.** ALL git/gh commands use `execFileSync` (array-based, no shell).

### Directory Structure

```
# Single-node (simple task) — architect writes graph.json, pipeline extracts plan.md:
.tasks/<task-id>/
├── task.md
├── task.json
├── spec.md
├── clarified.md
├── graph.json          # Trivial 1-node graph (architect output)
├── plan.md             # Extracted from graph node's plan field
├── plan-gap.md → build.md → verify.md → ...
└── status.json

# Multi-node (complex task) — architect writes graph.json + per-node files:
.tasks/<plan-id>/
├── task.md             # Original task
├── task.json           # Original classification
├── spec.md             # Original spec
├── clarified.md        # Original clarifications
├── graph.json          # Multi-node DAG with levels, state, checksum
├── <node-task-id>/     # One per graph node
│   ├── task.md         # Node-specific task description
│   ├── task.json       # Pre-computed (skip taskify)
│   ├── spec.md         # Pre-computed by architect (skip spec stage)
│   ├── clarified.md    # Pre-filled "Use recommended answers"
│   ├── plan.md         # Pre-computed (skip architect)
│   ├── plan-review.md  # Pre-filled PASS
│   ├── build.md → verify.md → ...  # Generated by Cody at runtime
│   └── status.json
└── <head-node-id>/     # Head node (integration verification)
    └── ...
```

### Prerequisites

1. **Branch protection on `plan/**`**: Require status check before merge
2. **GitHub auto-delete branches**: Enable "Automatically delete head branches"

---

## Step 0: Security Hardening — Migrate execSync to execFileSync (PREREQUISITE)

**Time estimate: 25-35 minutes**

**Files to touch:**
- `scripts/cody/git-utils.ts` (MODIFIED, ~37 `execSync` calls)
- `scripts/cody/cody-utils.ts` (MODIFIED, ~12 `execSync` calls in `postComment`, `getIssueBody`, `editComment`, `getLatestIssueComment`, `discoverTaskIdFromIssue`, `validateAuth`, `ensureTaskMarkerComment`)
- `scripts/cody/scripted-stages.ts` (MODIFIED, `runGate()` ~line 31-48)

**Behavior:**
Migrate ALL `execSync` template-literal calls to `execFileSync` with array-based arguments across the entire codebase. This eliminates shell injection as an attack surface. **Hard prerequisite for all other steps.**

**Scope:**

### git-utils.ts (~37 calls)

Every template-literal `execSync` in:
- `getDefaultBranch()` — 1 call
- `mergeDefaultBranch()` — 1 call
- `ensureFeatureBranch()` — ~12 calls (the bulk)
- `commitAndPush()` — ~8 calls
- `commitPipelineFiles()` — ~5 calls
- Other helper functions — ~10 calls

Pattern:
```typescript
// Before:
execSync(`git checkout ${branchName}`, { cwd, stdio: 'inherit' })
// After:
execFileSync('git', ['checkout', branchName], { cwd, stdio: 'inherit' })
```

### cody-utils.ts (~12 calls)

| Function | Current | Migration |
|----------|---------|-----------|
| `postComment(issueNumber, body)` | `` execSync(`gh issue comment ${issueNumber} ...`) `` | `execFileSync('gh', ['issue', 'comment', String(issueNumber), '--body-file', '-'], {input: body})` |
| `getIssueBody(issueNumber)` | `` execSync(`gh issue view ${issueNumber} --json body --jq .body`) `` | `execFileSync('gh', ['issue', 'view', String(issueNumber), '--json', 'body', '--jq', '.body'])` |
| `editComment(commentId, body)` | `` execSync(`gh api repos/${repo}/issues/comments/${commentId}`) `` | `execFileSync('gh', ['api', ...], {input: JSON.stringify({body})})` — use stdin piping, no temp file |
| `getLatestIssueComment(issueNumber, excludeAuthor?)` | `` execSync(`gh issue view ... --jq '[...select(.authorAssociation != "${exclude}")]'`) `` | Parse JSON in TypeScript instead of inline `--jq` with interpolated values |
| `discoverTaskIdFromIssue(issueNumber)` | Same `--jq` interpolation pattern | Same fix — parse JSON in TypeScript |
| `validateAuth()` | `execSync('gh auth status')` | `execFileSync('gh', ['auth', 'status'])` |

### scripted-stages.ts (`runGate()`)

```typescript
// Before:
const gateDefinitions = [
  { name: 'TypeScript', command: 'pnpm -s tsc --noEmit' },
]
execSync(gate.command, { timeout, ... })

// After:
const gateDefinitions = [
  { name: 'TypeScript', cmd: 'pnpm', args: ['-s', 'tsc', '--noEmit'] },
]
execFileSync(gate.cmd, gate.args, { timeout, ... })
```

**Tests (FAIL before, PASS after):**

1. `tests/unit/scripts/cody/execsync-migration.test.ts` — **No remaining execSync with template literals**
   - Grep `git-utils.ts` for `` execSync(` `` — expect zero matches
   - Grep `cody-utils.ts` for `` execSync(` `` — expect zero matches
   - Grep `scripted-stages.ts` for `execSync(gate.command` — expect zero matches
   - `postComment(123, 'test body')` calls `execFileSync('gh', ['issue', 'comment', '123', ...])` (mock)
   - `getLatestIssueComment(123, 'bot')` parses JSON in TypeScript without inline `--jq` interpolation
   - `runGate()` uses `execFileSync` with array-based args

**Acceptance criteria:**
- [ ] Zero `execSync` calls with template-literal interpolation remain in git-utils.ts
- [ ] Zero `execSync` calls with template-literal interpolation remain in cody-utils.ts
- [ ] `runGate()` uses `execFileSync` with `{ cmd, args }` gate definitions
- [ ] `getLatestIssueComment()` and `discoverTaskIdFromIssue()` parse JSON in TypeScript (no inline `--jq` with interpolated values)
- [ ] `editComment()` uses `execFileSync` with stdin piping (no temp file)
- [ ] All existing tests still pass (no regression)

---

## Step 1: Graph Data Structures and Algorithms

**Time estimate: 20-30 minutes**

**Files to touch:**
- `scripts/cody/graph.ts` (NEW, ~400 lines)

**Behavior:**
Core graph module with types, topological sort, cycle detection, level computation, integrity checksums, deterministic branch derivation, and I/O. This is a pure data module with zero side effects — no git, no GitHub, no file system beyond graph.json read/write. Imports `TaskLocation` from `cody-utils.ts` (canonical location) and re-exports it.

**NOTE:** `TaskLocation` is canonically defined in `cody-utils.ts` (Step 3). `graph.ts` imports and re-exports it for convenience. No circular dependency — `graph.ts` only imports types from `cody-utils`, never calls status functions.

**Types:**

```typescript
// Re-exported from cody-utils.ts (canonical location):
export type { TaskLocation } from './cody-utils'

export interface PlanGraph {
  planId: string
  title: string
  description: string
  createdAt: string
  state: 'pending' | 'running' | 'completed' | 'failed'
  planBranch: string                    // Display only — use getPlanBranch(planId) for git ops
  baseBranch: string                    // e.g., "dev"
  nodes: Record<string, GraphNode>
  levels: string[][]                    // [[level-0 task-ids], [level-1 task-ids], ...]
  headNode: string                      // task-id of the final integration node
  currentLevel: number
  issueLabel: string
  checksum: string                      // SHA-256 of canonical JSON (sorted keys)
}

// SingleNodeGraph: trivial graph for simple tasks (1 node, 1 level)
export interface SingleNodeGraph {
  planId: string
  title: string
  description: string
  createdAt: string
  state: 'completed'                    // Always completed (no orchestration needed)
  nodes: Record<string, GraphNode>      // Single entry
  levels: [string[]]                    // Single level with one node
  headNode: string
  plan: string                          // The full plan.md content for the single node
  checksum: string
}

export interface GraphNode {
  taskId: string
  title: string
  description: string
  acceptanceCriteria: string[]
  issueNumber?: number
  prNumber?: number
  dependsOn: string[]
  level: number
  state: 'pending' | 'dispatched' | 'running' | 'completed' | 'failed'
  codyRunId?: string
  error?: string
  retries: number
  totalDispatches: number               // Persisted counter across plan restarts (max 5)
}

export interface NodeInput {
  taskId: string
  title: string
  description: string
  acceptanceCriteria: string[]
  dependsOn: string[]
}

const VALID_TRANSITIONS: Record<GraphNode['state'], GraphNode['state'][]> = {
  pending:    ['dispatched'],
  dispatched: ['running', 'failed'],
  running:    ['completed', 'failed'],
  completed:  [],
  failed:     ['pending'],  // Only via resetFromLevel() with --force for level 0
}

const VALID_PLAN_TASK_TYPES = ['implement_feature', 'fix_bug', 'refactor', 'ops']

// Limits
const MAX_PLAN_NODES = 15
const MIN_PLAN_NODES = 2
const MAX_TOTAL_DISPATCHES = 5
```

**Functions:**

- `getPlanBranch(planId)` — deterministic `plan/<planId>`, validates planId first
- `isSingleNodeGraph(graph)` — type guard: returns true if `graph.levels.length === 1` (single-node trivial graph)
- `buildSingleNodeGraph(planId, title, description, plan)` — create trivial 1-node graph with embedded plan content
- `buildGraph(planId, title, description, nodes, baseBranch)` — validate deps, detect cycles, compute levels, enforce min/max node count, set checksum
- `computeLevels(nodes)` — reverse topological sort: level 0 = no deps, level N = max(dep levels) + 1
- `getNodesAtLevel(graph, level)`, `isLevelComplete(graph, level)`, `getNextLevel(graph)`, `getLevelCount(graph)`
- `readGraph(planDir)` — parse JSON, verify checksum, **assert `graph.planBranch === getPlanBranch(graph.planId)` when planBranch is present (runtime enforcement of H5)**, throw `PlanIntegrityError` on mismatch
- `writeGraph(planDir, graph)` — recompute checksum using **sorted-key canonical JSON** (via `json-stable-stringify` or `JSON.stringify(graph, Object.keys(graph).sort())`), atomic write via `.tmp` rename
- `updateNodeState(graph, taskId, newState)` — validate against `VALID_TRANSITIONS`
- `computeChecksum(graph)` — SHA-256 of canonical JSON with checksum=''
- `verifyChecksum(graph)` — compare stored vs computed
- `validateGraph(graph)` — no cycles, all deps exist, head node exists, levels correct, task_types valid, **node count between MIN_PLAN_NODES and MAX_PLAN_NODES for multi-node graphs**
- `detectCycles(nodes)` — DFS with visited/inStack sets, returns cycle path or null
- `validatePlanNodeTaskType(taskDef: { task_type: string })` — throws if task_type not in `VALID_PLAN_TASK_TYPES`
- `resetFromLevel(graph, level, force)` — reset all nodes at level+ to pending; level 0 requires `--force`
- `renderGraphAscii(graph)`, `renderGraphTable(graph)` — visualization
- `extractPlanFromSingleNode(graph)` — extract the `plan` field from a single-node graph and return as string (for writing to plan.md)

**Error classes:** `PlanNotFoundError`, `PlanIntegrityError`, `PlanCycleError`, `PlanNodeFailedError`, `PlanTimeoutError`, `InvalidStateTransitionError`

**Tests (FAIL before, PASS after):**

1. `tests/unit/scripts/cody/graph.test.ts` — **Cycle detection, level computation, state transitions, limits, single-node**
   - Linear chain A→B→C: expect levels `[[A], [B], [C]]`
   - Diamond A→C, B→C: expect levels `[[A, B], [C]]`
   - Cycle A→B→A: expect `detectCycles()` returns cycle path
   - All independent: expect single level `[[A, B, C]]`
   - `getPlanBranch('260221-auth')` returns `plan/260221-auth`
   - `getPlanBranch('../../evil')` throws
   - State `pending → dispatched`: allowed
   - State `completed → pending`: throws InvalidStateTransitionError
   - State `failed → pending` via `resetFromLevel(level, true)`: allowed
   - `resetFromLevel(0, false)`: throws "Use --force"
   - `validatePlanNodeTaskType({ task_type: 'docs' })`: throws
   - `validatePlanNodeTaskType({ task_type: 'implement_feature' })`: passes
   - `buildGraph()` with 16 nodes: throws (exceeds MAX_PLAN_NODES)
   - `buildGraph()` with 1 node: throws (below MIN_PLAN_NODES) — multi-node graphs require ≥2
   - `readGraph()` with `planBranch !== getPlanBranch(planId)`: throws PlanIntegrityError
   - `buildSingleNodeGraph('260221-test', 'title', 'desc', '# Plan\n...')` — creates valid 1-node graph
   - `isSingleNodeGraph(singleNodeGraph)` → true
   - `isSingleNodeGraph(multiNodeGraph)` → false
   - `extractPlanFromSingleNode(singleNodeGraph)` → returns plan string

2. `tests/unit/scripts/cody/graph.test.ts` — **Graph I/O, checksums, integrity**
   - `writeGraph()` then `readGraph()` round-trips correctly
   - `readGraph()` with tampered checksum throws PlanIntegrityError
   - `readGraph()` with missing file throws PlanNotFoundError
   - `updateNodeState()` validates transition
   - `isLevelComplete()` returns false when one node still pending
   - `getNextLevel()` skips completed levels
   - Checksum uses canonical sorted-key JSON (deterministic across runs)

**Acceptance criteria:**
- [ ] `buildGraph()` correctly computes levels for linear, diamond, wide topologies
- [ ] `detectCycles()` catches circular dependencies and returns the cycle path
- [ ] `validateGraph()` catches: missing dep refs, empty graph, no head node, invalid task types, node count out of range
- [ ] `getPlanBranch()` validates planId and returns deterministic branch name
- [ ] Checksum verified on every `readGraph()`, recomputed on every `writeGraph()`
- [ ] `readGraph()` asserts `planBranch === getPlanBranch(planId)` when present (runtime enforcement)
- [ ] State transitions enforced via VALID_TRANSITIONS
- [ ] `resetFromLevel(0)` requires `--force`
- [ ] Atomic write: `.tmp` then rename
- [ ] Canonical JSON serialization (sorted keys) for checksums
- [ ] `MAX_PLAN_NODES = 15`, `MIN_PLAN_NODES = 2` enforced (multi-node only)
- [ ] `totalDispatches` counter per node, `MAX_TOTAL_DISPATCHES = 5`
- [ ] `buildSingleNodeGraph()` creates valid trivial graph
- [ ] `isSingleNodeGraph()` correctly distinguishes single from multi-node
- [ ] `extractPlanFromSingleNode()` returns plan content string

---

## Step 2: Add `planId` to CodyInput and Task Directory Resolution

**Time estimate: 20-30 minutes**

**Files to touch:**
- `scripts/cody/cody-utils.ts` (MODIFIED, lines 18-38 `CodyInput`, line 79 `VALID_MODES`, lines 92-94 `validateTaskId`, lines 101-111 `getTaskDir`/`ensureTaskDir`, lines 113-236 ALL status functions, lines 386-562 `parseCliArgs`, lines 586+ `parseCommentBody`)

**Behavior:**
Extend `CodyInput` with `planId`. Add `TaskLocation` type. Add `validatePlanId()`. Modify `getTaskDir()`, `ensureTaskDir()`. Add `'plan'` to `VALID_MODES`. Derive `CodyInput.mode` from `VALID_MODES`. All status functions that take bare `taskId` change to `TaskLocation`. Update `parseCommentBody()` to support `plan` subcommand.

**Key changes:**

```typescript
// NEW: TaskLocation (canonical location — re-exported by graph.ts)
export interface TaskLocation {
  taskId: string
  planId?: string
}

// CodyInput — derive mode from VALID_MODES + add planId:
const VALID_MODES = ['spec', 'impl', 'rerun', 'full', 'status', 'plan'] as const
export interface CodyInput {
  mode: (typeof VALID_MODES)[number]  // Derived, not manual union
  // ... existing fields ...
  planId?: string  // NEW
}

// NEW: validatePlanId:
export function validatePlanId(planId: string): boolean {
  return /^[0-9]{6}-[a-zA-Z0-9-]+$/.test(planId)
}

// getTaskDir — support nesting:
export function getTaskDir(taskId: string, planId?: string): string {
  if (planId) {
    if (!validatePlanId(planId)) throw new Error(`Invalid planId format: ${planId}`)
    return path.join(process.cwd(), '.tasks', planId, taskId)
  }
  return path.join(process.cwd(), '.tasks', taskId)
}

// ensureTaskDir — forward planId:
export function ensureTaskDir(taskId: string, planId?: string): string

// parseCliArgs — parse --plan-id:
else if (arg === '--plan-id' || arg.startsWith('--plan-id=')) {
  const value = arg.includes('=') ? arg.split('=')[1] : args[++i]
  if (!validatePlanId(value)) throw new Error(`Invalid --plan-id format: ${value}`)
  input.planId = value
}

// parseCommentBody — support /cody plan <planId>:
case 'plan':
  result.mode = 'plan'
  result.planId = args[0]
  break
```

**Status function signature changes (6 functions, 38 total call sites):**

| Function | Current sig | New sig |
|----------|------------|---------|
| `initStatus(input)` | `CodyInput` | No change — internally `getTaskDir(input.taskId, input.planId)` |
| `writeStatus(taskId, status)` | bare taskId | `writeStatus(loc: TaskLocation, status)` |
| `readStatus(taskId)` | bare taskId | `readStatus(loc: TaskLocation)` |
| `completeStatus(taskId, state)` | bare taskId | `completeStatus(loc: TaskLocation, state)` |
| `updateStageStatus(taskId, stage, state, extras?)` | bare taskId | `updateStageStatus(loc: TaskLocation, stage, state, extras?)` |
| `getLastFailedStage(taskId)` | bare taskId | `getLastFailedStage(loc: TaskLocation)` |

**Call site count: 29 external (cody.ts) + 1 (stage-hooks.ts) + 8 internal (cody-utils.ts) = 38 total.**

Internal call sites within cody-utils.ts:
- `readStatus` at line 114 calls `getTaskDir(taskId)` → `getTaskDir(loc.taskId, loc.planId)`
- `getLastFailedStage` at line 130 calls `readStatus(taskId)` → `readStatus(loc)`
- `writeStatus` at line 141 calls `getTaskDir(taskId)` → `getTaskDir(loc.taskId, loc.planId)`
- `initStatus` at line 165 calls `writeStatus(input.taskId, status)` → `writeStatus({taskId: input.taskId, planId: input.planId}, status)`
- `updateStageStatus` at line 184 calls `readStatus(taskId)` → `readStatus(loc)`
- `updateStageStatus` at line ~222 calls `writeStatus(taskId, status)` → `writeStatus(loc, status)`
- `completeStatus` at line 226 calls `readStatus(taskId)` → `readStatus(loc)`
- `completeStatus` at line ~236 calls `writeStatus(taskId, status)` → `writeStatus(loc, status)`

External: define `const loc: TaskLocation = { taskId: input.taskId, planId: input.planId }` at top of each pipeline function in cody.ts, then mechanical replace.

**Tests (FAIL before, PASS after):**

1. `tests/unit/scripts/cody/cody-utils.test.ts` — **Nested directory resolution + validation**
   - `getTaskDir('task-1')` returns `.tasks/task-1` (backward compat)
   - `getTaskDir('task-1', '260221-plan')` returns `.tasks/260221-plan/task-1`
   - `getTaskDir('task-1', '../evil')` throws
   - `getTaskDir('task-1', '; rm -rf /')` throws
   - `validatePlanId('260221-auth-feature')` returns true
   - `validatePlanId('../../etc')` returns false
   - `parseCliArgs(['--task-id', 'x', '--plan-id', '260221-test'])` sets `input.planId`
   - `parseCliArgs(['--task-id', 'x', '--plan-id', 'invalid!'])` throws
   - `parseCliArgs(['--mode', 'plan'])` accepted
   - `readStatus({taskId:'t1', planId:'260221-p'})` reads from `.tasks/260221-p/t1/status.json`
   - `updateStageStatus({taskId:'t1', planId:'260221-p'}, 'build', 'running')` writes to nested path
   - `parseCommentBody('/cody plan 260221-auth')` → `{mode:'plan', planId:'260221-auth'}`

**Acceptance criteria:**
- [ ] `TaskLocation` type defined and exported from `cody-utils.ts`
- [ ] `getTaskDir()` without planId returns flat path (no regression)
- [ ] `getTaskDir()` with planId returns nested path
- [ ] `validatePlanId()` rejects path traversal, shell injection, special chars
- [ ] All 6 status functions work with `TaskLocation`
- [ ] **38 total call sites updated** (29 cody.ts + 1 stage-hooks.ts + 8 internal)
- [ ] `CodyInput.mode` derived from `VALID_MODES` (includes `'plan'`)
- [ ] `parseCommentBody()` supports `/cody plan <planId>`
- [ ] All existing Cody tests still pass (no regression)

---

## Step 3: Fix Hardcoded Paths in Stage Prompts + Update architect output mapping

**Time estimate: 15-20 minutes**

**Files to touch:**
- `scripts/cody/stage-prompts.ts` (MODIFIED, lines 21-22 `SPEC_STAGES`, lines 29-43 `ALL_STAGES`, lines 68-82 `STAGE_CONTEXT_FILES`, lines 93-118 `stageInstructions`, lines 128-142 `getTaskType()`, lines 158-189 `buildStagePrompt()`)
- `scripts/cody/pipeline-utils.ts` (MODIFIED, line 280 `STAGE_OUTPUT_MAP`, line 297 `SPEC_ONLY_STAGES`, line 304 `DRY_RUN_OUTPUTS`)
- `scripts/cody/agent-runner.ts` (MODIFIED, `STAGE_TIMEOUTS`)

**Behavior:**
1. Replace hardcoded `.tasks/{TASK_ID}/` paths with dynamic paths using `getTaskDir()`
2. Change `STAGE_OUTPUT_MAP` for architect from `plan.md` to `graph.json`
3. Fix `getTaskType()` to use `getTaskDir()` instead of duplicate path construction
4. Pass `planId` to `getTaskType()` AND `stageInstructions` from `buildStagePrompt()`
5. **ALL 13 `stageInstructions` entries get signature `(taskId: string, planId?: string) => string`** (fixes B2)
6. `buildStagePrompt()` calls `instructionFn(taskId, input.planId)` (fixes B3)
7. Extend `STAGE_TIMEOUTS` for architect (may need more time to produce graph — 20 min)
8. Add `architect` to `DRY_RUN_OUTPUTS` with a mock single-node graph JSON
9. **NO changes to ALL_STAGES or SPEC_STAGES** — no decompose stage exists

**Changes to `pipeline-utils.ts`:**

```typescript
// STAGE_OUTPUT_MAP — architect output is now graph.json:
const STAGE_OUTPUT_MAP: Record<string, string> = {
  taskify: 'task.json',
  gap: 'gap.md',
  clarify: 'questions.md',
  architect: 'graph.json',       // CHANGED from 'plan.md'
  'plan-gap': 'plan-gap.md',
  commit: 'commit.md',
  autofix: 'autofix.md',
}

// DRY_RUN_OUTPUTS — architect now produces graph.json (single-node mock):
architect: (taskId) => JSON.stringify({
  planId: taskId,
  title: `[dry-run] Plan for ${taskId}`,
  description: 'Mock single-node graph',
  createdAt: new Date().toISOString(),
  state: 'completed',
  nodes: {
    [taskId]: {
      taskId, title: `Implement ${taskId}`, description: 'Mock',
      acceptanceCriteria: ['Mock AC'], dependsOn: [], level: 0,
      state: 'completed', retries: 0, totalDispatches: 0,
    },
  },
  levels: [[taskId]],
  headNode: taskId,
  plan: `# Plan (dry-run)\n\nMock plan for ${taskId}.\n`,
  checksum: '',
}, null, 2),
```

**Changes to `stage-prompts.ts`:**

```typescript
// stageInstructions type — ALL 13 entries updated (fixes B2):
export const stageInstructions: Record<Stage, (taskId: string, planId?: string) => string> = {
  taskify: (taskId, planId?) => {
    const taskDir = planId ? `.tasks/${planId}/${taskId}` : `.tasks/${taskId}`
    return specOnlyInstructionTemplate.replace('{TASK_DIR}', taskDir)
  },
  spec: (taskId, planId?) => { /* same pattern */ },
  gap: (taskId, planId?) => { /* same pattern */ },
  clarify: (taskId, planId?) => { /* same pattern */ },
  // Non-spec stages: signature updated but body unchanged
  architect: (_taskId, _planId?) => ``,
  'plan-gap': (_taskId, _planId?) => ``,
  build: (_taskId, _planId?) => ``,
  commit: (_taskId, _planId?) => ``,
  verify: (_taskId, _planId?) => ``,
  autofix: (_taskId, _planId?) => ``,
  auditor: (_taskId, _planId?) => ``,
  'apply-audit': (_taskId, _planId?) => ``,
  pr: (_taskId, _planId?) => ``,
}

// getTaskType — use getTaskDir():
function getTaskType(taskId: string, planId?: string): string {
  const taskJsonPath = path.join(getTaskDir(taskId, planId), 'task.json')
  // ...
}

// buildStagePrompt — dynamic taskDir + pass planId (fixes B3):
const taskDir = input.planId
  ? `.tasks/${input.planId}/${input.taskId}`
  : `.tasks/${input.taskId}`
const taskType = getTaskType(input.taskId, input.planId)
const instruction = instructionFn ? instructionFn(input.taskId, input.planId) : ''
```

**Tests (FAIL before, PASS after):**

1. `tests/unit/scripts/cody/stage-prompts.test.ts` — **Dynamic paths + architect output mapping**
   - `buildStagePrompt({taskId:'t1', planId:'260221-x'} as CodyInput, 'build')` includes `.tasks/260221-x/t1` in prompt
   - `buildStagePrompt({taskId:'t1'} as CodyInput, 'build')` includes `.tasks/t1` (backward compat)
   - `getTaskType('t1', '260221-x')` reads from nested directory
   - `stageOutputFile(taskDir, 'architect')` returns `<taskDir>/graph.json`
   - `STAGE_OUTPUT_MAP.architect` === `'graph.json'`
   - Existing tests still pass (no regression)

**Acceptance criteria:**
- [ ] No duplicate path construction (uses `getTaskDir()`)
- [ ] Agent prompts contain correct nested path when `planId` set
- [ ] ALL 13 `stageInstructions` entries accept `(taskId, planId?)`
- [ ] `buildStagePrompt()` passes `planId` to BOTH `getTaskType()` AND `stageInstructions`
- [ ] `STAGE_OUTPUT_MAP.architect` is `'graph.json'`
- [ ] `DRY_RUN_OUTPUTS.architect` produces valid single-node graph JSON
- [ ] `STAGE_TIMEOUTS` has `architect: 20 * 60_000`
- [ ] Backward compatible when `planId` undefined

---

## Step 4: Update Architect Agent to Always Produce graph.json

**Time estimate: 15-20 minutes**

**Files to touch:**
- `.opencode/agents/architect.md` (MODIFIED, lines 12-24 — output contract, lines 30-40 — rerun handling)

**Behavior:**
Update the architect agent prompt to ALWAYS produce `graph.json` instead of `plan.md`. The agent decides based on task complexity:

- **Simple task** → produce a single-node graph with the plan embedded in the `plan` field
- **Complex task** → produce a multi-node graph with per-node task files, specs, and plans

The file watcher watches for `graph.json` (per updated `STAGE_OUTPUT_MAP`).

**Changes to `architect.md`:**

Replace the output contract:
```markdown
**Output (REQUIRED)**: `.tasks/<task-id>/graph.json`

You ALWAYS produce a graph.json file. Your decision:

### Simple Task (single implementation unit)
Write a single-node graph.json:
```json
{
  "planId": "<task-id>",
  "title": "<task title>",
  "description": "<1-line summary>",
  "createdAt": "<ISO timestamp>",
  "state": "completed",
  "nodes": {
    "<task-id>": {
      "taskId": "<task-id>",
      "title": "<task title>",
      "description": "<summary>",
      "acceptanceCriteria": ["..."],
      "dependsOn": [],
      "level": 0,
      "state": "completed",
      "retries": 0,
      "totalDispatches": 0
    }
  },
  "levels": [["<task-id>"]],
  "headNode": "<task-id>",
  "plan": "<THE FULL PLAN CONTENT AS A STRING>",
  "checksum": ""
}
```

The `plan` field contains the FULL detailed plan (same format as the previous plan.md output — steps, files, tests, acceptance criteria). The pipeline will extract this to plan.md automatically.

### Complex Task (multiple independent units, 3+ developers)
Write a multi-node graph.json AND per-node directories.

Decision criteria for multi-node:
- Task requires 3+ independent implementation units
- Units have clear dependency relationships
- Total effort > 4 hours
- Different domains/skills needed per unit

For multi-node, also create per-node directories under the task directory:
- `<node-id>/task.md` — node-specific task description
- `<node-id>/task.json` — pre-classified (task_type must be implement_feature, fix_bug, refactor, or ops)
- `<node-id>/spec.md` — node-specific spec
- `<node-id>/clarified.md` — pre-filled "Use recommended answers for all questions"
- `<node-id>/plan.md` — node-specific implementation plan
- `<node-id>/plan-review.md` — pre-filled "PASS"

Multi-node graph.json includes:
- `planBranch`: `plan/<planId>`
- `baseBranch`: `dev`
- `nodes`: 2-15 nodes with dependency edges
- `levels`: computed from dependencies
- `headNode`: the final integration verification node

Node count: minimum 2, maximum 15. Head node should verify integration.
```

**Keep the existing plan format instructions** for the `plan` field content (steps, files, tests, acceptance criteria).

**Rerun mode**: When `rerun-feedback.md` is present, read previous graph.json + feedback. If the graph structure was wrong, rewrite graph.json. If code-level issues, keep graph structure but update the plan in the affected node.

**Tests (FAIL before, PASS after):**

1. `tests/unit/scripts/cody/architect-output.test.ts` — **Validate architect output schema**
   - Parse a valid single-node graph.json → passes schema validation
   - Parse a valid multi-node graph.json → passes schema validation + `validateGraph()`
   - Single-node graph has `plan` field with non-empty string
   - Single-node graph has exactly 1 node and 1 level
   - Multi-node graph has 2+ nodes and 2+ levels
   - Multi-node graph per-node directories contain required files (task.md, task.json, spec.md, clarified.md, plan.md, plan-review.md)
   - Node task_type in `['implement_feature', 'fix_bug', 'refactor', 'ops']`

**Acceptance criteria:**
- [ ] `architect.md` documents graph.json as output (not plan.md)
- [ ] Single-node graph contract defined with `plan` field
- [ ] Multi-node graph contract defined with per-node directories
- [ ] Decision criteria for single vs multi-node documented
- [ ] Node count limits documented (2-15)
- [ ] Task type restrictions documented
- [ ] STOP CONDITION present ("after writing graph.json, you are DONE")
- [ ] Rerun mode instructions updated for graph.json

---

## Step 5: Update cody.ts — Routing After Architect, Call Sites, Plan Mode

**Time estimate: 25-35 minutes**

**Files to touch:**
- `scripts/cody/cody.ts` (MODIFIED, ~40 locations)
- `scripts/cody/stage-hooks.ts` (MODIFIED, `StageHookOptions` interface + 1 call site)

**Behavior:**
1. All `ensureTaskDir(input.taskId)` → `ensureTaskDir(input.taskId, input.planId)`
2. Define `const loc: TaskLocation` early in each pipeline function
3. All ~29 status calls in cody.ts use `loc`
4. Error messages use dynamic `taskPath`
5. Add `plan` mode to routing switch
6. **KEY CHANGE: After architect stage completes in impl pipeline, check graph.json:**
   - If `isSingleNodeGraph(graph)` → extract `plan.md` from graph's `plan` field, continue existing impl pipeline
   - If multi-node graph → commit task files, launch plan orchestrator, return `'plan-dispatched'`
7. When `planId` set: pass plan branch to `ensureFeatureBranch()`
8. **Guard: reject `mode=full` or `mode=spec` when `planId` is set**
9. Add `planId?` to `StageHookOptions`
10. **Guard `completeStatus` in `main()`** — don't mark completed if plan was dispatched

**Key routing change in `runImplPipeline()` (after architect stage completes, ~line 590):**

```typescript
// After architect stage produces graph.json:
const { readGraph, isSingleNodeGraph, extractPlanFromSingleNode, validateGraph, validatePlanNodeTaskType } = await import('./graph')
const graphPath = stageOutputFile(taskDir, 'architect')  // → graph.json

if (fs.existsSync(graphPath)) {
  const graph = readGraph(taskDir)

  if (isSingleNodeGraph(graph)) {
    // SIMPLE TASK: Extract plan.md from graph and continue existing pipeline
    const planContent = extractPlanFromSingleNode(graph)
    const planMdPath = path.join(taskDir, 'plan.md')
    fs.writeFileSync(planMdPath, planContent)
    console.log('  ✓ Single-node graph — extracted plan.md, continuing pipeline')
    // Continue to plan-gap → build → ... (existing flow)
  } else {
    // COMPLEX TASK: Multi-node graph — launch plan orchestrator
    console.log(`\n🔀 Multi-node graph (${Object.keys(graph.nodes).length} nodes, ${graph.levels.length} levels)`)

    // Validate graph
    const validation = validateGraph(graph)
    if (!validation.valid) {
      throw new Error(`Invalid graph: ${validation.errors.join(', ')}`)
    }

    // Validate all node task_types
    for (const node of Object.values(graph.nodes)) {
      const nodeDir = path.join(taskDir, node.taskId)
      const nodeTaskDef = readTask(nodeDir)
      if (nodeTaskDef) validatePlanNodeTaskType(nodeTaskDef)
    }

    // Commit task files (including graph.json and per-node files)
    const { getPlanBranch } = await import('./graph')
    commitPipelineFiles({
      taskDir,
      taskId: input.taskId,
      message: `ci(cody): plan ${input.taskId} — ${Object.keys(graph.nodes).length} nodes across ${graph.levels.length} levels`,
      ensureBranch: true,
      cleanDirtyState: true,
      stagingStrategy: 'task-only',
      push: true,
      isCI: !input.local,
      dryRun: input.dryRun,
      baseBranch: getPlanBranch(input.taskId),
    })

    console.log('\n🚀 Launching plan orchestrator...')
    const { executePlan } = await import('./plan-orchestrator')
    await executePlan(input.taskId, {
      local: input.local ?? false,
      dryRun: input.dryRun,
      pollInterval: 30,
      levelTimeout: 120,
      maxRetries: 2,
    })

    return 'plan-dispatched'
  }
}
```

**`main()` guard:**

```typescript
const result = await runImplPipeline(input, status, backend)
if (result === 'plan-dispatched') {
  // Don't mark completed — plan orchestrator is still running
  console.log('\n🔀 Plan dispatched — monitoring via plan orchestrator')
  return
}
completeStatus(loc, 'completed')
```

**Tests (FAIL before, PASS after):**

1. `tests/unit/scripts/cody/cody-routing.test.ts` — **Graph-based routing + guards**
   - When architect produces single-node graph → `plan.md` extracted, pipeline continues to plan-gap
   - When architect produces multi-node graph → plan orchestrator launched, returns `'plan-dispatched'`
   - `main()` does NOT call `completeStatus('completed')` when `'plan-dispatched'`
   - Plan mode with `--mode=full --plan-id=X` throws guard error
   - Plan mode with `--mode=spec --plan-id=X` throws guard error
   - Plan mode with `--mode=impl --plan-id=X` allowed
   - `commitPipelineFiles` called with `baseBranch: getPlanBranch(taskId)` in multi-node routing
   - Existing single-task pipeline works unchanged (backward compat)

**Acceptance criteria:**
- [ ] All 5 `ensureTaskDir` call sites pass `input.planId`
- [ ] All ~29 status call sites in cody.ts use `TaskLocation`
- [ ] `StageHookOptions` has `planId?` field
- [ ] `plan` mode routable
- [ ] Guard rejects `mode=full/spec` when `planId` set
- [ ] After architect: single-node → extract plan.md, continue pipeline
- [ ] After architect: multi-node → validate graph → commit with plan baseBranch → launch orchestrator → return `'plan-dispatched'`
- [ ] `main()` skips `completeStatus('completed')` when plan-dispatched
- [ ] Feature branches for plan tasks branch from `getPlanBranch(planId)`
- [ ] `commitPipelineFiles` passes `baseBranch`

---

## Step 6: Support Branching from Plan Branch in git-utils

**Time estimate: 20-25 minutes**

**Files to touch:**
- `scripts/cody/git-utils.ts` (MODIFIED, line 57 `BASE_BRANCHES` check, lines 105-180 `ensureFeatureBranch`, lines 366+ `commitAndPush`, lines 534+ `commitPipelineFiles`)

**Behavior:**
Add `baseBranch` parameter to `ensureFeatureBranch()`, `mergeDefaultBranch()`, `commitAndPush()`, and `CommitPipelineFilesOptions`. Add branch name validation. **Fix `BASE_BRANCHES` check to also allow `plan/` branches as valid base branches (fixes B4).** Thread `baseBranch` through `commitPipelineFiles → commitAndPush → ensureFeatureBranch` (fixes S11).

**NOTE:** Step 0 already migrated all `execSync` to `execFileSync`. This step only adds the `baseBranch` parameter and `BASE_BRANCHES` fix.

**Changes:**

```typescript
// NEW: Branch name validation:
export function isValidBranchName(name: string): boolean {
  return /^[a-zA-Z0-9\/_.-]+$/.test(name) && !name.includes('..')
}

// ensureFeatureBranch — add baseBranch param + BASE_BRANCHES fix (B4):
export function ensureFeatureBranch(
  taskId: string,
  taskType: string,
  projectDir?: string,
  baseBranch?: string  // NEW
): void {
  // CHANGED: Also allow plan/ branches as valid bases (fixes B4)
  if (!BASE_BRANCHES.includes(currentBranch) && !currentBranch.startsWith('plan/')) {
    console.log(`Already on feature branch: ${currentBranch}`)
    return
  }

  const base = baseBranch || getDefaultBranch(cwd)
  if (!isValidBranchName(base)) throw new Error(`Invalid base branch: ${base}`)
  // ... create feature branch from base
}

// mergeDefaultBranch — accept custom base:
function mergeDefaultBranch(cwd: string, baseBranch?: string): void

// commitAndPush — thread baseBranch (fixes S11):
export function commitAndPush(options: { ..., baseBranch?: string }): ... {
  if (options.ensureBranch) {
    ensureFeatureBranch(taskId, taskType, cwd, options.baseBranch)
  }
}

// CommitPipelineFilesOptions — add baseBranch:
interface CommitPipelineFilesOptions {
  // ... existing fields ...
  baseBranch?: string  // NEW — forwarded to commitAndPush → ensureFeatureBranch
}
```

**Tests (FAIL before, PASS after):**

1. `tests/unit/scripts/cody/git-utils.test.ts` — **Custom base branch + injection prevention + BASE_BRANCHES fix**
   - `ensureFeatureBranch('task-1', 'implement_feature', cwd, 'plan/my-plan')` — branches from `plan/my-plan`
   - `ensureFeatureBranch('task-1', 'implement_feature', cwd)` — defaults to `dev` (backward compat)
   - `ensureFeatureBranch('task-1', 'implement_feature', cwd, 'dev; rm -rf /')` — throws
   - `isValidBranchName('plan/260221-auth')` → true
   - `isValidBranchName('dev; curl evil.com')` → false
   - When on `plan/260221-auth` branch, `ensureFeatureBranch` creates new feature branch (not short-circuit) — B4 fix
   - `commitPipelineFiles({..., baseBranch:'plan/260221-x'})` → baseBranch forwarded through to `ensureFeatureBranch`

**Acceptance criteria:**
- [ ] `ensureFeatureBranch()` with `baseBranch` branches from that branch
- [ ] `ensureFeatureBranch()` without `baseBranch` unchanged (backward compat)
- [ ] `BASE_BRANCHES` check also allows `plan/` prefix branches (B4 fix)
- [ ] `commitPipelineFiles()` → `commitAndPush()` → `ensureFeatureBranch()` all thread `baseBranch`
- [ ] `isValidBranchName()` rejects shell injection and path traversal
- [ ] `mergeDefaultBranch()` accepts custom base branch

---

## Step 7: PR Target Branch for Plan Tasks

**Time estimate: 15-20 minutes**

**Files to touch:**
- `scripts/cody/scripted-stages.ts` (MODIFIED, `runPrStage`, `runCommitStage`, `getExistingPr`)

**Behavior:**
Refactor scripted stage signatures to use options object (fixes S10). PR targets plan branch when `planId` set. `getExistingPr` filters by `--base`.

**Changes:**

```typescript
import type { TaskLocation } from './cody-utils'
import { getPlanBranch } from './graph'

// runPrStage — refactored to options object:
export function runPrStage(
  taskDir: string,
  outputFile: string,
  options?: { cwd?: string; loc?: TaskLocation }
): { url: string | null } {
  let baseBranch = getDefaultBranch(projectDir)
  if (options?.loc?.planId) {
    baseBranch = getPlanBranch(options.loc.planId)
  }
  const existingPr = getExistingPr(featureBranch, projectDir, baseBranch)
  // gh pr create --base ${baseBranch} ...
}

// getExistingPr — add baseBranch filter:
function getExistingPr(branch: string, cwd: string, baseBranch?: string): string | null {
  const args = ['pr', 'list', '--head', branch, '--json', 'number,state,url']
  if (baseBranch) args.push('--base', baseBranch)
}

// runCommitStage — refactored to options object:
export function runCommitStage(
  taskDir: string,
  outputFile: string,
  options?: { cwd?: string; loc?: TaskLocation }
): { success: boolean; message: string; committed?: boolean }
```

**Call sites in cody.ts:**
```typescript
const loc: TaskLocation = { taskId: input.taskId, planId: input.planId }
runPrStage(taskDir, outputFile, { loc })
runCommitStage(taskDir, outputFile, { loc })
```

**Tests (FAIL before, PASS after):**

1. `tests/unit/scripts/cody/scripted-stages.test.ts` — **PR targets plan branch**
   - With `loc.planId` set → `gh pr create --base plan/<planId>`
   - Without `loc` → `gh pr create --base dev` (backward compat)
   - `getExistingPr` with baseBranch filters by `--base`
   - `runCommitStage` with empty taskDir basename → throws

**Acceptance criteria:**
- [ ] PR created with `--base plan/<planId>` when task is part of a plan
- [ ] PR created with `--base dev` when standalone (no regression)
- [ ] `getExistingPr` filters by `--base` for plan tasks
- [ ] Options object pattern (no `undefined` spacer args)
- [ ] `runCommitStage` asserts non-empty taskId

---

## Step 8: Plan Orchestrator — Core Execution Logic

**Time estimate: 30-40 minutes**

**Files to touch:**
- `scripts/cody/plan-orchestrator.ts` (NEW, ~550 lines)
- `.gitignore` (MODIFIED, add `.worktrees/`)

**Behavior:**
Main orchestration with two entry points: `executePlan()` (full run) and `advancePlan()` (single-level advancement from CI). Uses deterministic branch derivation, explicit PR merge after checks, git worktrees for local mode, symlink protection.

**Key functions:**

- `executePlan(planId, options)` — full run: read graph, create plan branch from `dev`, dispatch levels bottom-up
- `advancePlan(planId, completedNodeId)` — CI callback: mark node complete, check if level done, dispatch next level
- `dispatchLevel(graph, level, planId, options)` — dispatch all nodes at a level (CI: `gh workflow run`, local: worktree)
- `waitForLevelCompletion(graph, level, planId, options)` — poll PRs for merge status
- `mergeNodePR(graph, node, planId)` — `gh pr merge --squash` after checks pass
- `createPlanBranch(planId, baseBranch)` — create `plan/<planId>` from `dev`
- `createSummaryPR(planId, graph)` — final PR from `plan/<planId>` → `dev`
- `sanitizeForGitHub(text)` — strip GH Actions commands, @mentions, URLs (H6 fix)
- `setupWorktree(planId, nodeId)` / `cleanupWorktree(planId, nodeId)` — local mode with symlink protection (H2 fix)

**Security invariants:**
- **Graph integrity verified BEFORE any dispatch** (H4 fix) — `readGraph()` verifies checksum, then `dispatchLevel()` validates task_ids against verified graph
- **`sanitizeForGitHub()` strips GitHub Actions commands** (H6 fix) — `::set-output`, `::add-mask`, etc.
- **`MAX_POLLS_PER_LEVEL = 500`** and **`--poll-interval >= 15` minimum** enforced (M2 fix)
- **`totalDispatches` counter** per node, enforced `MAX_TOTAL_DISPATCHES = 5` across plan restarts
- **`advancePlan()` uses `throw` for errors, `return` for graceful exit** — no `process.exit()`
- **Worktree security**: check `.worktrees/`, `.worktrees/<planId>/` for symlinks at each path component (H2 fix)

```typescript
// dispatchLevel — verify graph integrity + validate task_ids (H4 fix):
async function dispatchLevel(graph, level, planId, options): Promise<void> {
  if (!verifyChecksum(graph)) throw new PlanIntegrityError('Graph tampered before dispatch')
  const nodes = getNodesAtLevel(graph, level)
  for (const node of nodes) {
    if (!graph.nodes[node.taskId]) throw new Error(`Unknown task_id: ${node.taskId}`)
    if (node.totalDispatches >= MAX_TOTAL_DISPATCHES) {
      updateNodeState(graph, node.taskId, 'failed')
      node.error = `Exceeded max total dispatches (${MAX_TOTAL_DISPATCHES})`
      continue
    }
    node.totalDispatches++
    // ... dispatch logic (gh workflow run or worktree)
  }
}

// waitForLevelCompletion — enforce poll limits (M2):
async function waitForLevelCompletion(graph, level, planId, options): Promise<void> {
  if (options.pollInterval < 15) throw new Error('Poll interval must be >= 15 seconds')
  let pollCount = 0
  const MAX_POLLS_PER_LEVEL = 500
  while (true) {
    pollCount++
    if (pollCount > MAX_POLLS_PER_LEVEL) {
      throw new PlanTimeoutError(`Level ${level} exceeded max polls (${MAX_POLLS_PER_LEVEL})`)
    }
    // ... rest of polling logic
  }
}

// sanitizeForGitHub — expanded (H6 fix):
function sanitizeForGitHub(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/@(\w)/g, '`@`$1')
    .replace(/#(\d+)/g, '`#$1`')
    .replace(/!\[/g, '\\![')
    .replace(/\[([^\]]*)\]\(https?:\/\/[^)]*\)/g, '$1')
    .replace(/^::[a-zA-Z-]+.*$/gm, '')          // Strip GH Actions commands
    .replace(/%0[aAdD]/g, '')                     // Escape URL-encoded newlines
}
```

**Tests (FAIL before, PASS after):**

1. `tests/unit/scripts/cody/plan-orchestrator.test.ts` — **Level dispatch, completion, merge, security**
   - `executePlan()` creates plan branch, dispatches level 0, waits, dispatches level 1, creates summary PR
   - `dispatchLevel()` verifies checksum before dispatching any nodes
   - `dispatchLevel()` rejects task_id not in verified graph
   - `dispatchLevel()` skips node when `totalDispatches >= MAX_TOTAL_DISPATCHES`
   - `waitForLevelCompletion()` rejects `pollInterval < 15`
   - `waitForLevelCompletion()` fails after `MAX_POLLS_PER_LEVEL = 500` polls
   - `sanitizeForGitHub('::set-output name=foo::bar')` → empty string
   - `sanitizeForGitHub('test%0Ainjection')` → `'testinjection'`
   - Worktree symlink check at each path component
   - `advancePlan()` uses `throw` (not `process.exit()`)
   - Local mode uses git worktrees; CI mode uses `gh workflow run`

**Acceptance criteria:**
- [ ] `executePlan()` creates plan branch and dispatches nodes level-by-level
- [ ] `advancePlan()` marks node complete and advances to next level
- [ ] Graph integrity verified BEFORE any dispatch
- [ ] Dispatched task_ids validated against verified graph
- [ ] `totalDispatches` per node enforced (max 5)
- [ ] `--poll-interval >= 15` enforced
- [ ] `MAX_POLLS_PER_LEVEL = 500` enforced
- [ ] `sanitizeForGitHub()` strips GH Actions commands and URL-encoded newlines
- [ ] Worktree symlink check at each path component
- [ ] `.gitignore` includes `.worktrees/`
- [ ] Retry: max 2 per cycle, block dependents on failure, continue independent nodes

---

## Step 9: GitHub Actions Workflows

**Time estimate: 20-30 minutes**

**Files to touch:**
- `.github/workflows/plan.yml` (NEW, ~160 lines)
- `.github/workflows/cody.yml` (MODIFIED)
- `scripts/cody/run-cody.sh` (MODIFIED)
- `scripts/cody/parse-inputs.sh` (MODIFIED)
- `scripts/cody/parse-plan-safety.sh` (NEW, ~40 lines)
- `scripts/cody/checkout-task-branch.sh` (MODIFIED)

**Behavior:**

### plan.yml (NEW)
GitHub Actions workflow for plan orchestration. Two triggers:
1. `workflow_dispatch` — dispatched by plan-orchestrator to run a single node
2. `pull_request` (closed + merged) — callback when a node PR merges to plan branch

Concurrency group: `plan-<planId>` with `cancel-in-progress: false`.

```yaml
name: Plan Orchestrator
on:
  workflow_dispatch:
    inputs:
      plan_id: { required: true, type: string }
      task_id: { required: true, type: string }
      node_id: { required: true, type: string }
  pull_request:
    types: [closed]
    branches: ['plan/**']

concurrency:
  group: plan-${{ github.event.inputs.plan_id || 'pr-merge' }}
  cancel-in-progress: false

jobs:
  resolve:
    runs-on: ubuntu-latest
    steps:
      - name: Validate actor permissions
        id: safety
        env:
          GH_TOKEN: ${{ github.token }}
          ACTOR: ${{ github.event_name == 'pull_request' && github.event.sender.login || github.actor }}
        run: ./scripts/cody/parse-plan-safety.sh
  # ... rest of workflow
```

### parse-inputs.sh — Add TASK_ID validation (C4 fix)
```bash
if [ -n "$DISPATCH_TASK_ID" ]; then
  if ! [[ "$DISPATCH_TASK_ID" =~ ^[0-9]{6}-[a-zA-Z0-9-]+$ ]]; then
    echo "valid=false" >> "$GITHUB_OUTPUT"
    exit 0
  fi
fi
```

### parse-plan-safety.sh — Fix actor source + validate username (C5 fix)
```bash
#!/usr/bin/env bash
set -euo pipefail
if ! [[ "$ACTOR" =~ ^[a-zA-Z0-9-]+$ ]]; then
  echo "valid=false" >> "$GITHUB_OUTPUT"
  exit 0
fi
PERMISSION=$(gh api "repos/${GITHUB_REPOSITORY}/collaborators/${ACTOR}/permission" --jq '.permission' 2>/dev/null || echo "none")
if [[ "$PERMISSION" == "admin" || "$PERMISSION" == "maintain" || "$PERMISSION" == "write" ]]; then
  echo "valid=true" >> "$GITHUB_OUTPUT"
else
  echo "valid=false" >> "$GITHUB_OUTPUT"
fi
```

### cody.yml — Add `plan_id` input
```yaml
inputs:
  plan_id:
    description: 'Plan ID (for plan node execution)'
    required: false
```
Forward as `--plan-id` to `run-cody.sh`.

### run-cody.sh — Forward `--plan-id`
```bash
if [ -n "${PLAN_ID:-}" ]; then
  EXTRA_ARGS+=" --plan-id=$PLAN_ID"
fi
```

### checkout-task-branch.sh — Add TASK_ID validation + support plan branch merge base
```bash
if ! [[ "$TASK_ID" =~ ^[0-9]{6}-[a-zA-Z0-9-]+$ ]]; then
  echo "=== Error: invalid TASK_ID format ==="
  exit 1
fi
# Support plan branch as merge base
if [ -n "${PLAN_ID:-}" ]; then
  MERGE_BASE="plan/${PLAN_ID}"
fi
```

**Tests (FAIL before, PASS after):**

1. `tests/unit/scripts/cody/workflows.test.ts` — **Workflow input validation**
   - `parse-inputs.sh` with valid TASK_ID → `valid=true`
   - `parse-inputs.sh` with `../../evil` TASK_ID → `valid=false`
   - `parse-plan-safety.sh` with invalid actor format → `valid=false`
   - `plan.yml` validates actor for both dispatch and PR-close triggers

**Acceptance criteria:**
- [ ] `plan.yml` exists with dispatch + PR-close triggers
- [ ] Concurrency group prevents parallel runs for same planId
- [ ] `parse-inputs.sh` validates TASK_ID format with bash regex
- [ ] `parse-plan-safety.sh` validates actor username format + permissions
- [ ] `cody.yml` has `plan_id` input
- [ ] `run-cody.sh` forwards `--plan-id`
- [ ] `checkout-task-branch.sh` supports plan branch merge base

---

## Step 10: Plan Decomposition Skill + Slash Command (Manual Override)

**Time estimate: 10-15 minutes**

**Files to touch:**
- `.agents/skills/plan-decomposition/SKILL.md` (NEW)
- `.claude/commands/plan-decomposition.md` (NEW)

**Behavior:**
Optional manual override for when a user wants to force plan decomposition on a task that the architect might not have decomposed. The skill reads the current task spec and produces a multi-node graph.

The skill is a lightweight wrapper that:
1. Reads `.tasks/<task-id>/spec.md` and `.tasks/<task-id>/clarified.md`
2. Calls the architect agent with explicit "multi-node" instruction
3. Writes `graph.json` + per-node files

**Slash command** (`/plan-decomposition <task-id>`) triggers the skill.

**Tests (FAIL before, PASS after):**

1. `tests/unit/scripts/cody/skill-files.test.ts` — **Skill file existence**
   - `.agents/skills/plan-decomposition/SKILL.md` exists and contains expected sections
   - `.claude/commands/plan-decomposition.md` exists

**Acceptance criteria:**
- [ ] SKILL.md documents the manual decomposition override
- [ ] Slash command exists and references the skill
- [ ] Instructions reference `graph.json` output contract

---

## Step 11: Update OpenCode Agent Prompts (Hardcoded Paths)

**Time estimate: 10-15 minutes**

**Files to touch (narrowed to agents with actual hardcoded paths):**
- `.opencode/agents/taskify.md` (MODIFIED — line 20)
- `.opencode/agents/gap.md` (MODIFIED — line 122)
- `.opencode/agents/verify.md` (MODIFIED — line 28)
- `.opencode/agents/spec.md` (MODIFIED — lines 17, 57)

**NOTE:** `architect.md` is already updated in Step 4.

**Change pattern:**
```
Before: Only read from and write to the .tasks/{TASK_ID}/ directory.
After:  Only read from and write to the task directory specified in the prompt below.
```

**Tests (FAIL before, PASS after):**

1. `tests/unit/scripts/cody/agent-paths.test.ts` — **No hardcoded .tasks/ paths in agents**
   - Grep `taskify.md`, `gap.md`, `verify.md`, `spec.md` for `.tasks/{TASK_ID}` — expect zero matches
   - Each agent contains "task directory specified in the prompt" or similar dynamic reference

**Acceptance criteria:**
- [ ] Zero hardcoded `.tasks/{TASK_ID}` references in the 4 agents above
- [ ] Other agents verified to have no hardcoded paths (no changes needed)

---

## Step 12: Package.json Scripts

**Time estimate: 5-10 minutes**

**Files to touch:**
- `package.json` (MODIFIED)

```json
{
  "scripts": {
    "plan:execute": "pnpm tsx scripts/cody/plan-orchestrator.ts",
    "plan:status": "pnpm tsx scripts/cody/plan-orchestrator.ts --status"
  }
}
```

**Acceptance criteria:**
- [ ] `pnpm plan:execute --plan-id=<id>` runs orchestrator
- [ ] `pnpm plan:status --plan-id=<id>` shows state

---

## Implementation Order (Dependency Graph)

```
Step 0 (execSync migration) ←── PREREQUISITE FOR ALL
                                    │
Step 1 (graph.ts) ──────────────────┤
Step 6 (git-utils baseBranch) ──────┤
                                    │
Step 2 (cody-utils planId) ←── Step 0 (clean execFileSync base)
Step 3 (stage-prompts+output map) ←── Step 2
Step 4 (architect.md) ←── Step 1 (graph schema knowledge)
                                    │
Step 5 (cody.ts routing) ←── Steps 1,2,3,4
Step 7 (PR target) ←── Steps 1,2,6
                                    │
Step 8 (plan-orchestrator) ←── Steps 1,2,5,6,7
Step 9 (GH Actions+shell) ←── Step 8
Step 10 (Skill+slash cmd) ←── Step 8
Step 11 (Agent prompts) ←── Step 3
Step 12 (package.json) ←── Step 8
```

**Parallelizable groups:**
- **Step 0** FIRST (prerequisite)
- **Group A** (after Step 0, no mutual deps): Steps 1, 6
- **Group B** (dep on Step 0): Step 2
- **Group C** (dep on Steps 1,2): Steps 3, 4
- **Group D** (dep on all above): Steps 5, 7
- **Group E** (dep on D): Step 8
- **Group F** (dep on Step 8): Steps 9, 10, 11, 12

---

## Edge Cases

| Case | Handling |
|------|----------|
| Architect produces single-node graph | Extract plan.md from `plan` field, continue existing pipeline unchanged |
| Architect produces multi-node graph | Validate graph, launch plan orchestrator |
| Existing task.json without plan fields | No change needed — no decomposition fields exist in TaskDefinition |
| Task with 16+ nodes | `validateGraph()` rejects (MAX_PLAN_NODES=15) |
| Merge conflicts between parallel PRs | Orchestrator detects merge failure, retries node |
| Agent failure mid-plan | Retry (max 2 per cycle, max 5 total dispatches), mark failed, block dependents |
| `dev` drift during execution | Head node merges latest `dev` before verification |
| Partial re-execution | `--from-level=N` resets level N+. `--from-level=0` requires `--force` |
| Cycle in deps | `buildGraph()` throws PlanCycleError |
| Wrong PR reuse | `getExistingPr` filters by `--base plan/<planId>` |
| Tampered graph.json | Checksum verified. planBranch asserted. Branch derived deterministically. |
| Invalid planId | Validated at every entry point (TS + shell) |
| Shell injection | ALL git/gh commands use `execFileSync`. Branch names validated. |
| Symlink at worktree path | Component-by-component check |
| `mode=full` for plan node | Guard throws error |
| `task_type=docs` for plan node | `validatePlanNodeTaskType()` throws |
| Missing graph.json after architect | Pipeline fails with clear error |
| Architect rerun with existing graph.json | Architect reads previous graph, decides whether to keep structure or rewrite |
| GitHub rate limit | Catch error, double poll interval, retry |
| Excessive polling | `MAX_POLLS_PER_LEVEL = 500`, `pollInterval >= 15` |
| Node dispatched too many times | `totalDispatches >= MAX_TOTAL_DISPATCHES (5)` → mark failed |
| GH Actions command injection in issue body | `sanitizeForGitHub()` strips `::command::` patterns |
| `/cody plan 260221-auth` via issue comment | `parseCommentBody()` supports `plan` subcommand |
| Dry-run with architect | `DRY_RUN_OUTPUTS.architect` produces valid single-node graph JSON |

---

## Assumptions

1. `dev` is the default branch
2. `gh` CLI authenticated in both local and CI
3. OpenCode runs in GitHub Actions (not Claude Code)
4. All plan nodes use `impl` mode (spec pre-computed), starting from `build` stage
5. PR merge to plan branch = completion signal
6. Max plan size: 15 nodes, ~5 levels
7. Each Cody node: ~30-45 minutes
8. Branch protection on `plan/**` is configured (REQUIRED prerequisite)
9. "Automatically delete head branches" enabled in repo settings
10. `opencode` is the default agent
11. `json-stable-stringify` or equivalent available (or use sorted-key JSON.stringify)
12. The architect agent (Opus) is capable enough to decide single vs multi-node and produce valid graph.json
13. Single-node graphs have a `plan` field containing the full plan text (backward compatible with plan.md content)
