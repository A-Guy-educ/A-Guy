th# Cody Pipeline: State Machine Rewrite Plan

**Date**: 2026-02-23
**Status**: Draft — awaiting approval before implementation

---

## Problem Statement

The Cody pipeline has ~3,500 lines of TypeScript across 12 modules, with **implicit state transitions** that cause recurring bugs. The control flow in `cody.ts` mixes pipeline definition, execution, state management, side effects (git, GitHub API), and error handling into a single 1,156-line file. Bugs arise because:
formal

1. **State is tracked in 4 places simultaneously** (loop index, `stages[]` array, output file existence, `status.json`)
2. **Post-stage logic is scattered** across `cody.ts`, `stage-hooks.ts`, and `scripted-stages.ts`
3. **The autofix loop, gate checks, and clarification workflow are nested inline**
4. **Resumability is file-existence-based**, not state-based

### Current Architecture (Implicit State Machine)

```
main()
  → runSpecPipeline()
      → for stage in dynamically-growing-stages-array:
          → if skip conditions (5+ different reasons)
          → runAgentWithFileWatch() or dry-run
          → inline post-taskify validation + gate check + pipeline profile resolution
          → inline push remaining stages into the array we're iterating
      → inline clarification workflow
      → inline commitPipelineFiles

  → runImplPipeline()
      → for stage in pipeline:
          → runSingleStage() (200+ line closure)
              → if skip conditions (4+ different reasons)
              → if scripted: runVerifyStage/runCommitStage/runPrStage
              → if agent: runAgentWithFileWatch
              → inline post-stage hooks (different per stage):
                  - architect: feedback archive + gate check + commit
                  - plan-gap: validation
                  - build: validation + tsc + tests
                  - verify: handleVerifyResult + autofix loop (nested 50-line loop) + commit
                  - apply-audit: commit
```

### Root Causes of Bugs

| Pattern                                           | Why It Causes Bugs                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Stage logic split across 3-5 files                | When something breaks, trace through `cody.ts`, `stage-hooks.ts`, `scripted-stages.ts`, `agent-runner.ts`, `git-utils.ts` |
| Implicit state transitions                        | `for` loop index, growing `stages` array, `skipStages` cache, and `status.json` can drift                                 |
| Side effects interleaved with control flow        | Git commit after verify passes can fail, leaving inconsistent state                                                       |
| Autofix is a state machine inside a state machine | Own retry count, file deletion, status updates, commit step — all nested                                                  |
| No separation of "what to do" vs "how to do it"   | Pipeline definition and execution engine are tangled                                                                      |

---

## Design Decisions

| Decision         | Choice                                | Rationale                                                   |
| ---------------- | ------------------------------------- | ----------------------------------------------------------- |
| Redesign scope   | Full state machine rewrite            | Maximum stability, clean architecture                       |
| Resumability     | `status.json` is the single authority | No guessing from file existence                             |
| Autofix modeling | Internal retry in verify handler      | Simpler status.json, autofix isn't a visible pipeline stage |
| Status schema    | Clean break, v2 schema                | No backward-compat complexity; in-flight tasks restart      |
| Shell scripts    | Consolidate into TypeScript           | Fewer moving parts; YAML calls `pnpm cody` directly         |
| Testing          | Rewrite tests alongside engine        | Cleaner result; existing ~853 tests guide coverage          |

---

## Design Principles

