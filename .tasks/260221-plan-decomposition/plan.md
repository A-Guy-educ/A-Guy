# Plan: Plan Decomposition — Pipeline-Integrated Multi-Task Orchestration for Cody

## Gap Analysis & Security Audit Response (Round 3)

Third revision incorporating findings from code review (4 blocking + 14 significant gaps) and security audit (5 critical + 6 high findings). All addressed below.

### Blocking Gaps Resolved

| ID | Gap | Resolution |
|----|-----|------------|
| B1 | Status function internal call sites missed — 8 internal `getTaskDir(taskId)` calls within cody-utils.ts | **Counted correctly now: 29 external (cody.ts) + 1 (stage-hooks.ts) + 8 internal (cody-utils.ts) = 38 total.** Internal calls in `readStatus`, `writeStatus`, `completeStatus`, `getLastFailedStage`, `initStatus` all route through `getTaskDir(taskId)` which now accepts optional `planId`. Status functions pass `loc.planId` through to `getTaskDir`. |
| B2 | `stageInstructions` Record type requires ALL 13 entries to have same signature | **All 13 entries updated** to `(taskId: string, planId?: string) => string`. Even entries returning `''` get the new signature. Record type: `Record<Stage, (taskId: string, planId?: string) => string>`. |
| B3 | `buildStagePrompt()` doesn't pass `planId` to `stageInstructions` call | **Fixed:** `instructionFn(taskId, input.planId)` — explicit in Step 4 changes. |
| B4 | `ensureFeatureBranch()` `BASE_BRANCHES` check skips branch creation for `plan/` branches | **Fixed:** Add `plan/` prefix match: `if (!BASE_BRANCHES.includes(currentBranch) && !currentBranch.startsWith('plan/'))`. Explicit in Step 7. |

### Significant Gaps Resolved

| ID | Gap | Resolution |
|----|-----|------------|
| S1 | `TaskLocation` defined in graph.ts but imported from cody-utils in Step 8 | **Canonical location: `cody-utils.ts`**. `graph.ts` imports `TaskLocation` from `cody-utils`. No circular dependency — graph.ts only uses the type, not status functions. |
| S2 | `CodyInput.mode` literal union not derived from VALID_MODES | **Refactored**: `mode: (typeof VALID_MODES)[number]` so adding `'plan'` to `VALID_MODES` auto-updates the type. |
| S3 | `parseCommentBody()` doesn't support `plan` subcommand | **Added**: `plan` recognized in `parseCommentBody()` — `/cody plan <planId>` sets `mode:'plan', planId`. |
| S4 | `decompose` not in `SPEC_STAGES` | **Added** `'decompose'` to `SPEC_STAGES` in stage-prompts.ts — it's a spec-only stage (no code changes). |
| S5/S7 | `STAGE_OUTPUT_MAP` missing `decompose: 'graph.json'` — file watcher would watch wrong file | **Added** `decompose: 'graph.json'` to `STAGE_OUTPUT_MAP` in pipeline-utils.ts. |
| S6 | `DRY_RUN_OUTPUTS` missing `decompose` entry — dry-run breaks | **Added** `decompose: (taskId) => JSON.stringify(mockGraph)` to `DRY_RUN_OUTPUTS`. |
| S8 | `main()` calls `completeStatus('completed')` after spec pipeline returns, but plan may still be dispatching | **Fixed:** When `executePlan()` dispatches CI workflows and returns, set status to `'running'` not `'completed'`. `completeStatus` in `main()` guarded: `if (taskDef?.decomposition !== 'parallel')`. |
| S9 | `execSync` migration scope underestimated (37 total, not ~10) | **Expanded**: Step 0 covers ALL `execSync` template-literal calls across entire `git-utils.ts` AND `cody-utils.ts` (37+ calls total). |
| S10 | `runPrStage` 4th positional param awkward | **Refactored** to options object: `runPrStage(taskDir, outputFile, options?: { cwd?, loc? })`. Same for `runCommitStage`. |
| S11 | `commitAndPush` calls `ensureFeatureBranch` without baseBranch for plan nodes | **Fixed:** Thread `baseBranch` through `commitPipelineFiles` → `commitAndPush` → `ensureFeatureBranch`. |
| S12 | `commitPipelineFiles` in decompose routing doesn't pass `baseBranch` | **Fixed:** Pass `baseBranch: getPlanBranch(input.taskId)` in decompose routing commit call. |
| S13 | Agent prompt cleanup overscoped (12 agents listed, only 5 have hardcoded paths) | **Narrowed** to 5 agents with actual hardcoded paths: `taskify.md`, `gap.md`, `verify.md`, `architect.md`, `spec.md`. |
| S14 | No `STAGE_TIMEOUTS` for `decompose` — default 10min too short | **Added** `decompose: 20 * 60_000` (20 min) to `STAGE_TIMEOUTS` in `agent-runner.ts`. |

### Security Findings Resolved

| ID | Finding | Resolution |
|----|---------|------------|
| C1-C3 | `execSync` template-literal injection in git-utils.ts AND cody-utils.ts | **New Step 0 (prerequisite):** Migrate ALL `execSync` template-literal calls to `execFileSync` across both files. Hard prerequisite for all other steps. |
| C4 | `parse-inputs.sh` writes TASK_ID without validation — shell scripts use before TS validates | **Added:** bash regex validation `[[ "$DISPATCH_TASK_ID" =~ ^[0-9]{6}-[a-zA-Z0-9-]+$ ]]` in `parse-inputs.sh` BEFORE writing to `$GITHUB_OUTPUT`. |
| C5 | `plan.yml` actor check uses wrong actor source + no username sanitization | **Fixed:** Use `github.event.sender.login` (merger, not PR author). Validate username `[a-zA-Z0-9-]+` before use. Use `--jq` with `gh api` rather than string interpolation. |
| H1 | `runGate()` uses `execSync(command)` with string commands | **Converted** to `execFileSync` with array-based args in gate definitions. |
| H2 | Worktree path escape: need component-by-component symlink check | **Specified**: Check `.worktrees/` dir, then `.worktrees/<planId>/` for symlinks at each level. `path.resolve()` must start with `path.resolve(process.cwd())`. |
| H3 | `plan.yml` workflow_dispatch should also validate actor permissions | **Added**: dispatch trigger validates `github.actor` has write+ permission too. |
| H4 | Tampered graph.json could dispatch attacker-controlled task_ids | **Added**: Integrity check (checksum) verified BEFORE any dispatch. Dispatched task_ids validated against verified graph nodes. |
| H5 | No runtime enforcement that `graph.planBranch` is never used for git ops | **Added**: Runtime assertion in `readGraph()`: `if (graph.planBranch !== getPlanBranch(graph.planId)) throw PlanIntegrityError`. |
| H6 | `sanitizeForGitHub()` missing GitHub Actions command syntax stripping | **Added**: Strip `::set-output`, `::add-mask`, and other `::command::` patterns. Escape `%0A`/`%0D`. |
| M1 | No max node count in `buildGraph()` | **Added**: `MAX_PLAN_NODES = 15`, `MIN_PLAN_NODES = 2` enforced in `validateGraph()`. |
| M2 | Polling loop could exhaust API rate limits | **Added**: `MAX_POLLS_PER_LEVEL = 500`, `--poll-interval >= 15` minimum. |
| M5 | JSON key order non-deterministic for checksums | **Use `json-stable-stringify`** (or sorted-key `JSON.stringify`) for canonical serialization. |

