# Cody Pipeline — Architecture Reference

AI agent pipeline that converts GitHub issues into implemented PRs.

## System Overview

Cody is a 3-layer system:

```
┌──────────────────────────────────────────────────────────────────┐
│  1. CI LAYER — GitHub Actions (.github/workflows/cody.yml)       │
│     Trigger: @cody comment or workflow_dispatch                  │
│     Jobs: parse → orchestrate                                    │
│     Output: parsed inputs → pnpm cody                            │
├──────────────────────────────────────────────────────────────────┤
│  2. ENGINE LAYER — State machine (scripts/cody/)                 │
│     Entry: entry.ts → state-machine.ts loop                      │
│     Stages: taskify → gap → architect → build → pr              │
│     Output: code changes, PRs, status.json                       │
├──────────────────────────────────────────────────────────────────┤
│  3. DASHBOARD LAYER — Next.js UI (src/ui/cody/, src/app/api/cody)│
│     Pages: /cody (list), /cody/:issueNumber (detail)             │
│     API: /api/cody/* proxies GitHub API                          │
│     Output: real-time pipeline status, gate approval UI          │
└──────────────────────────────────────────────────────────────────┘
```

## End-to-End Data Flow

```
User posts "@cody" on GitHub issue #788
  ↓
cody.yml parse job:
  parse-safety.ts → validates author is OWNER/MEMBER/COLLABORATOR
  parse-inputs.ts → extracts task_id, mode, feedback, etc.
  ↓
cody.yml orchestrate job:
  checkout-task-branch.ts → checks out existing feature branch if any
  entry.ts → builds PipelineContext, calls runPipeline()
  ↓
state-machine.ts loop:
  for each stage in pipeline order:
    1. shouldSkip? → skip if conditions met
    2. preExecute? → e.g., ensureFeatureBranch for build
    3. handler.execute() → runs agent (LLM) or script
    4. postActions → validate, commit, check gates
    5. writeState() → persist to .tasks/<id>/status.json
  ↓
Output:
  - Feature branch with code changes
  - PR created via gh CLI
  - Status comments on the GitHub issue
  - status.json for dashboard consumption
```

## Trigger

- `@cody [spec|impl|rerun|full|fix|status] [task-id]` on GitHub issues
- `@cody approve` to approve a paused gate
- `@cody` (bare) on an issue — defaults to full mode
- `workflow_dispatch` with explicit inputs

## Pipeline Modes

| Mode    | Stages                                                                      |
| ------- | --------------------------------------------------------------------------- |
| `spec`  | taskify → gap → clarify                                                     |
| `impl`  | architect → plan-gap → build → commit → review → fix → verify → pr           |
| `full`  | spec + impl (two-phase, with pipeline rebuild after taskify)                |
| `rerun` | Resume from last failure/pause point                                        |
| `fix`   | review → fix → commit → verify → pr (targeted fix mode)                     |

## Two-Phase Execution (Full Mode)

1. **Phase 1**: Spec stages run (taskify → gap)
2. **After taskify**: `resolve-profile` post-action sets `ctx.pipelineNeedsRebuild = true`
3. **Rebuild**: `rebuildPipelineAfterTaskify()` returns full pipeline with BOTH completed + pending stages
4. **Phase 2**: Engine skips completed spec stages, continues with impl stages

**Critical:** `rebuildPipelineAfterTaskify` MUST return both spec AND impl stages. If it returns only impl, completed spec stages will be missing from the order and the engine will skip them.

## Profiles

- `standard`: Full pipeline (includes gap, plan-gap)
- `lightweight`: Skips gap, plan-gap (for simple bug fixes, refactors)

Profile resolved in `resolve-profile` post-action based on:

- Explicit `pipeline_profile` in task.json
- Task type + risk level (fix_bug/refactor/ops + low risk → lightweight)

## Stage Architecture

### Stage Types

