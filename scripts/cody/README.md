# Cody Pipeline

AI agent pipeline for automated feature implementation and bug fixes.

## Trigger

- `@cody [spec|impl|rerun|full|status] [task-id]` on GitHub issues
- `workflow_dispatch` with `task_id` input

## Pipeline Modes

| Mode    | Stages                                                                      |
| ------- | --------------------------------------------------------------------------- |
| `spec`  | taskify → spec → gap → clarify                                              |
| `impl`  | architect → plan-gap → build → commit → verify → auditor → apply-audit → pr |
| `full`  | spec + impl (two-phase)                                                     |
| `rerun` | Resume from failure                                                         |

## Two-Phase Execution

1. **Phase 1**: Run spec stages (taskify, spec, gap)
2. **After taskify**: `resolve-profile` post-action sets `ctx.pipelineNeedsRebuild = true`
3. **Rebuild**: `rebuildPipelineAfterTaskify()` returns full pipeline with BOTH completed + pending stages
4. **Phase 2**: Continue with impl stages

## Profiles

- `standard`: Full pipeline (includes gap, plan-gap, auditor, apply-audit)
- `lightweight`: Skips spec, gap, plan-gap, auditor, apply-audit

Profile resolved in `resolve-profile` post-action based on:

- Explicit `pipeline_profile` in task.json
- Task type + risk level (fix_bug/refactor/ops + low risk = lightweight)

## Stage Inputs/Outputs

| Stage     | Input           | Output       |
| --------- | --------------- | ------------ |
| taskify   | issue body      | task.json    |
| spec      | task.json       | spec.md      |
| gap       | spec.md         | gap.md       |
| architect | spec.md, gap.md | plan.md      |
| plan-gap  | plan.md         | plan-gap.md  |
| build     | plan.md         | code changes |
| verify    | code changes    | test results |
| auditor   | code changes    | audit.md     |
| pr        | all             | PR created   |

## Key Files

| File                          | Purpose                                 |
| ----------------------------- | --------------------------------------- |
| `entry.ts`                    | Main entry, mode routing                |
| `engine/state-machine.ts`     | Pipeline execution loop                 |
| `engine/types.ts`             | PipelineContext, StageStateV2, etc.     |
| `pipeline/definitions.ts`     | Stage definitions, stage order          |
| `pipeline/post-actions.ts`    | Post-stage actions                      |
| `pipeline/skip-conditions.ts` | Stage skip logic                        |
| `cody-utils.ts`               | readTask, writeState, postComment, etc. |
| `git-utils.ts`                | commit, push, createPR                  |
| `handlers/handler.ts`         | Stage execution dispatcher              |

## Task Files

Generated in `.tasks/<task-id>/`:

- `task.json` - Task definition
- `task.md` - Original issue
- `spec.md` - Generated specification
- `plan.md` - Implementation plan
- `gap.md` - Gap analysis
- `status.json` - Pipeline state
- `gate-<name>.md` - Gate pause files

## State Machine

```
while (true):
  if ctx.pipelineNeedsRebuild && rebuildPipeline:
    pipeline = rebuildPipeline(ctx)

  nextStep = resolveNextStep(state, pipeline)
  if not nextStep: break  // done

  executeStep(nextStep)  // calls handler, then postActions
  writeState()

  if state.failed or state.paused: break
```

## Post-Actions

Defined in `pipeline/definitions.ts` for each stage:

| Action               | Purpose                                   |
| -------------------- | ----------------------------------------- |
| `validate-task-json` | Ensure task.json valid                    |
| `resolve-profile`    | Set ctx.profile, set pipelineNeedsRebuild |
| `check-gate`         | Pause for approval if gate file exists    |
| `commit-task-files`  | Commit and push                           |

## Gates

Gates pause pipeline for human approval:

1. Stage with `check-gate` post-action creates `gate-<name>.md`
2. Pipeline throws `PipelinePausedError`
3. Human reviews and adds `@cody approve` comment
4. `handleGateApproval()` in `clarify-workflow.ts` resumes

## Error Handling

- Stage fails → state = failed, pipeline stops
- Retry: `maxRetries` in stage definition (default 2)
- Skip: `shouldSkip` returns `{shouldSkip: true, reason}`
- Pause: throw `PipelinePausedError`

## Add New Stage

1. Add to `SPEC_ORDER` or `IMPL_ORDER` in `definitions.ts`
2. Define stage in `createStageDefinitions()` with:
   - `type`: 'agent' | 'scripted'
   - `timeout`: ms
   - `maxRetries`: number
   - `shouldSkip`: (ctx) => SkipResult
   - `postActions`: Action[]
   - `validator`: (output) => boolean
3. Add handler in `handlers/` if agent type

## Important Context

```
PipelineContext {
  taskId: string
  taskDir: string
  taskDef: TaskDefinition | null
  profile: 'standard' | 'lightweight'
  backend: RunnerBackend
  pipelineNeedsRebuild?: boolean
  input: CodyInput
}

StageStateV2 {
  state: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'paused'
  retries: number
  startedAt?: string
  completedAt?: string
  error?: string
}
```

## Key Functions

```typescript
// cody-utils.ts
readTask(taskDir) → TaskDefinition
writeState(taskId, state)
postComment(issueNumber, body)
uploadArtifact(taskId, path)

// git-utils.ts
commit(taskDir, message, dryRun?) → commitHash
push(branch, dryRun?)
createPR(branch, title, body) → prUrl
```

## Debug

```bash
# Check status
cat .tasks/<task-id>/status.json

# Resume from stage
@cody rerun <task-id> --from build

# Dry run
@cody full <task-id> --dry-run

# Check git log
git log --oneline .tasks/<task-id>/
```