### Minor Gaps Resolved

| ID | Resolution |
|----|------------|
| M1-plan | `estimated_nodes` example changed from `0` to omitted when `decomposition: 'single'` |
| M2-plan | `getImplStages()` deprecated (unused, add TODO to remove) |
| M3-plan | `SPEC_ONLY_STAGES` in pipeline-utils.ts gets `'decompose'` added |
| M4-plan | Decompose agent `bash: false` (only needs read+write) |
| M6-plan | Removed `pnpm generate:importmap` — irrelevant for OpenCode agents |
| M7-plan | `validatePlanNodeTaskType(taskDef: { task_type: string })` — explicit type |
| M8-plan | `advancePlan` uses `throw` for errors and `return` for graceful exit (no `process.exit()`) |

---

## Summary

Add a plan decomposition and orchestrated execution layer **as a native Cody pipeline stage**. The `taskify` agent detects multi-task complexity and sets `decomposition: 'parallel'` in `task.json`. When parallel, a new `decompose` stage runs after `clarify`, producing `graph.json` with node descriptions. Then the `architect` agent (reused) generates specs per node in parallel. Nodes are dispatched level-by-level. All intermediate PRs merge to a plan feature branch. The head node verifies integration and creates a summary PR to `dev`.

## Architecture

```
Pipeline Flow:
  taskify → spec → gap → [clarify] → ROUTE based on task.json.decomposition
                                        │
                          ┌──────────────┴──────────────┐
                    SINGLE (as today)              PARALLEL (new)
                          │                              │
                    architect → plan-review →       decompose stage runs
                    build → commit →               graph.json created
                    verify → auditor →             plan branch created
                    apply-audit → pr               architect runs per node
                                                   nodes dispatched level-by-level
                                                   each: build → verify → commit → pr
                                                   head node → summary PR to dev
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

1. **Decomposition is a pipeline stage**, not just a manual skill — `taskify` detects complexity, `decompose` agent produces graph
2. **Each graph node = a Cody task** — reuses the entire existing pipeline (build → verify → commit → PR)
3. **Pre-computed specs** — decompose + architect produce `spec.md` + `plan.md` per node upfront, so Cody starts at `build` stage
4. **Bottom-up execution** — Level 0 (leaves, no deps) first → Level N (head) last
5. **Plan feature branch** — all intermediate PRs merge to `plan/<planId>`, isolating work from `dev`
6. **Explicit merge after checks** — orchestrator waits for CI checks to pass (`gh pr checks --watch`), then merges via `gh pr merge --squash` (NOT `--auto`)
7. **Completion signal** — PR merged to plan branch = node done
8. **Failure handling** — retry via Cody rerun (max 2), then halt dependent nodes, continue independent ones
9. **Dual execution** — CI via `gh workflow run plan.yml` (parallel on separate runners) or local via `git worktree`
10. **Deterministic branch derivation** — `planBranch` always computed as `plan/<planId>`, never read from mutable files
11. **Branch protection required** — `plan/**` branches must have status check requirements
12. **Security-first** — Step 0 migrates ALL `execSync` template-literal calls before any new code

### Invariants

- **INVARIANT: One orchestrator per plan at a time.** Concurrency group `plan-<planId>` with `cancel-in-progress: false`.
- **INVARIANT: Monotonic state transitions.** Node states only move forward: `pending → dispatched → running → completed|failed`.
- **INVARIANT: `planId` validated before any use.** `validatePlanId()` called at every entry point.
- **INVARIANT: `planBranch` is deterministic.** Always `plan/<planId>`. Never derived from mutable state. Runtime assertion enforces on every `readGraph()`.
- **INVARIANT: Plan nodes use impl-only task types.** `task_type` must be `implement_feature`, `fix_bug`, `refactor`, or `ops`.
- **INVARIANT: Graph integrity verified before dispatch.** Checksum checked before any node dispatch. Dispatched task_ids validated against verified graph.
- **INVARIANT: No shell injection.** ALL git/gh commands use `execFileSync` (array-based, no shell). Branch names validated via `isValidBranchName()`.

### task.json Extension

`TaskDefinition` in `pipeline-utils.ts` gains new fields:

```typescript
decomposition: 'single' | 'parallel'
decomposition_reason: string
estimated_nodes?: number
```

### Directory Structure

```
.tasks/<plan-id>/
├── graph.json                     # DAG: nodes, edges, levels, state, checksum
├── <task-id>/                     # One per graph node
│   ├── task.md                    # Generated by decompose agent
│   ├── task.json                  # Pre-computed (skip taskify)
│   ├── spec.md                    # Pre-computed by architect (skip spec stage)
│   ├── clarified.md               # Pre-filled "Use recommended answers"
│   ├── plan.md                    # Pre-computed (skip architect)
│   ├── plan-review.md             # Pre-filled PASS
│   ├── build.md → verify.md → ... # Generated by Cody at runtime
│   └── status.json
└── <head-task-id>/                # Head node (integration verification)
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
| `postComment(issueNumber, body)` | `execSync(\`gh issue comment ${issueNumber} ...\`)` | `execFileSync('gh', ['issue', 'comment', String(issueNumber), '--body-file', '-'], {input: body})` |
| `getIssueBody(issueNumber)` | `execSync(\`gh issue view ${issueNumber} --json body --jq .body\`)` | `execFileSync('gh', ['issue', 'view', String(issueNumber), '--json', 'body', '--jq', '.body'])` |
| `editComment(commentId, body)` | `execSync(\`gh api repos/${repo}/issues/comments/${commentId}\`)` | `execFileSync('gh', ['api', \`repos/\${repo}/issues/comments/\${commentId}\`, '-X', 'PATCH', '--input', '-'], {input: JSON.stringify({body})})` |
| `getLatestIssueComment(issueNumber, excludeAuthor?)` | `execSync(\`gh issue view ... --jq '[...select(.authorAssociation != "${exclude}")]'\`)` | Parse JSON in TypeScript instead of inline `--jq` with interpolated values |
| `discoverTaskIdFromIssue(issueNumber)` | Same `--jq` interpolation pattern | Same fix — parse JSON in TypeScript |
| `validateAuth()` | `execSync('gh auth status')` | `execFileSync('gh', ['auth', 'status'])` |
| `ensureTaskMarkerComment(...)` | Uses `postComment`/`editComment` internally | Fixed by fixing those functions |

### scripted-stages.ts (`runGate()`)

```typescript
// Before:
const gateDefinitions = [
  { name: 'TypeScript', command: 'pnpm -s tsc --noEmit' },
  // ...
]
execSync(gate.command, { timeout, ... })

// After:
const gateDefinitions = [
  { name: 'TypeScript', cmd: 'pnpm', args: ['-s', 'tsc', '--noEmit'] },
  // ...
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
- `scripts/cody/graph.ts` (NEW, ~350 lines)

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
- `buildGraph(planId, title, description, nodes)` — validate deps, detect cycles, compute levels, enforce min/max node count, set checksum
- `computeLevels(nodes)` — reverse topological sort: level 0 = no deps, level N = max(dep levels) + 1
- `getNodesAtLevel(graph, level)`, `isLevelComplete(graph, level)`, `getNextLevel(graph)`, `getLevelCount(graph)`
- `readGraph(planDir)` — parse JSON, verify checksum, **assert `graph.planBranch === getPlanBranch(graph.planId)` (runtime enforcement of H5)**, throw `PlanIntegrityError` on mismatch
- `writeGraph(planDir, graph)` — recompute checksum using **sorted-key canonical JSON** (via `json-stable-stringify` or `JSON.stringify(graph, Object.keys(graph).sort())`), atomic write via `.tmp` rename
- `updateNodeState(graph, taskId, newState)` — validate against `VALID_TRANSITIONS`
- `computeChecksum(graph)` — SHA-256 of canonical JSON with checksum=''
- `verifyChecksum(graph)` — compare stored vs computed
- `validateGraph(graph)` — no cycles, all deps exist, head node exists, levels correct, task_types valid, **node count between MIN_PLAN_NODES and MAX_PLAN_NODES**
- `detectCycles(nodes)` — DFS with visited/inStack sets, returns cycle path or null
- `validatePlanNodeTaskType(taskDef: { task_type: string })` — throws if task_type not in `VALID_PLAN_TASK_TYPES`
- `resetFromLevel(graph, level, force)` — reset all nodes at level+ to pending; level 0 requires `--force`
- `renderGraphAscii(graph)`, `renderGraphTable(graph)` — visualization

**Error classes:** `PlanNotFoundError`, `PlanIntegrityError`, `PlanCycleError`, `PlanNodeFailedError`, `PlanTimeoutError`, `InvalidStateTransitionError`

**Tests (FAIL before, PASS after):**

1. `tests/unit/scripts/cody/graph.test.ts` — **Cycle detection, level computation, state transitions, limits**
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
   - `buildGraph()` with 1 node: throws (below MIN_PLAN_NODES)
   - `readGraph()` with `planBranch !== getPlanBranch(planId)`: throws PlanIntegrityError

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
- [ ] `readGraph()` asserts `planBranch === getPlanBranch(planId)` (runtime enforcement)
- [ ] State transitions enforced via VALID_TRANSITIONS
- [ ] `resetFromLevel(0)` requires `--force`
- [ ] Atomic write: `.tmp` then rename
- [ ] Canonical JSON serialization (sorted keys) for checksums
- [ ] `MAX_PLAN_NODES = 15`, `MIN_PLAN_NODES = 2` enforced
- [ ] `totalDispatches` counter per node, `MAX_TOTAL_DISPATCHES = 5`

---

## Step 2: Extend TaskDefinition + taskify Agent for Decomposition Detection

**Time estimate: 15-25 minutes**

**Files to touch:**
- `scripts/cody/pipeline-utils.ts` (MODIFIED, lines 49-58 `TaskDefinition`, lines 116-160 `normalizeTask()`, lines 162-231 `validateTask()`, line 280 `STAGE_OUTPUT_MAP`, line 297 `SPEC_ONLY_STAGES`, line 304 `DRY_RUN_OUTPUTS`)
- `.opencode/agents/taskify.md` (MODIFIED, add decomposition assessment)

**Behavior:**
Add `decomposition`, `decomposition_reason`, `estimated_nodes` fields to `TaskDefinition`. Update `normalizeTask()` to default `decomposition: 'single'` when missing. Update `validateTask()` to validate the new fields. Add `decompose: 'graph.json'` to `STAGE_OUTPUT_MAP`. Add `'decompose'` to `SPEC_ONLY_STAGES`. Add `decompose` to `DRY_RUN_OUTPUTS`. Update `taskify.md` agent prompt.

**Changes to `pipeline-utils.ts`:**

```typescript
// TaskDefinition — add 3 new fields:
export interface TaskDefinition {
  // ... existing fields ...
  decomposition: 'single' | 'parallel'
  decomposition_reason: string
  estimated_nodes?: number
}

// normalizeTask() — add defaults:
if (!data.decomposition) {
  data.decomposition = 'single'
}
if (!data.decomposition_reason) {
  data.decomposition_reason = data.decomposition === 'single'
    ? 'Single coherent task'
    : 'Multi-component task requiring parallel decomposition'
}

// validateTask() — add validation:
const VALID_DECOMPOSITIONS = ['single', 'parallel'] as const
if (!VALID_DECOMPOSITIONS.includes(data.decomposition as any)) {
  errors.push(`Invalid decomposition: "${data.decomposition}". Must be: single, parallel`)
}
if (typeof data.decomposition_reason !== 'string' || !data.decomposition_reason) {
  errors.push(`decomposition_reason must be a non-empty string`)
}
if (data.estimated_nodes !== undefined && (typeof data.estimated_nodes !== 'number' || data.estimated_nodes < 2)) {
  errors.push(`estimated_nodes must be a number >= 2`)
}

// STAGE_OUTPUT_MAP — add decompose:
decompose: 'graph.json',

// SPEC_ONLY_STAGES — add decompose:
export const SPEC_ONLY_STAGES = ['spec', 'gap', 'clarify', 'decompose']

// DRY_RUN_OUTPUTS — add decompose (mock graph):
decompose: (taskId) => JSON.stringify({
  planId: taskId,
  title: `[dry-run] Plan for ${taskId}`,
  description: 'Mock plan',
  createdAt: new Date().toISOString(),
  state: 'pending',
  planBranch: `plan/${taskId}`,
  baseBranch: 'dev',
  nodes: {
    '01-mock': {
      taskId: '01-mock', title: 'Mock task', description: 'Mock',
      acceptanceCriteria: [], dependsOn: [], level: 0,
      state: 'pending', retries: 0, totalDispatches: 0,
    },
    '02-head': {
      taskId: '02-head', title: 'Head node', description: 'Integration',
      acceptanceCriteria: [], dependsOn: ['01-mock'], level: 1,
      state: 'pending', retries: 0, totalDispatches: 0,
    },
  },
  levels: [['01-mock'], ['02-head']],
  headNode: '02-head',
  currentLevel: 0,
  issueLabel: `plan:${taskId}`,
  checksum: '',
}, null, 2),
```

**Changes to `taskify.md`:**

Add to the output contract (omit `estimated_nodes` when `decomposition: 'single'`):
```json
{
  "decomposition": "single | parallel",
  "decomposition_reason": "string",
  "estimated_nodes": 4
}
```

Add decomposition assessment rules (same as before — see previous plan Step 2).

**Tests (FAIL before, PASS after):**

1. `tests/unit/scripts/cody/pipeline-utils.test.ts` — **TaskDefinition decomposition fields + output map**
   - `normalizeTask({task_type:'implement_feature', ...})` without decomposition → defaults to `{decomposition:'single', decomposition_reason:'Single coherent task'}`
   - `normalizeTask({..., decomposition:'parallel', decomposition_reason:'Multi-component'})` → preserved
   - `validateTask({..., decomposition:'invalid'})` → validation error
   - `validateTask({..., decomposition:'parallel', estimated_nodes:1})` → validation error (must be >= 2)
   - `validateTask({..., decomposition:'single', decomposition_reason:'Simple task'})` → valid
   - `stageOutputFile(taskDir, 'decompose')` returns `<taskDir>/graph.json`
   - `SPEC_ONLY_STAGES` includes `'decompose'`
   - Existing tests still pass (no regression)

**Acceptance criteria:**
- [ ] `TaskDefinition` has `decomposition`, `decomposition_reason`, `estimated_nodes` fields
- [ ] `normalizeTask()` defaults `decomposition: 'single'` when missing
- [ ] `validateTask()` validates new fields correctly
- [ ] `STAGE_OUTPUT_MAP` has `decompose: 'graph.json'`
- [ ] `SPEC_ONLY_STAGES` includes `'decompose'`
- [ ] `DRY_RUN_OUTPUTS` has `decompose` entry producing valid mock graph JSON
- [ ] `taskify.md` agent prompt includes decomposition assessment
- [ ] Backward compatible: existing task.json without decomposition fields normalizes correctly

---

## Step 3: Add `planId` to CodyInput and Task Directory Resolution

**Time estimate: 20-30 minutes**

**Files to touch:**
- `scripts/cody/cody-utils.ts` (MODIFIED, lines 18-38 `CodyInput`, line 79 `VALID_MODES`, lines 92-94 `validateTaskId`, lines 101-111 `getTaskDir`/`ensureTaskDir`, lines 113-236 ALL status functions, lines 386-585 `parseCliArgs`, lines 586+ `parseCommentBody`)

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
  mode: (typeof VALID_MODES)[number]  // Derived, not manual union (fixes S2)
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
// (in the if/else if chain)
else if (arg === '--plan-id' || arg.startsWith('--plan-id=')) {
  const value = arg.includes('=') ? arg.split('=')[1] : args[++i]
  if (!validatePlanId(value)) throw new Error(`Invalid --plan-id format: ${value}`)
  input.planId = value
}

// parseCommentBody — support /cody plan <planId> (fixes S3):
// In the subcommand parsing:
case 'plan':
  result.mode = 'plan'
  result.planId = args[0] // First arg after 'plan' is the planId
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

## Step 4: Fix Hardcoded Paths in Stage Prompts + Add `decompose` Stage

**Time estimate: 15-20 minutes**

**Files to touch:**
- `scripts/cody/stage-prompts.ts` (MODIFIED, lines 21-22 `SPEC_STAGES`, lines 29-43 `ALL_STAGES`, lines 68-82 `STAGE_CONTEXT_FILES`, lines 93-118 `stageInstructions`, lines 128-142 `getTaskType()`, lines 159-190 `buildStagePrompt()`)
- `scripts/cody/agent-runner.ts` (MODIFIED, `STAGE_TIMEOUTS`)

**Behavior:**
1. Replace hardcoded `.tasks/{TASK_ID}/` paths with dynamic paths
2. Add `decompose` to `ALL_STAGES`, `SPEC_STAGES`, `STAGE_CONTEXT_FILES`, `stageInstructions`
3. Fix `getTaskType()` to use `getTaskDir()` instead of duplicate path construction
4. Pass `planId` to `getTaskType()` AND `stageInstructions` from `buildStagePrompt()`
5. **ALL 13 `stageInstructions` entries get signature `(taskId: string, planId?: string) => string`** (fixes B2)
6. `buildStagePrompt()` calls `instructionFn(taskId, input.planId)` (fixes B3)
7. Add `decompose: 20 * 60_000` to `STAGE_TIMEOUTS` in agent-runner.ts (fixes S14)

**Changes:**

```typescript
// SPEC_STAGES — add 'decompose' (fixes S4):
export const SPEC_STAGES = ['taskify', 'spec', 'gap', 'clarify', 'decompose'] as const

// ALL_STAGES — add 'decompose' after 'clarify':
export const ALL_STAGES = [
  'taskify', 'spec', 'gap', 'clarify',
  'decompose',  // NEW
  'architect', 'plan-review', 'build', 'commit',
  'verify', 'autofix', 'auditor', 'apply-audit', 'pr',
] as const

// STAGE_CONTEXT_FILES — add decompose:
decompose: ['task.md', 'spec.md', 'clarified.md', 'task.json'],

// stageInstructions type — ALL 13 entries updated (fixes B2):
export const stageInstructions: Record<Stage, (taskId: string, planId?: string) => string> = {
  taskify: (taskId, planId?) => {
    const taskDir = planId ? `.tasks/${planId}/${taskId}` : `.tasks/${taskId}`
    return specOnlyInstructionTemplate.replace('{TASK_DIR}', taskDir)
  },
  spec: (taskId, planId?) => { /* same pattern */ },
  gap: (taskId, planId?) => { /* same pattern */ },
  clarify: (taskId, planId?) => { /* same pattern */ },
  decompose: (taskId, planId?) => {
    const taskDir = planId ? `.tasks/${planId}/${taskId}` : `.tasks/${taskId}`
    return specOnlyInstructionTemplate.replace('{TASK_DIR}', taskDir)
  },
  // Non-spec stages: signature updated but body unchanged
  architect: (_taskId, _planId?) => ``,
  'plan-review': (_taskId, _planId?) => ``,
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