1. **Single source of truth**: `status.json` is the only authority on pipeline state
2. **Separation of concerns**: Pipeline definition (what) vs. engine (when) vs. handlers (how)
3. **Every stage is a pure function**: `(context) → StageResult`
4. **Transitions are explicit and testable**: No implicit skips from file existence
5. **Side effects are declared, not inline**: Git commits, GitHub comments happen at well-defined points

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Pipeline Definition (pure data)                        │
│  - Stage graph (order, parallelism, dependencies)       │
│  - Stage configs (timeout, retries, type, validator)    │
│  - Skip conditions (pure functions)                     │
│  - Gate conditions (pure functions)                     │
│  - Post-stage actions (declared, not inline)            │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  State Machine Engine (generic)                         │
│  - Reads pipeline definition                            │
│  - Reads current state from status.json                 │
│  - Computes: "what is the next transition?"             │
│  - Executes transition via typed handlers               │
│  - Writes new state atomically                          │
│  - Handles: resume, rerun, pause, fail                  │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Stage Handlers (one per stage type)                    │
│  - AgentHandler: spawn, poll, validate, retry           │
│  - ScriptedHandler: tsc, lint, tests + internal autofix │
│  - GitHandler: branch, commit, push, PR                 │
│  - GateHandler: check approval, pause                   │
│  Each returns: StageResult (success|fail|pause|retry)   │
└─────────────────────────────────────────────────────────┘
```

---

## New File Structure

```
scripts/cody/
├── engine/
│   ├── state-machine.ts      # Core engine: read state → compute next → execute → write state
│   ├── types.ts               # All types: PipelineState, StageResult, Transition, etc.
│   ├── pipeline-resolver.ts   # Pure functions: mode + task.json → ordered stage list
│   └── status.ts              # status.json v2 read/write with schema validation
│
├── handlers/
│   ├── handler.ts             # StageHandler interface + registry
│   ├── agent-handler.ts       # Handles agent stages (spawn, poll, validate, retry)
│   ├── scripted-handler.ts    # Handles verify (tsc/lint/format/tests + internal autofix)
│   ├── git-handler.ts         # Handles commit + PR stages
│   └── gate-handler.ts        # Handles gate checks (pause/approve/reject)
│
├── pipeline/
│   ├── definitions.ts         # Declarative stage configs (timeout, retries, validator, type)
│   ├── skip-conditions.ts     # Pure functions: should this stage be skipped?
│   └── post-actions.ts        # Declared post-stage actions (commit, validate, archive)
│
├── entry.ts                   # CLI entry point (replaces cody.ts main + parseCliArgs)
├── parse-safety.ts            # Port of parse-safety.sh + parse-safety-supervisor.sh
├── parse-inputs.ts            # Port of parse-inputs.sh
│
│  # Kept as-is (reused by handlers):
├── agent-runner.ts            # Spawn + file-watch logic (used by agent-handler)
├── runner-backend.ts          # LocalRunner / GitHubRunner
├── stage-prompts.ts           # Prompt construction
├── content-validators.ts      # Pure validation functions
├── git-utils.ts               # Branch/commit/push operations
├── clarify-workflow.ts        # Clarification logic (used by gate-handler)
├── audit-history.ts           # Audit tracking
├── logger.ts                  # Structured logging
└── preflight.ts               # Local mode pre-checks
```

---

## Core Types (`engine/types.ts`)

```typescript
/** Stage execution type */
type StageType = 'agent' | 'scripted' | 'git' | 'gate'

/** Result of executing a single stage */
type StageOutcome = 'completed' | 'failed' | 'paused' | 'timed_out' | 'skipped'

interface StageResult {
  outcome: StageOutcome
  reason?: string
  retries: number
  outputFile?: string
}

/** A stage definition (pure data) */
interface StageDefinition {
  name: string
  type: StageType
  timeout: number
  maxRetries: number
  shouldSkip?: (ctx: PipelineContext) => SkipResult
  validator?: (outputFile: string) => ValidationResult
  postActions?: PostAction[]
  advisory?: boolean // failure doesn't block pipeline
}

/** Pipeline definition: ordered stages with parallel groups */
type PipelineStep = string | { parallel: string[] }

interface PipelineDefinition {
  stages: Map<string, StageDefinition>
  order: PipelineStep[]
}

/** Runtime context passed to handlers and skip conditions */
interface PipelineContext {
  taskId: string
  taskDir: string
  input: CodyInput
  taskDef: TaskDefinition | null
  profile: 'lightweight' | 'standard'
  controlMode: ControlMode
  backend: RunnerBackend
}

/** status.json v2 schema */
interface PipelineStateV2 {
  version: 2
  taskId: string
  mode: string
  profile: 'lightweight' | 'standard'
  controlMode: ControlMode
  state: 'running' | 'completed' | 'failed' | 'paused'
  cursor: string | null // which stage to execute next
  stages: Record<
    string,
    {
      state: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'paused'
      startedAt?: string
      completedAt?: string
      elapsed?: number
      retries: number
      skipReason?: string
      error?: string
      outputFile?: string
    }
  >
  startedAt: string
  updatedAt: string
  completedAt?: string
  totalElapsed?: number
  triggeredBy: string
  issueNumber?: number
  runId?: string
  runUrl?: string
}
```

---

## Engine Core (`engine/state-machine.ts`)

The engine is a deterministic loop. It never knows about specific stage names.

```typescript
async function runPipeline(ctx: PipelineContext, pipeline: PipelineDefinition): Promise<void> {
  let state = loadOrInitState(ctx)

  while (true) {
    // 1. Compute next step from state + pipeline order
    const next = resolveNextStep(state, pipeline)
    if (!next) break // All steps done

    // 2. Execute step (single stage or parallel group)
    if (next.type === 'parallel') {
      state = await executeParallelStep(ctx, pipeline, state, next.stages)
    } else {
      state = await executeSingleStep(ctx, pipeline, state, next.stage)
    }

    // 3. Persist state atomically
    writeState(ctx.taskId, state)

    // 4. Check if pipeline should stop
    if (state.state === 'failed' || state.state === 'paused') break
  }
}