| Type       | Handler                 | Description                    |
| ---------- | ----------------------- | ------------------------------ |
| `agent`    | `AgentHandler`          | Runs LLM via opencode CLI      |
| `scripted` | `ScriptedVerifyHandler` | Runs shell commands (verify)   |
| `git`      | `GitCommitHandler` etc. | Git operations (commit, PR)    |
| `gate`     | `GateHandler`           | Approval gates (pause/approve) |

### Stage Inputs/Outputs

| Stage        | Type     | Input             | Output       | Post-Actions                                                        |
| ------------ | -------- | ----------------- | ------------ | ------------------------------------------------------------------- |
| taskify      | agent    | issue body        | task.json    | validate-task-json, set-labels, check-gate, commit, resolve-profile |
| spec         | agent    | task.json         | spec.md      | —                                                                   |
| gap          | agent    | spec.md           | gap.md       | —                                                                   |
| clarify      | agent    | spec.md           | clarified.md | —                                                                   |
| architect    | agent    | spec+gap+clarified | plan.md      | archive-rerun-feedback, check-gate                                  |
| plan-gap     | agent    | plan.md+spec+gap   | plan-gap.md  | validate-plan-exists                                                |
| build        | agent    | plan.md            | code changes | validate-src, validate-build, commit, quality-autofix               |
| commit       | git      | staged files      | commit hash  | —                                                                   |
| review       | agent    | code diff         | review.md    | analyze-review-findings, commit                                     |
| fix          | agent    | review.md         | code fixes   | commit, clear-verify-failures                                       |
| commit       | git      | fix changes       | commit hash  | —                                                                   |
| verify       | scripted | code              | test results | commit (local only)                                                 |
| pr           | git      | all               | PR URL       | —                                                                   |

### Stage Execution Flow (per stage)

```
shouldSkip(ctx)?
  ├─ yes → state=skipped, skip to next
  └─ no →
      preExecute(ctx)?  // e.g., ensureFeatureBranch
        ↓
      handler.execute(ctx, def) → StageResult
        ↓
      for each postAction:
        executePostAction(ctx, action, state)
        ↓
      writeState()
        ↓
      if outcome=paused → throw PipelinePausedError
      if outcome=failed → pipeline stops
      if outcome=completed → continue to next stage
```

## Post-Action System

Post-actions run after a stage completes. Defined per-stage in `definitions.ts`.

| Action                      | Purpose                                                      |
| --------------------------- | ------------------------------------------------------------ |
| `validate-task-json`        | Parse task.json, delete if invalid so retry recreates it     |
| `set-classification-labels` | Set risk:_, type:_, complexity:_, domain:_ labels on issue   |
| `resolve-profile`           | Determine standard/lightweight profile, trigger rebuild      |
| `check-gate`                | Post gate comment, pause if awaiting approval                |
| `commit-task-files`         | Commit + push task files or tracked files to remote          |
| `archive-rerun-feedback`    | Move rerun-feedback.md to archive after architect consumes it |
| `validate-src-changes`      | Ensure build agent actually modified source files            |
| `validate-build-content`    | Validate build output quality                                |
| `run-quality-with-autofix`  | Run tsc + tests, retry with autofix agent if they fail       |
| `analyze-review-findings`   | Parse review.md to determine if fix stage is needed          |
| `clear-verify-failures`     | Remove verify-failures.md for clean retry                    |

## Gate System

Gates pause the pipeline for human approval:

1. `check-gate` post-action checks control mode (auto/supervised/gated)
2. If gated: posts a formatted comment on the issue with review questions, assumptions, plan summary
3. Pipeline throws `PipelinePausedError` → state = paused
4. Operator reviews on dashboard or GitHub, posts `@cody approve`
5. Rerun triggers → `handleGateApproval()` in `clarify-workflow.ts` finds the approval comment
6. Pipeline resumes from the next stage after the gate

### Control Modes