// agent-runner.ts — add decompose timeout (fixes S14):
export const STAGE_TIMEOUTS: Record<string, number> = {
  // ... existing entries ...
  decompose: 20 * 60_000,  // 20 minutes — writes multiple files
}
```

**Tests (FAIL before, PASS after):**

1. `tests/unit/scripts/cody/stage-prompts.test.ts` — **Dynamic path in prompts + decompose stage**
   - `buildStagePrompt({taskId:'t1', planId:'260221-x'} as CodyInput, 'build')` includes `.tasks/260221-x/t1` in prompt
   - `buildStagePrompt({taskId:'t1'} as CodyInput, 'build')` includes `.tasks/t1` (backward compat)
   - `buildStagePrompt({taskId:'t1', planId:'260221-x'} as CodyInput, 'decompose')` includes SPEC-ONLY guard with `.tasks/260221-x/t1`
   - `getTaskType('t1', '260221-x')` reads from nested directory
   - `ALL_STAGES` includes `'decompose'`
   - `SPEC_STAGES` includes `'decompose'`
   - `STAGE_CONTEXT_FILES.decompose` is `['task.md', 'spec.md', 'clarified.md', 'task.json']`

**Acceptance criteria:**
- [ ] No duplicate path construction (uses `getTaskDir()`)
- [ ] Agent prompts contain correct nested path when `planId` set
- [ ] `decompose` is in `ALL_STAGES`, `SPEC_STAGES`, `STAGE_CONTEXT_FILES`
- [ ] ALL 13 `stageInstructions` entries accept `(taskId, planId?)`
- [ ] `buildStagePrompt()` passes `planId` to BOTH `getTaskType()` AND `stageInstructions`
- [ ] `STAGE_TIMEOUTS` has `decompose: 20 * 60_000`
- [ ] Backward compatible when `planId` undefined

---

## Step 5: Create Decompose Agent Definition

**Time estimate: 15-20 minutes**

**Files to touch:**
- `.opencode/agents/decompose.md` (NEW, ~120 lines)

**Behavior:**
OpenCode agent prompt for the `decompose` stage. Agent reads spec.md and task.json, produces `graph.json` + per-node task files.

**Agent prompt:**

```markdown
---
name: decompose
description: Decomposes a complex task into a dependency graph of parallel sub-tasks
mode: primary
tools:
  read: true
  write: true
  edit: false
  bash: false