async function executeSingleStep(
  ctx: PipelineContext,
  pipeline: PipelineDefinition,
  state: PipelineStateV2,
  stageName: string,
): Promise<PipelineStateV2> {
  const def = pipeline.stages.get(stageName)!

  // Check skip conditions
  const skip = def.shouldSkip?.(ctx)
  if (skip?.shouldSkip) {
    return updateStage(state, stageName, { state: 'skipped', skipReason: skip.reason })
  }

  // Already completed (from previous run)?
  if (state.stages[stageName]?.state === 'completed') {
    return advanceCursor(state, pipeline)
  }

  // Mark running + persist
  state = updateStage(state, stageName, { state: 'running' })
  writeState(ctx.taskId, state)

  // Get handler and execute
  const handler = getHandler(def.type)
  const result = await handler.execute(ctx, def)

  // Update state from result
  state = updateStage(state, stageName, {
    state:
      result.outcome === 'completed'
        ? 'completed'
        : result.outcome === 'paused'
          ? 'paused'
          : 'failed',
    retries: result.retries,
    error: result.reason,
    outputFile: result.outputFile,
  })

  // Run post-actions on success
  if (result.outcome === 'completed' && def.postActions) {
    for (const action of def.postActions) {
      await executePostAction(ctx, action, state)
    }
  }

  // Handle pipeline-level state changes
  if (result.outcome === 'paused') {
    state.state = 'paused'
  } else if (result.outcome === 'failed' && !def.advisory) {
    state.state = 'failed'
  }

  return advanceCursor(state, pipeline)
}
```

### Rerun / Resume

```typescript
function resolveNextStep(state: PipelineStateV2, pipeline: PipelineDefinition): NextStep | null {
  for (const step of pipeline.order) {
    const names = typeof step === 'string' ? [step] : step.parallel

    for (const name of names) {
      const stageState = state.stages[name]

      // Not started, failed, or crashed mid-run → execute this step
      if (
        !stageState ||
        stageState.state === 'pending' ||
        stageState.state === 'failed' ||
        stageState.state === 'running'
      ) {
        return typeof step === 'string'
          ? { type: 'single', stage: name }
          : { type: 'parallel', stages: names }
      }

      // Completed or skipped → continue to next
    }
  }

  return null // All done
}

// For rerun mode: reset stages from fromStage onwards to pending
function resetFromStage(
  state: PipelineStateV2,
  fromStage: string,
  pipeline: PipelineDefinition,
): PipelineStateV2 {
  let found = false
  for (const step of pipeline.order) {
    const names = typeof step === 'string' ? [step] : step.parallel
    for (const name of names) {
      if (name === fromStage) found = true
      if (found && state.stages[name]) {
        state.stages[name].state = 'pending'
      }
    }
  }
  state.state = 'running'
  return state
}
```

---

## Handler Interface (`handlers/handler.ts`)

```typescript
interface StageHandler {
  execute(ctx: PipelineContext, def: StageDefinition): Promise<StageResult>
}

// Registry
const handlers: Record<StageType, StageHandler> = {
  agent: new AgentHandler(),
  scripted: new ScriptedVerifyHandler(),
  git: new GitHandler(),
  gate: new GateHandler(),
}