| Mode         | Behavior                               |
| ------------ | -------------------------------------- |
| `auto`       | Skip gates, run to completion          |
| `supervised` | Gate only on medium/high risk          |
| `gated`      | Always gate after taskify and architect |

Control mode resolved dynamically per gate via `resolveControlMode(taskDef, inputControlMode)`.

## Rerun & Recovery

### Rerun from failure

```
@cody rerun <task-id> --from build
```

1. `resolveRerunFromStage()` resolves the fromStage name
2. If feedback is provided and fromStage is after architect, backs up to architect
3. All stages before fromStage stay completed, fromStage resets to pending
4. Pipeline resumes from that point

### Gate approval rerun

```
@cody approve
```

1. `resolveFromStageAfterGateApproval()` finds the next stage after the approved gate
2. The approved stage itself is NOT reset (would overwrite the approval)
3. Pipeline continues from the next stage

### Stage names

The current pipeline uses `architect`, `plan-gap`, and `build` directly. No stage aliases are needed.

## Complexity-Based Stage Routing

The taskify agent assigns a complexity score (1-100). Stages have minimum complexity thresholds:

| Complexity | Tier         | Stages that run                      |
| ---------- | ------------ | ------------------------------------ |
| 1-9        | trivial      | architect → build → commit → pr      |
| 10-19      | simple       | architect → build → commit → pr      |
| 20-34      | moderate     | + gap, plan-gap, review              |
| 35-49      | complex      | + clarify                            |
| 50+        | very complex | All stages + quality model profile   |

## Quality Gates (build post-action)

After build commits code, `run-quality-with-autofix` runs:

1. TypeScript check (`pnpm -s tsc --noEmit`)
2. Unit tests (`pnpm -s test:unit`)

If either fails:

1. Error classified via `error-classifier.ts` (tsc vs lint vs test)
2. Errors formatted as markdown
3. Autofix agent runs with the errors as input
4. Repeat up to `maxFeedbackLoops` (default: 2) times

## File Map

### Core Pipeline

| File                           | Purpose                                                       |
| ------------------------------ | ------------------------------------------------------------- |
| `entry.ts`                     | CLI entry, mode routing, ensureTaskMd, calls runPipeline()    |
| `engine/state-machine.ts`      | Main execution loop, stage orchestration, parallel execution  |
| `engine/types.ts`              | PipelineContext, StageDefinition, PostAction, PipelineStateV2 |
| `engine/pipeline-resolver.ts`  | resolvePipelineForMode(), createRebuildCallback()             |
| `engine/status.ts`             | loadState, writeState, initState, updateStage                 |
| `pipeline/definitions.ts`      | Stage order, createStageDefinitions(), buildPipeline()        |
| `pipeline/post-actions.ts`     | executePostAction() — all post-action implementations         |
| `pipeline/skip-conditions.ts`  | shouldSkip logic (input quality, complexity, clarify)         |
| `pipeline/validators.ts`       | Output validators for spec, gap, build                        |
| `pipeline/error-classifier.ts` | Classify tsc/lint/test errors for autofix                     |

### Handlers (one per stage type)

| File                           | Purpose                                             |
| ------------------------------ | --------------------------------------------------- |
| `handlers/handler.ts`          | StageHandler interface, handler registry            |
| `handlers/agent-handler.ts`    | Runs LLM agents via opencode CLI                    |
| `handlers/scripted-handler.ts` | Runs verify stage (quality gates)                   |
| `handlers/git-handler.ts`      | GitCommitHandler, GitCommitFixHandler, GitPrHandler |
| `handlers/gate-handler.ts`     | Gate approval workflow                              |

### Agent Execution

| File                | Purpose                                                      |
| ------------------- | ------------------------------------------------------------ |
| `agent-runner.ts`   | runAgentWithFileWatch(), spawns opencode, monitors output    |
| `runner-backend.ts` | Pluggable backends: GitHubRunner (CI) vs LocalRunner (ocode) |
| `stage-prompts.ts`  | SPEC_STAGES prompt definitions for each agent stage          |