---
```

**NOTE:** `bash: false` — the agent only needs read and write. Minimizes attack surface (L-6 fix).

Prompt content same as previous plan Step 5, with these additions:
- Node count: "3-10 discrete tasks (minimum 2, maximum 15)"
- `totalDispatches: 0` included in GraphNode schema
- Explicit: "Write graph.json to the task directory root — the file watcher watches for this file."

**Tests (FAIL before, PASS after):**

1. `tests/unit/scripts/cody/decompose-agent.test.ts` — **Agent output validation**
   - Given a mock graph.json output, validate it with `validateGraph()`
   - graph.json with valid nodes → passes validation
   - graph.json with cycle → `validateGraph()` returns errors
   - graph.json with `task_type: 'docs'` node → `validatePlanNodeTaskType()` throws
   - graph.json with 16 nodes → `validateGraph()` returns node count error
   - Per-node directories contain required files

**Acceptance criteria:**
- [ ] `.opencode/agents/decompose.md` exists with `bash: false`
- [ ] Prompt specifies output contract (graph.json + per-node files)
- [ ] Node count limits documented (2-15)
- [ ] task_type restrictions documented
- [ ] STOP CONDITION present

---

## Step 6: Update cody.ts — Call Sites, Plan Mode, Decompose Routing, Guards

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
6. **Add decompose routing in spec pipeline** — after gap/clarify, check `task.json.decomposition`
7. When `planId` set: pass plan branch to `ensureFeatureBranch()`
8. **Guard: reject `mode=full` or `mode=spec` when `planId` is set**
9. Add `planId?` to `StageHookOptions`
10. When `planId` set, validate `task_type`
11. **Guard `completeStatus` in `main()`** — don't mark completed if decomposition dispatched CI workflows (fixes S8)

**Key routing change in `runSpecPipeline()` (after line ~453):**

```typescript
// After spec pipeline completes (before committing files):
const taskDef = readTask(taskDir)
if (taskDef?.decomposition === 'parallel') {
  console.log('\n🔀 Task requires decomposition — running decompose stage...')

  // Run decompose agent — output file is graph.json via STAGE_OUTPUT_MAP
  const decomposeOutput = stageOutputFile(taskDir, 'decompose')  // → graph.json
  updateStageStatus(loc, 'decompose', 'running')

  if (input.dryRun) {
    writeDryRunOutput(taskDir, 'decompose', input.taskId)
    updateStageStatus(loc, 'decompose', 'completed', { retries: 0 })
  } else {
    const decomposeResult = await runAgentWithFileWatch(
      input, 'decompose', decomposeOutput, undefined, { backend }
    )

    if (!decomposeResult.succeeded) {
      updateStageStatus(loc, 'decompose', 'failed', { retries: decomposeResult.retries })
      throw new Error('Decompose stage failed')
    }
    updateStageStatus(loc, 'decompose', 'completed', {
      retries: decomposeResult.retries,
      outputFile: path.basename(decomposeOutput),
    })
  }

  // Validate graph.json
  if (!fs.existsSync(decomposeOutput)) {
    throw new Error('Decompose agent did not produce graph.json')
  }
  const { readGraph, validateGraph, validatePlanNodeTaskType } = await import('./graph')
  const graph = readGraph(taskDir)
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
  // NOTE: pass baseBranch for plan branch (fixes S12)
  const { getPlanBranch } = await import('./graph')
  commitPipelineFiles({
    taskDir,
    taskId: input.taskId,
    message: `ci(cody): decompose ${input.taskId} into ${Object.keys(graph.nodes).length} nodes`,
    ensureBranch: true,
    cleanDirtyState: true,
    stagingStrategy: 'task-only',
    push: true,
    isCI: !input.local,
    dryRun: input.dryRun,
    baseBranch: getPlanBranch(input.taskId),  // Branch from plan branch
  })

  console.log('\n🚀 Decomposition complete. Launching plan orchestrator...')

  // Launch plan orchestrator (planId = taskId for root task)
  const { executePlan } = await import('./plan-orchestrator')
  await executePlan(input.taskId, {
    local: input.local ?? false,
    dryRun: input.dryRun,
    pollInterval: 30,
    levelTimeout: 120,
    maxRetries: 2,
  })

  // Mark status as 'running' not 'completed' — plan nodes still executing (fixes S8)
  // main() will skip completeStatus for decomposed tasks
  return 'decomposed'  // Signal to caller
}
```

**`main()` guard (fixes S8):**

```typescript
// In main(), after pipeline returns:
const result = await runSpecPipeline(input, status, backend)
if (result === 'decomposed') {
  // Don't mark completed — plan orchestrator is still running
  console.log('\n🔀 Plan dispatched — monitoring via plan orchestrator')
  return
}
completeStatus(loc, 'completed')
```

**`ensureFeatureBranch` with plan branch + BASE_BRANCHES fix (cody.ts, in runSingleStage):**

```typescript
if (stage === 'build' && !input.dryRun) {
  const td = readTask(taskDir)
  if (td) {
    if (input.planId) {
      const { getPlanBranch } = await import('./graph')
      ensureFeatureBranch(input.taskId, td.task_type, undefined, getPlanBranch(input.planId))
    } else {
      ensureFeatureBranch(input.taskId, td.task_type)
    }
  }
}
```

**Tests (FAIL before, PASS after):**

1. `tests/unit/scripts/cody/cody-plan-mode.test.ts` — **Plan mode routing + guards + decompose routing**
   - `parseCliArgs(['--mode', 'plan', '--plan-id', '260221-test'])` → mode === 'plan', planId set
   - Plan mode with `--mode=full --plan-id=X` throws guard error
   - Plan mode with `--mode=spec --plan-id=X` throws guard error
   - Plan mode with `--mode=impl --plan-id=X` allowed
   - When task.json has `decomposition: 'parallel'`, spec pipeline runs decompose stage (mock agent), returns `'decomposed'`
   - When task.json has `decomposition: 'single'`, spec pipeline does NOT run decompose
   - `main()` does NOT call `completeStatus('completed')` when pipeline returns `'decomposed'`
   - `commitPipelineFiles` called with `baseBranch: getPlanBranch(taskId)` in decompose routing

**Acceptance criteria:**
- [ ] All 5 `ensureTaskDir` call sites pass `input.planId`
- [ ] All ~29 status call sites in cody.ts use `TaskLocation`
- [ ] `StageHookOptions` has `planId?` field
- [ ] `plan` mode routable
- [ ] Guard rejects `mode=full/spec` when `planId` set
- [ ] Decompose routing: `decomposition === 'parallel'` → run decompose → validate graph → commit with plan baseBranch → launch orchestrator → return `'decomposed'`
- [ ] `main()` skips `completeStatus('completed')` when decomposed
- [ ] Feature branches for plan tasks branch from `getPlanBranch(planId)`
- [ ] `commitPipelineFiles` in decompose routing passes `baseBranch`

---

## Step 7: Support Branching from Plan Branch in git-utils

**Time estimate: 20-25 minutes**

**Files to touch:**
- `scripts/cody/git-utils.ts` (MODIFIED, lines 57 `BASE_BRANCHES` check, lines 105-280, lines 366+ `commitAndPush`, lines 534+ `commitPipelineFiles`)

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
  // ...
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

// commitPipelineFiles — forward baseBranch:
export function commitPipelineFiles(options: CommitPipelineFilesOptions): ... {
  return commitAndPush({ ..., baseBranch: options.baseBranch })
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

## Step 8: PR Target Branch for Plan Tasks

**Time estimate: 15-20 minutes**

**Files to touch:**
- `scripts/cody/scripted-stages.ts` (MODIFIED, `runPrStage`, `runCommitStage`, `getExistingPr`)

**Behavior:**
Refactor scripted stage signatures to use options object (fixes S10). PR targets plan branch when `planId` set. `getExistingPr` filters by `--base`.

**Changes:**

```typescript
import type { TaskLocation } from './cody-utils'
import { getPlanBranch } from './graph'