function getHandler(type: StageType): StageHandler {
  return handlers[type]
}
```

### Agent Handler (`handlers/agent-handler.ts`)

Wraps existing `agent-runner.ts`:

```typescript
class AgentHandler implements StageHandler {
  async execute(ctx: PipelineContext, def: StageDefinition): Promise<StageResult> {
    const outputFile = stageOutputFile(ctx.taskDir, def.name)

    const result = await runAgentWithFileWatch(ctx.input, def.name, outputFile, def.timeout, {
      maxRetries: def.maxRetries,
      backend: ctx.backend,
      validateOutput: def.validator,
    })

    return {
      outcome: result.succeeded ? 'completed' : result.timedOut ? 'timed_out' : 'failed',
      retries: result.retries,
      outputFile: result.succeeded ? outputFile : undefined,
      reason: result.timedOut ? 'timeout' : result.validationErrors?.join('; '),
    }
  }
}
```

### Scripted Verify Handler (`handlers/scripted-handler.ts`)

Wraps existing `scripted-stages.ts` + internal autofix loop:

```typescript
class ScriptedVerifyHandler implements StageHandler {
  private readonly MAX_AUTOFIX = 2

  async execute(ctx: PipelineContext, def: StageDefinition): Promise<StageResult> {
    const outputFile = stageOutputFile(ctx.taskDir, 'verify')

    // Run verification
    const result = runVerifyStage(outputFile, process.cwd(), def.timeout)
    if (result.passed) {
      return { outcome: 'completed', retries: 0, outputFile }
    }

    // Internal autofix loop (not visible to engine)
    for (let attempt = 0; attempt < this.MAX_AUTOFIX; attempt++) {
      const autofixOutput = stageOutputFile(ctx.taskDir, 'autofix')
      const autofixResult = await runAgentWithFileWatch(
        ctx.input,
        'autofix',
        autofixOutput,
        5 * 60_000,
        { maxRetries: 0, backend: ctx.backend },
      )

      if (!autofixResult.succeeded) continue

      // Re-verify
      const retryResult = runVerifyStage(outputFile, process.cwd(), def.timeout)
      if (retryResult.passed) {
        return { outcome: 'completed', retries: attempt + 1, outputFile }
      }
    }

    return { outcome: 'failed', retries: this.MAX_AUTOFIX, reason: 'Autofix exhausted' }
  }
}
```

### Git Handler (`handlers/git-handler.ts`)

Wraps existing `scripted-stages.ts` commit/PR:

```typescript
class GitCommitHandler implements StageHandler {
  async execute(ctx: PipelineContext, def: StageDefinition): Promise<StageResult> {
    const outputFile = stageOutputFile(ctx.taskDir, 'commit')
    const result = runCommitStage(ctx.taskDir, outputFile)
    return {
      outcome: result.success || result.message.includes('No changes') ? 'completed' : 'failed',
      retries: 0,
      outputFile,
      reason: result.success ? undefined : result.message,
    }
  }
}