### Git & GitHub

| File                  | Purpose                                                                       |
| --------------------- | ----------------------------------------------------------------------------- |
| `git-utils.ts`        | ensureFeatureBranch, commitAndPush, pushWithRebase, deriveBranchName          |
| `github-api.ts`       | postComment, setLifecycleLabel, setClassificationLabels, getIssue, closeIssue |
| `clarify-workflow.ts` | handleGateApproval, handleClarification, formatGateComment                    |

### Input Parsing & Safety

| File              | Purpose                                                      |
| ----------------- | ------------------------------------------------------------ |
| `parse-inputs.ts` | Parse dispatch/comment inputs, extract mode/task-id/feedback |
| `parse-safety.ts` | Validate comment author (OWNER/MEMBER/COLLABORATOR only)     |
| `preflight.ts`    | Pre-flight checks (ocode CLI, git, pnpm, Node.js)            |
| `env.ts`          | Environment variable helpers                                 |

### Pipeline Utilities

| File                      | Purpose                                                                       |
| ------------------------- | ----------------------------------------------------------------------------- |
| `pipeline-utils.ts`       | readTask, TaskDefinition schema, stageOutputFile, STAGE_COMPLEXITY_THRESHOLDS |
| `cody-utils.ts`           | parseCliArgs, validateAuth, ensureTaskDir, formatStatusComment                |
| `rerun-utils.ts`          | resolveRerunFromStage, resolveFromStageAfterGateApproval, STAGE_ALIASES       |
| `content-validators.ts`   | checkForQuestions, validateMarkdown                                           |
| `checkout-task-branch.ts` | Checkout existing feature branch in CI before pipeline runs                   |
| `chat-history.ts`         | Export and trim opencode chat sessions to chat.json                           |
| `scripted-stages.ts`      | Verify stage (quality gates), commit stage, PR stage                          |
| `tag-version.ts`          | Version tagging utility                                                       |
| `logger.ts`               | Pino logger, CI group helpers                                                 |

## Task Files

Generated in `.tasks/<task-id>/`:

| File                 | When Created       | Purpose                             |
| -------------------- | ------------------ | ----------------------------------- |
| `task.md`            | Before taskify     | Original issue body                 |
| `task.json`          | After taskify      | Structured task definition          |
| `spec.md`            | After spec         | Generated specification             |
| `gap.md`             | After gap          | Gap analysis                        |
| `clarified.md`       | After clarify      | Clarified requirements              |
| `plan.md`            | After architect    | Implementation plan                 |
| `plan-gap.md`        | After plan-gap     | Plan gap analysis                   |
| `build.md`           | After build        | Build output log                    |
| `review.md`          | After review       | Code review findings                |
| `commit.md`          | After commit       | Commit details                      |
| `status.json`        | Throughout         | Pipeline state (V2 format)          |
| `chat.json`          | After agent stages | Trimmed chat history                |
| `gate-taskify.md`    | At taskify gate    | Gate pause marker                   |
| `gate-architect.md`  | At architect gate  | Gate pause marker                   |
| `rerun-feedback.md`  | On rerun           | Operator feedback for plan revision  |
| `verify-failures.md` | On verify failure  | Formatted test/lint failures        |

## State Machine

```
while (true):
  if ctx.pipelineNeedsRebuild && rebuildPipeline:
    pipeline = rebuildPipeline(ctx)

  nextStep = resolveNextStep(state, pipeline)
  if not nextStep: break  // all stages completed

  executeStep(nextStep)  // shouldSkip → preExecute → handler → postActions
  writeState()

  if state.failed or state.paused: break
```

### Pipeline State (status.json V2)