// runPrStage — refactored to options object (fixes S10):
export function runPrStage(
  taskDir: string,
  outputFile: string,
  options?: { cwd?: string; loc?: TaskLocation }
): { url: string | null } {
  const projectDir = options?.cwd || process.cwd()
  let baseBranch = getDefaultBranch(projectDir)
  if (options?.loc?.planId) {
    baseBranch = getPlanBranch(options.loc.planId)  // Deterministic
  }
  const existingPr = getExistingPr(featureBranch, projectDir, baseBranch)
  // gh pr create --base ${baseBranch} ...
}

// getExistingPr — add baseBranch filter:
function getExistingPr(branch: string, cwd: string, baseBranch?: string): string | null {
  const args = ['pr', 'list', '--head', branch, '--json', 'number,state,url']
  if (baseBranch) args.push('--base', baseBranch)
  // ...
}

// runCommitStage — refactored to options object:
export function runCommitStage(
  taskDir: string,
  outputFile: string,
  options?: { cwd?: string; loc?: TaskLocation }
): { success: boolean; message: string; committed?: boolean } {
  const taskId = options?.loc?.taskId || path.basename(taskDir)
  if (!taskId) throw new Error('Cannot derive taskId from taskDir')  // L-5 fix
  // ...
}
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

## Step 9: Plan Orchestrator — Core Execution Logic