class GitPrHandler implements StageHandler {
  async execute(ctx: PipelineContext, def: StageDefinition): Promise<StageResult> {
    const outputFile = stageOutputFile(ctx.taskDir, 'pr')
    const result = runPrStage(ctx.taskDir, outputFile, process.cwd(), ctx.input.issueNumber)
    return {
      outcome: result.created || result.url ? 'completed' : 'failed',
      retries: 0,
      outputFile,
      reason: result.url ? undefined : result.report,
    }
  }
}
```

### Gate Handler (`handlers/gate-handler.ts`)

Wraps existing `clarify-workflow.ts`:

```typescript
class GateHandler implements StageHandler {
  async execute(ctx: PipelineContext, def: StageDefinition): Promise<StageResult> {
    const gatePoint = def.name

    const result = handleGateApproval(ctx.input, ctx.taskDir, gatePoint, ctx.taskDef!)

    switch (result) {
      case 'approved':
        return { outcome: 'completed', retries: 0 }
      case 'rejected':
        return { outcome: 'failed', retries: 0, reason: 'Gate rejected' }
      case 'waiting':
        return { outcome: 'paused', retries: 0, reason: 'Awaiting approval' }
    }
  }
}
```

---

## Pipeline Definitions (`pipeline/definitions.ts`)

Declarative stage configuration. All behavior is data, not control flow.

```typescript
function buildStageDefinitions(): Map<string, StageDefinition> {
  const stages = new Map<string, StageDefinition>()

  stages.set('taskify', {
    name: 'taskify',
    type: 'agent',
    timeout: 10 * 60_000,
    maxRetries: 2,
    postActions: [
      { type: 'validate-task-json' },
      { type: 'resolve-profile' },
      { type: 'check-gate', gate: 'taskify' },
      { type: 'commit-task-files' },
    ],
  })

  stages.set('spec', {
    name: 'spec',
    type: 'agent',
    timeout: 10 * 60_000,
    maxRetries: 2,
    validator: validateSpecContent,
    shouldSkip: skipIfInputQuality,
  })

  stages.set('gap', {
    name: 'gap',
    type: 'agent',
    timeout: 15 * 60_000,
    maxRetries: 2,
    validator: validateGapReport,
  })

  stages.set('clarify', {
    name: 'clarify',
    type: 'agent',
    timeout: 5 * 60_000,
    maxRetries: 0,
    shouldSkip: skipIfClarifyDisabled,
  })

  stages.set('architect', {
    name: 'architect',
    type: 'agent',
    timeout: 30 * 60_000,
    maxRetries: 2,
    postActions: [{ type: 'archive-rerun-feedback' }, { type: 'check-gate', gate: 'architect' }],
  })

  stages.set('plan-gap', {
    name: 'plan-gap',
    type: 'agent',
    timeout: 15 * 60_000,
    maxRetries: 2,
    validator: validateGapReport,
    postActions: [{ type: 'validate-plan-exists' }],
  })

  stages.set('build', {
    name: 'build',
    type: 'agent',
    timeout: 45 * 60_000,
    maxRetries: 2,
    validator: validateBuildReport,
    postActions: [
      { type: 'validate-build-content' },
      { type: 'run-tsc' },
      { type: 'run-unit-tests' },
    ],
  })

  stages.set('commit', {
    name: 'commit',
    type: 'git',
    timeout: 2 * 60_000,
    maxRetries: 0,
  })

  stages.set('verify', {
    name: 'verify',
    type: 'scripted',
    timeout: 10 * 60_000,
    maxRetries: 0,
    postActions: [{ type: 'commit-task-files' }],
  })

  stages.set('auditor', {
    name: 'auditor',
    type: 'agent',
    timeout: 5 * 60_000,
    maxRetries: 2,
    advisory: true,
  })

  stages.set('apply-audit', {
    name: 'apply-audit',
    type: 'agent',
    timeout: 5 * 60_000,
    maxRetries: 2,
    shouldSkip: skipIfNoAuditorOutput,
    postActions: [{ type: 'commit-task-files' }],
  })

  stages.set('pr', {
    name: 'pr',
    type: 'git',
    timeout: 2 * 60_000,
    maxRetries: 0,
  })

  return stages
}
```

---

## Skip Conditions (`pipeline/skip-conditions.ts`)

Pure functions, easily testable:

```typescript
interface SkipResult {
  shouldSkip: boolean
  reason?: string
}

function skipIfInputQuality(ctx: PipelineContext): SkipResult {
  const skippable = ctx.taskDef?.input_quality?.skip_stages ?? []
  if (skippable.includes('spec')) {
    const outputExists = fs.existsSync(stageOutputFile(ctx.taskDir, 'spec'))
    if (outputExists) return { shouldSkip: true, reason: 'input_quality' }
  }
  return { shouldSkip: false }
}

function skipIfClarifyDisabled(ctx: PipelineContext): SkipResult {
  if (!ctx.input.clarify) {
    return { shouldSkip: true, reason: 'clarify_disabled' }
  }
  return { shouldSkip: false }
}

function skipIfNoAuditorOutput(ctx: PipelineContext): SkipResult {
  if (!fs.existsSync(path.join(ctx.taskDir, 'auditor.md'))) {
    return { shouldSkip: true, reason: 'no_auditor_output' }
  }
  return { shouldSkip: false }
}
```

---

## Post-Actions (`pipeline/post-actions.ts`)

Declared actions that run after a stage completes:

```typescript
type PostAction =
  | { type: 'validate-task-json' }
  | { type: 'resolve-profile' }
  | { type: 'check-gate'; gate: string }
  | { type: 'commit-task-files' }
  | { type: 'archive-rerun-feedback' }
  | { type: 'validate-plan-exists' }
  | { type: 'validate-build-content' }
  | { type: 'run-tsc' }
  | { type: 'run-unit-tests' }