```typescript
PipelineStateV2 {
  version: 2
  taskId: string
  mode: string                    // 'full', 'spec', 'impl', 'rerun', 'fix'
  pipeline: string                // 'standard' or 'lightweight'
  startedAt: string
  updatedAt: string
  state: 'running' | 'completed' | 'failed' | 'timeout' | 'paused'
  cursor: string | null           // current stage name
  issueNumber?: number
  branchName?: string
  stages: Record<string, StageStateV2>
}

StageStateV2 {
  state: 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'skipped' | 'paused'
  retries: number
  startedAt?: string
  completedAt?: string
  elapsed?: number
  outputFile?: string
  skipped?: string               // skip reason
  error?: string
  feedbackLoops?: number         // autofix loop count
  feedbackErrors?: string[]
  fixAttempt?: number
  maxFixAttempts?: number
  issuesFound?: boolean          // from review analysis
  reviewSummary?: { critical, major, minor }
}
```

## CI Layer (.github/workflows/cody.yml)

### Job Flow

```
parse (ubuntu-latest, 5min)
  ├─ parse-safety.ts → validate author
  ├─ parse-inputs.ts → extract task_id, mode, etc.
  └─ outputs: task_id, mode, feedback, issue_number, runner, etc.
       ↓
orchestrate (self-hosted or ubuntu-latest, 120min)
  ├─ checkout full repo
  ├─ checkout-task-branch.ts → switch to feature branch if exists
  ├─ overlay pipeline version (if --version specified)
  ├─ pnpm cody → runs entry.ts with parsed env vars
  ├─ upload .tasks/<id>/ as artifact
  └─ cleanup workspace (self-hosted only)
```

### Concurrency

```yaml
concurrency:
  group: cody-${{ task_id || issue.number || sha }}
  cancel-in-progress: false
```

One pipeline run per issue at a time. Does NOT cancel in-progress runs.

## Dashboard Layer

### Pages

| Route                | Component     | Purpose              |
| -------------------- | ------------- | -------------------- |
| `/cody`              | CodyDashboard | Task list, filters   |
| `/cody/:issueNumber` | TaskDetail    | Pipeline detail view |

### API Routes (`/api/cody/*`)

| Route                             | Method | Purpose                           |
| --------------------------------- | ------ | --------------------------------- |
| `/api/cody/tasks`                 | GET    | List tasks (proxies GH issues)    |
| `/api/cody/tasks/:taskId`         | GET    | Task detail                       |
| `/api/cody/tasks/approve`         | POST   | Approve gate                      |
| `/api/cody/tasks/approve-review`  | POST   | Approve review findings           |
| `/api/cody/tasks/:taskId/actions` | POST   | Trigger actions (rerun, abort)    |
| `/api/cody/tasks/:taskId/docs`    | GET    | Task documents (spec, plan, etc.) |
| `/api/cody/pipeline/:taskId`      | GET    | Pipeline status                   |
| `/api/cody/prs`                   | GET    | List PRs                          |
| `/api/cody/prs/files`             | GET    | PR file changes                   |
| `/api/cody/prs/status`            | GET    | PR CI status                      |
| `/api/cody/workflows`             | GET    | GitHub Actions workflow runs      |
| `/api/cody/boards`                | GET    | Project board data                |
| `/api/cody/collaborators`         | GET    | Repo collaborators                |
| `/api/cody/auth`                  | GET    | Auth check                        |
| `/api/cody/publish`               | POST   | Publish/merge PR                  |
| `/api/cody/chat/*`                | \*     | Chat save/load/stream             |

## Known Gotchas & Bugs Fixed

### Push rejection on reruns (FIXED)

**Problem:** `git push -u origin HEAD` fails with `! [rejected]` when a rerun starts after gate approval, because the previous run already pushed to the same branch.

**Fix:** `pushWithRebase()` in `git-utils.ts` — pulls with rebase before retrying push. Applied to both `commitAndPush()` and `commitPipelineFiles()`.

### Chat history JSON corruption (FIXED)

**Problem:** `JSON.parse(output)` at line 179 of `chat-history.ts` throws `SyntaxError: Expected ',' or '}'` when opencode CLI outputs non-JSON prefix lines (progress messages, "Exporting session:" text).