**Time estimate: 30-40 minutes**

**Files to touch:**
- `scripts/cody/plan-orchestrator.ts` (NEW, ~550 lines)
- `.gitignore` (MODIFIED, add `.worktrees/`)

**Behavior:**
Main orchestration with two entry points: `executePlan()` (full run) and `advancePlan()` (single-level advancement from CI). Uses deterministic branch derivation, explicit PR merge after checks, git worktrees for local mode, symlink protection.

Same as previous plan Step 9 with these additions from audit findings:

- **Graph integrity verified BEFORE any dispatch** (H4 fix) — `readGraph()` verifies checksum, then `dispatchLevel()` validates task_ids against verified graph before calling `gh workflow run`
- **`sanitizeForGitHub()` strips GitHub Actions commands** (H6 fix) — `::set-output`, `::add-mask`, etc. Also escapes `%0A`/`%0D`
- **`MAX_POLLS_PER_LEVEL = 500`** and **`--poll-interval >= 15` minimum** enforced (M2 fix)
- **`totalDispatches` counter** per node, enforced `MAX_TOTAL_DISPATCHES = 5` across plan restarts (M3 fix)
- **`advancePlan()` uses `throw` for errors, `return` for graceful exit** — no `process.exit()` (M8 fix)
- **Worktree security**: check `.worktrees/`, `.worktrees/<planId>/` for symlinks at each path component (H2 fix)
- **`advancePlan()` also validates actor permissions** for dispatch trigger (H3 — implemented in plan.yml, not in TypeScript)