async function executePostAction(
  ctx: PipelineContext,
  action: PostAction,
  state: PipelineStateV2,
): Promise<void> {
  switch (action.type) {
    case 'validate-task-json':
      return handleTaskJsonValidation(ctx)
    case 'resolve-profile':
      return handleProfileResolution(ctx)
    case 'check-gate':
      return handleGateCheck(ctx, action.gate)
    case 'commit-task-files':
      return handleCommitTaskFiles(ctx)
    case 'archive-rerun-feedback':
      return handleRerunFeedbackArchive({ taskId: ctx.taskId, taskDir: ctx.taskDir })
    case 'validate-plan-exists':
      return handlePlanGapValidation({ taskId: ctx.taskId, taskDir: ctx.taskDir })
    case 'validate-build-content':
      return handleBuildValidation({ taskId: ctx.taskId, taskDir: ctx.taskDir })
    case 'run-tsc':
      return handlePostBuildTsc({
        taskId: ctx.taskId,
        taskDir: ctx.taskDir,
        dryRun: ctx.input.dryRun,
      })
    case 'run-unit-tests':
      return handlePostBuildTests({
        taskId: ctx.taskId,
        taskDir: ctx.taskDir,
        dryRun: ctx.input.dryRun,
      })
  }
}
```

---

## Shell → TypeScript Migration

### `parse-inputs.sh` → `parse-inputs.ts`

The logic already exists in TypeScript (`discoverTaskIdFromIssue`, `parseCommentBody`, `parseCliArgs`). The shell script is redundant.

### `parse-safety.sh` → `parse-safety.ts`

Simple checks: bot filter, author association, `/cody` pattern match.

### Entry Point

The YAML workflow calls `pnpm cody` directly:

```yaml
- name: Run Cody
  run: |
    pnpm cody \
      --task-id="${{ needs.parse.outputs.task_id }}" \
      --mode="${{ needs.parse.outputs.mode }}" \
      --issue-number="${{ needs.parse.outputs.issue_number }}" \
      --trigger-type="${{ needs.parse.outputs.trigger_type }}" \
      --run-id="${{ github.run_id }}" \
      --run-url="${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
```

The `parse` job becomes a TypeScript script:

```yaml
- name: Parse and validate
  id: parse
  run: pnpm cody:parse
  env:
    GITHUB_EVENT_NAME: ${{ github.event_name }}
    COMMENT_BODY: ${{ github.event.comment.body }}