**Fix:** `extractJson()` helper finds first `{` and last `}` in output, parses only the JSON substring.

### Duplicate classification labels (FIXED)

**Problem:** On reruns, `setClassificationLabels` adds new labels without removing old ones. An issue gets both `risk:low` and `risk:medium`.

**Fix:** Before adding, remove all other labels in the same category (risk, type, complexity, domain).

### Runner workspace contamination

**Problem:** Self-hosted runner retains leftover state from previous jobs (branches, untracked files). A subsequent job may operate on the wrong branch.

**Mitigation:** `cody.yml` has a cleanup step (`git clean -ffdx`) that runs on `always()` for self-hosted runners. May need `clean: true` on `actions/checkout`.

### Infinite hook loops in post-actions

**Problem:** Post-actions that update state can trigger re-evaluation. The state machine has a loop guard but complex post-action chains can behave unexpectedly.

**Prevention:** Always check `context.skipHooks` flag. Post-actions should be idempotent.

## Debug

```bash
# Check pipeline status
cat .tasks/<task-id>/status.json | jq '.state, .stages | to_entries[] | "\(.key): \(.value.state)"'

# Check which stages ran
cat .tasks/<task-id>/status.json | jq '.stages | to_entries[] | select(.value.state != "pending") | "\(.key): \(.value.state) (\(.value.elapsed // 0)ms)"'

# Check task definition
cat .tasks/<task-id>/task.json | jq '{task_type, risk_level, complexity, pipeline_profile}'

# Resume from specific stage
@cody rerun <task-id> --from build

# Resume with feedback
@cody rerun <task-id> --from architect --feedback "Use the existing Button component"

# Check git log for task
git log --oneline .tasks/<task-id>/

# Check GH Actions run
gh run view <run-id> --log
```

## Add New Stage

1. Add to `SPEC_ORDER_*` or `IMPL_ORDER_*` in `pipeline/definitions.ts`
2. Define stage in `createStageDefinitions()`:
   ```typescript
   stages.set('newStage', {
     name: 'newStage',
     type: 'agent',
     timeout: STAGE_TIMEOUTS.newStage ?? DEFAULT_TIMEOUT,
     maxRetries: 1,
     minComplexity: STAGE_COMPLEXITY_THRESHOLDS.newStage,
     shouldSkip: (ctx) => skipIfBelowComplexity(ctx, 'newStage'),
     postActions: [...],
     validator: createNewStageValidator(ctx),
   })
   ```
3. Add agent prompt in `.opencode/agents/newStage.md`
4. Add handler in `handlers/` if custom (otherwise uses type-based default)
5. Add complexity threshold in `pipeline-utils.ts` `STAGE_COMPLEXITY_THRESHOLDS`

## Key Types

```typescript
// engine/types.ts
PipelineContext {
  taskId: string
  taskDir: string           // .tasks/<taskId>/
  taskDef: TaskDefinition   // from task.json
  profile: 'standard' | 'lightweight'
  backend: RunnerBackend    // GitHubRunner or LocalRunner
  pipelineNeedsRebuild?: boolean
  input: CodyInput          // parsed CLI args
}

StageDefinition {
  name: string
  type: 'agent' | 'scripted' | 'git' | 'gate'
  timeout: number
  maxRetries: number
  shouldSkip?: (ctx) => SkipResult
  validator?: (outputFile) => ValidationResult
  postActions?: PostAction[]
  preExecute?: (ctx) => Promise<void>
  minComplexity?: number
  fallbackOnMissingOutput?: (ctx) => string | null
}

// cody-utils.ts
CodyInput {
  taskId: string
  mode: 'spec' | 'impl' | 'full' | 'rerun' | 'fix'
  issueNumber?: number
  file?: string
  dryRun: boolean
  clarify: boolean
  feedback?: string
  fromStage?: string
  controlMode?: 'auto' | 'supervised' | 'gated'
  complexityOverride?: number
}
```