```typescript
// sanitizeForGitHub — expanded (H6 fix):
function sanitizeForGitHub(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')                                    // Strip HTML tags
    .replace(/@(\w)/g, '`@`$1')                                 // Prevent @mentions
    .replace(/#(\d+)/g, '`#$1`')                                // Prevent false issue refs
    .replace(/!\[/g, '\\![')                                    // Prevent image injection
    .replace(/\[([^\]]*)\]\(https?:\/\/[^)]*\)/g, '$1')        // Strip markdown links
    .replace(/^::[a-zA-Z-]+.*$/gm, '')                          // Strip GH Actions commands
    .replace(/%0[aAdD]/g, '')                                   // Escape URL-encoded newlines
}

// dispatchLevel — verify graph integrity + validate task_ids (H4 fix):
async function dispatchLevel(graph, level, planId, options): Promise<void> {
  // Verify integrity BEFORE dispatch
  if (!verifyChecksum(graph)) throw new PlanIntegrityError('Graph tampered before dispatch')

  const nodes = getNodesAtLevel(graph, level)
  for (const node of nodes) {
    // Validate task_id is in verified graph (H4)
    if (!graph.nodes[node.taskId]) throw new Error(`Unknown task_id: ${node.taskId}`)

    // Check totalDispatches limit (M3)
    if (node.totalDispatches >= MAX_TOTAL_DISPATCHES) {
      updateNodeState(graph, node.taskId, 'failed')
      node.error = `Exceeded max total dispatches (${MAX_TOTAL_DISPATCHES})`
      continue
    }
    node.totalDispatches++

    // ... dispatch logic
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
```

**Tests (FAIL before, PASS after):**

1. `tests/unit/scripts/cody/plan-orchestrator.test.ts` — **Level dispatch, completion, merge, security**
   - All previous tests plus:
   - `dispatchLevel()` verifies checksum before dispatching any nodes
   - `dispatchLevel()` rejects task_id not in verified graph
   - `dispatchLevel()` skips node when `totalDispatches >= MAX_TOTAL_DISPATCHES`
   - `waitForLevelCompletion()` rejects `pollInterval < 15`
   - `waitForLevelCompletion()` fails after `MAX_POLLS_PER_LEVEL = 500` polls
   - `sanitizeForGitHub('::set-output name=foo::bar')` → empty string
   - `sanitizeForGitHub('test%0Ainjection')` → `'testinjection'`
   - Worktree symlink check at each path component (`.worktrees/`, `.worktrees/<planId>/`)

**Acceptance criteria:**
- All previous acceptance criteria plus:
- [ ] Graph integrity verified BEFORE any dispatch
- [ ] Dispatched task_ids validated against verified graph
- [ ] `totalDispatches` per node enforced (max 5)
- [ ] `--poll-interval >= 15` enforced
- [ ] `MAX_POLLS_PER_LEVEL = 500` enforced
- [ ] `sanitizeForGitHub()` strips GH Actions commands and URL-encoded newlines
- [ ] Worktree symlink check at each path component

---

## Step 10: GitHub Actions Workflows

**Time estimate: 20-30 minutes**

**Files to touch:**
- `.github/workflows/plan.yml` (NEW, ~160 lines)
- `.github/workflows/cody.yml` (MODIFIED)
- `scripts/cody/run-cody.sh` (MODIFIED)
- `scripts/cody/parse-inputs.sh` (MODIFIED)
- `scripts/cody/parse-plan-safety.sh` (NEW, ~40 lines)
- `scripts/cody/checkout-task-branch.sh` (MODIFIED)

**Behavior:**
Same as previous plan Step 10, with security fixes:

### parse-inputs.sh — Add TASK_ID validation (C4 fix)

```bash
# BEFORE writing to GITHUB_OUTPUT, validate format:
if [ -n "$DISPATCH_TASK_ID" ]; then
  if ! [[ "$DISPATCH_TASK_ID" =~ ^[0-9]{6}-[a-zA-Z0-9-]+$ ]]; then
    echo "=== Error: invalid task_id format: $DISPATCH_TASK_ID ==="
    echo "valid=false" >> "$GITHUB_OUTPUT"
    exit 0
  fi
fi
```

### parse-plan-safety.sh — Fix actor source + validate username (C5 fix)

```bash
#!/usr/bin/env bash
set -euo pipefail

# Validate username format (defense against injection)
if ! [[ "$ACTOR" =~ ^[a-zA-Z0-9-]+$ ]]; then
  echo "=== Safety: invalid actor username format ==="
  echo "valid=false" >> "$GITHUB_OUTPUT"
  exit 0
fi

# Use gh api with proper argument separation (no string interpolation)
PERMISSION=$(gh api \
  "repos/${GITHUB_REPOSITORY}/collaborators/${ACTOR}/permission" \
  --jq '.permission' 2>/dev/null || echo "none")

if [[ "$PERMISSION" == "admin" || "$PERMISSION" == "maintain" || "$PERMISSION" == "write" ]]; then
  echo "valid=true" >> "$GITHUB_OUTPUT"
else
  echo "=== Safety: actor $ACTOR has permission '$PERMISSION', need write or above ==="
  echo "valid=false" >> "$GITHUB_OUTPUT"
fi
```

### plan.yml — Validate actor for BOTH triggers (H3 fix)

```yaml
# Resolve job validates actor for BOTH dispatch and PR-close:
- name: Validate actor permissions
  # Runs for ALL event types (not just pull_request)
  id: safety
  env:
    GH_TOKEN: ${{ github.token }}
    ACTOR: ${{ github.event_name == 'pull_request' && github.event.sender.login || github.actor }}
    GITHUB_REPOSITORY: ${{ github.repository }}
  run: ./scripts/cody/parse-plan-safety.sh
```

### checkout-task-branch.sh — Add TASK_ID validation + quote all (L-2, M-4 fixes)

```bash
# Add at top:
if ! [[ "$TASK_ID" =~ ^[0-9]{6}-[a-zA-Z0-9-]+$ ]]; then
  echo "=== Error: invalid TASK_ID format ==="
  exit 1
fi

# Quote all variable expansions:
git merge "origin/${MERGE_BASE}" --no-edit
```

**Tests and acceptance criteria:** Same as previous plan Step 10, plus:
- [ ] `parse-inputs.sh` validates TASK_ID format with bash regex BEFORE writing to GITHUB_OUTPUT
- [ ] `parse-plan-safety.sh` validates actor username format
- [ ] `plan.yml` validates actor permissions for BOTH dispatch and PR-close triggers
- [ ] `checkout-task-branch.sh` validates TASK_ID at top of script

---

## Step 11: Plan Decomposition Skill + Slash Command (Manual Override)

**Time estimate: 10-15 minutes**

Same as previous plan Step 11. No changes from gap/security analysis.

**Files to touch:**
- `.agents/skills/plan-decomposition/SKILL.md` (NEW)
- `.claude/commands/plan-decomposition.md` (NEW)

---

## Step 12: Update OpenCode Agent Prompts

**Time estimate: 10-15 minutes**

**Files to touch (narrowed to agents with actual hardcoded paths — fixes S13):**
- `.opencode/agents/taskify.md` (MODIFIED — line 20)
- `.opencode/agents/gap.md` (MODIFIED — line 122)
- `.opencode/agents/verify.md` (MODIFIED — line 28)
- `.opencode/agents/architect.md` (MODIFIED — line 16)
- `.opencode/agents/spec.md` (MODIFIED — lines 17, 57)

**Change pattern:**
```
Before: Only read from and write to the .tasks/{TASK_ID}/ directory.
After:  Only read from and write to the task directory specified in the prompt below.
```

**Acceptance criteria:**
- [ ] Zero hardcoded `.tasks/` path references in the 5 agents above
- [ ] Other agents verified to have no hardcoded paths (no changes needed)

---

## Step 13: Package.json Scripts

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

**NOTE:** No `pnpm generate:importmap` needed — OpenCode agents don't use Payload import maps (M6 fix).

**Acceptance criteria:**
- [ ] `pnpm plan:execute --plan-id=<id>` runs orchestrator
- [ ] `pnpm plan:status --plan-id=<id>` shows state

---

## Implementation Order (Dependency Graph)

```
Step 0 (execSync migration) ←── PREREQUISITE FOR ALL
                                    │
Step 1 (graph.ts) ──────────────────┤
Step 2 (TaskDefinition + taskify) ──┤
Step 7 (git-utils baseBranch) ──────┤
                                    │
Step 3 (cody-utils planId) ←── Step 0 (clean execFileSync base)
Step 4 (stage-prompts+decompose) ←── Step 3
Step 5 (decompose agent) ←── Step 1 (graph schema knowledge)
                                    │
Step 6 (cody.ts routing) ←── Steps 2,3,4,5
Step 8 (PR target) ←── Steps 1,3,7
                                    │
Step 9 (plan-orchestrator) ←── Steps 1,3,6,7,8
Step 10 (GH Actions+shell) ←── Step 9
Step 11 (Skill+slash cmd) ←── Step 9
Step 12 (Agent prompts) ←── Step 4
Step 13 (package.json) ←── Step 9
```

**Parallelizable groups:**
- **Step 0** FIRST (prerequisite)
- **Group A** (after Step 0, no mutual deps): Steps 1, 2, 7
- **Group B** (dep on Step 0 + Step 1): Steps 3, 5
- **Group C** (dep on Steps 2,3): Steps 4, 12
- **Group D** (dep on all above): Steps 6, 8
- **Group E** (dep on D): Step 9
- **Group F** (dep on Step 9): Steps 10, 11, 13

---

## Edge Cases

| Case | Handling |
|------|----------|
| Task with `decomposition: 'single'` | Existing pipeline, zero change |
| Task with `decomposition: 'parallel'` but only 2 nodes | Valid (MIN_PLAN_NODES=2) |
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
| Missing graph.json | `PlanNotFoundError` with hint |
| GitHub rate limit | Catch error, double poll interval, retry |
| Excessive polling | `MAX_POLLS_PER_LEVEL = 500`, `pollInterval >= 15` |
| Node dispatched too many times | `totalDispatches >= MAX_TOTAL_DISPATCHES (5)` → mark failed |
| GH Actions command injection in issue body | `sanitizeForGitHub()` strips `::command::` patterns |
| `/cody plan 260221-auth` via issue comment | `parseCommentBody()` supports `plan` subcommand |
| Decompose output file mismatch | `STAGE_OUTPUT_MAP` has `decompose: 'graph.json'` |
| Dry-run with decomposition | `DRY_RUN_OUTPUTS` has mock graph JSON |

---

## Assumptions

1. `dev` is the default branch
2. `gh` CLI authenticated in both local and CI
3. OpenCode runs in GitHub Actions
4. All plan nodes use `impl` mode (spec pre-computed), starting from `build` stage
5. PR merge to plan branch = completion signal
6. Max plan size: 15 nodes, ~5 levels
7. Each Cody node: ~30-45 minutes
8. Branch protection on `plan/**` is configured (REQUIRED prerequisite)
9. "Automatically delete head branches" enabled in repo settings
10. `opencode` is the default agent (not Claude Code)
11. `json-stable-stringify` or equivalent available (or use sorted-key JSON.stringify)