```

---

## What Changes vs. What Stays

### Rewritten (new files)

| File                           | Purpose                                     | ~Lines     |
| ------------------------------ | ------------------------------------------- | ---------- |
| `engine/state-machine.ts`      | Core loop                                   | 200        |
| `engine/types.ts`              | All types                                   | 150        |
| `engine/pipeline-resolver.ts`  | Pipeline construction from mode + task.json | 100        |
| `engine/status.ts`             | Status v2 read/write with schema validation | 100        |
| `handlers/handler.ts`          | Interface + registry                        | 50         |
| `handlers/agent-handler.ts`    | Wraps existing agent-runner                 | 80         |
| `handlers/scripted-handler.ts` | Wraps existing scripted-stages + autofix    | 120        |
| `handlers/git-handler.ts`      | Wraps existing commit/PR stages             | 60         |
| `handlers/gate-handler.ts`     | Wraps existing gate logic                   | 80         |
| `pipeline/definitions.ts`      | Stage configs                               | 200        |
| `pipeline/skip-conditions.ts`  | Skip logic                                  | 60         |
| `pipeline/post-actions.ts`     | Post-stage actions                          | 150        |
| `entry.ts`                     | New CLI entry                               | 100        |
| `parse-safety.ts`              | Port from shell                             | 50         |
| `parse-inputs.ts`              | Port from shell                             | 80         |
| **Total new**                  |                                             | **~1,580** |

### Kept as-is (reused by handlers)

| File                    | Why                                              |
| ----------------------- | ------------------------------------------------ |
| `agent-runner.ts`       | Core agent spawn/poll logic — solid, well-tested |
| `runner-backend.ts`     | Local/GitHub runner — clean interface            |
| `stage-prompts.ts`      | Prompt construction — no change needed           |
| `content-validators.ts` | Pure validators — reused by definitions          |
| `git-utils.ts`          | Git operations — reused by git-handler           |
| `clarify-workflow.ts`   | Clarification logic — reused by gate-handler     |
| `audit-history.ts`      | Audit tracking — reused by auditor post-action   |
| `preflight.ts`          | Pre-checks — called from entry.ts                |
| `pipeline-utils.ts`     | Pipeline defs, task validation — reused          |
| `logger.ts`             | Logging — reused                                 |

### Deleted (replaced by engine)

| File                         | Replaced By                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `cody.ts` (1,156 lines)      | `engine/state-machine.ts` + `entry.ts`                                                                            |
| `stage-hooks.ts` (223 lines) | `pipeline/post-actions.ts`                                                                                        |
| `cody-utils.ts` (926 lines)  | Split: types → `engine/types.ts`, status → `engine/status.ts`, CLI → `entry.ts`, GitHub helpers → kept separately |
| `run-cody.sh` (46 lines)     | Direct YAML invocation                                                                                            |
| `parse-inputs.sh`            | `parse-inputs.ts`                                                                                                 |
| `parse-safety.sh`            | `parse-safety.ts`                                                                                                 |
| `parse-safety-supervisor.sh` | `parse-safety.ts`                                                                                                 |
| `checkout-task-branch.sh`    | Logic already in `git-utils.ts`                                                                                   |

### Modified (updated imports)

| File                | Change                                                      |
| ------------------- | ----------------------------------------------------------- |
| `cody.yml`          | Direct `pnpm cody` call, parse job uses `pnpm cody:parse`   |
| `pipeline-utils.ts` | Keep pipeline definitions, remove functions moved to engine |

---

## Implementation Phases

| Phase | What                                                            | Risk     | Depends On      |
| ----- | --------------------------------------------------------------- | -------- | --------------- |
| 1     | `engine/types.ts` + `engine/status.ts` (v2 schema + read/write) | Low      | Nothing         |
| 2     | `pipeline/definitions.ts` + `pipeline/skip-conditions.ts`       | Low      | Phase 1 (types) |
| 3     | `handlers/*` (wrapping existing modules)                        | Medium   | Phase 1 (types) |
| 4     | `engine/state-machine.ts` + `engine/pipeline-resolver.ts`       | Medium   | Phase 1-3       |
| 5     | `entry.ts` + `parse-safety.ts` + `parse-inputs.ts`              | Low      | Phase 4         |
| 6     | `pipeline/post-actions.ts`                                      | Medium   | Phase 1-3       |
| 7     | Wire up: `entry.ts` → engine → handlers → post-actions          | Low      | Phase 1-6       |
| 8     | Update `cody.yml`, delete old files                             | Low      | Phase 7         |
| 9     | Rewrite tests alongside each phase                              | Parallel | Each phase      |

### Phase Dependencies

```
Phase 1 (types + status) ─┬─→ Phase 2 (definitions)
                           ├─→ Phase 3 (handlers)
                           └─→ Phase 6 (post-actions)
                                    │
Phase 2 + 3 + 6 ──────────→ Phase 4 (engine core)
                                    │
Phase 4 ───────────────────→ Phase 5 (entry + shell ports)
                                    │
Phase 5 ───────────────────→ Phase 7 (wire up)
                                    │
Phase 7 ───────────────────→ Phase 8 (cody.yml + cleanup)

Phase 9 (tests) ──────────→ Runs in parallel with all phases
```

---

## What This Fixes

| Current Bug Pattern                                         | How the State Machine Fixes It                              |
| ----------------------------------------------------------- | ----------------------------------------------------------- |
| Stage skipped because output file exists but is corrupted   | `status.json` cursor is the authority, not file existence   |
| Autofix loop leaves pipeline in inconsistent state          | Autofix is internal to verify handler, invisible to engine  |
| Gate check inline in the for-loop has wrong index           | Gate is a declared post-action, engine handles pause/resume |
| `stages[]` array grows mid-iteration                        | Pipeline order is computed once, immutable                  |
| Status.json and loop index disagree                         | Single cursor in status.json, engine reads it on each tick  |
| Post-stage hook failure leaves stage marked "completed"     | Post-actions run before state transitions to "completed"    |
| Rerun deletes files but status.json still says "completed"  | Rerun resets cursor + stage states atomically               |
| Parallel stage failure handling is ad-hoc                   | Engine has uniform parallel handling with advisory flag     |
| Shell injection via comment body → shell script             | All parsing in TypeScript, no shell interpolation           |
| parse-inputs.sh and TS discoverTaskIdFromIssue can disagree | Single implementation in TypeScript                         |

---

## Open Questions

1. **GitHub API helpers** (postComment, editComment, getIssue, etc.) currently live in `cody-utils.ts`. Should they go into a separate `github-api.ts` or stay in the split?
2. **Dry-run mode**: Currently writes mock outputs per stage. Should dry-run be a handler variant or a flag checked in the engine?
3. **Status comment updates**: Currently posted inline during execution. Should the engine have a lifecycle hook for status reporting, or should handlers handle their own reporting?
