# Codebase Context: pipeline-stabilization Phase 2

## Files to Modify
- `scripts/cody/entry.ts` (lines 387-396) — wrap GitHub API calls in try/catch in main catch block
- `scripts/cody/entry.ts` (lines 391-395) — enrich failure comment with stage name, cost, progression
- `scripts/cody/handlers/agent-handler.ts` (lines 67-71) — enrich failure reason with validation errors, exit code, artifact paths
- `scripts/cody/pipeline/post-actions.ts` (lines 271-298) — fix misleading error on git failure in validate-src-changes
- `scripts/cody/pipeline/post-actions.ts` (line 641) — throw on unknown post-action type
- `scripts/cody/engine/state-machine.ts` (lines 555-571) — compute and write `elapsed` field
- `scripts/cody/engine/state-machine.ts` (lines 117-118) — add loop iteration guard
- `scripts/cody/logger.ts` (lines 77-205) — delete dead legacy logging code
- `scripts/cody/cody-utils.ts` (lines 155-382) — delete deprecated v1 status management
- `scripts/cody/cody-utils.ts` (lines 388-403) — delete re-exports, move to direct imports
- `scripts/cody/cody-utils.ts` (lines 409-834) — extract to cli-parser.ts
- `scripts/cody/cody-utils.ts` (lines 1053-1152) — extract to status-format.ts
- `scripts/cody/pipeline-utils.ts` (lines 10-760) — extract task schemas/validation to pipeline/task-schema.ts
- `scripts/cody/pipeline-utils.ts` (lines 718-761) — extract readTask to pipeline/task-io.ts
- `scripts/cody/pipeline-utils.ts` (lines 47-150) — extract complexity to pipeline/complexity.ts
- `scripts/cody/entry.ts` (lines 412-971) — extract 6 mode handlers to modes/*.ts
- `scripts/cody/preflight.ts` — add LLM key and env var validation
- `scripts/cody/scripted-stages.ts` — replace magic numbers with constants
- `scripts/cody/agent-runner.ts` — replace magic numbers with constants
- `scripts/cody/pipeline/definitions.ts` — replace magic numbers with constants

## Files to Create
- `scripts/cody/config/constants.ts` (NEW) — named constants for all magic numbers
- `scripts/cody/cli-parser.ts` (NEW) — parseCliArgs, parseCommentBody extracted from cody-utils
- `scripts/cody/status-format.ts` (NEW) — formatDuration, formatStatusComment* extracted from cody-utils
- `scripts/cody/modes/spec.ts` (NEW) — runSpecMode extracted from entry.ts
- `scripts/cody/modes/impl.ts` (NEW) — runImplMode extracted from entry.ts
- `scripts/cody/modes/full.ts` (NEW) — runFullMode extracted from entry.ts
- `scripts/cody/modes/rerun.ts` (NEW) — runRerunMode extracted from entry.ts
- `scripts/cody/modes/fix.ts` (NEW) — runFixMode extracted from entry.ts
- `scripts/cody/modes/status.ts` (NEW) — runStatusMode extracted from entry.ts
- `scripts/cody/modes/index.ts` (NEW) — barrel export
- `scripts/cody/pipeline/task-schema.ts` (NEW) — TaskDefinition, Zod schemas, normalization
- `scripts/cody/pipeline/task-io.ts` (NEW) — readTask file I/O
- `scripts/cody/pipeline/complexity.ts` (NEW) — complexity scoring, tiers, control modes

## Files to Read (reference patterns)
- `scripts/cody/engine/state-machine.ts` — handleStageResult (line 555), main loop (line 118), verify-fix loop (line 587)
- `scripts/cody/engine/status.ts` — writeState (line 67), updateStage, loadState
- `scripts/cody/handlers/agent-handler.ts` — execute method, result mapping
- `scripts/cody/agent-runner.ts` — runAgentWithFileWatch result interface, what fields it returns
- `scripts/cody/pipeline/post-actions.ts` — executePostAction switch, validate-src-changes case
- `scripts/cody/cody-utils.ts` — all sections to understand extraction boundaries
- `scripts/cody/pipeline-utils.ts` — all sections to understand extraction boundaries
- `scripts/cody/entry.ts` — mode handlers (lines 412-971), catch block (345-397), signal handler (178-254)
- `scripts/cody/preflight.ts` — existing preflight check pattern

## Key Signatures
- `handleStageResult(ctx, state, stageName, result, def): Promise<PipelineStateV2>` from `engine/state-machine.ts:555`
- `updateStage(state, stageName, updates): PipelineStateV2` from `engine/status.ts`
- `writeState(taskId, state): void` from `engine/status.ts:67`
- `loadState(taskId): PipelineStateV2 | null` from `engine/status.ts`
- `completeState(state, outcome): PipelineStateV2` from `engine/status.ts`
- `executePostAction(ctx, action, state): Promise<void>` from `pipeline/post-actions.ts`
- `runAgentWithFileWatch(input, agent, outputFile, timeout, options): Promise<AgentRunResult>` from `agent-runner.ts`
- `AgentRunResult` — has `succeeded`, `timedOut`, `retries`, `tokenUsage`, `cost`, `sessionId`, `validationErrors?`, `exitCode?`
- `parseCliArgs(argv: string[]): CodyInput` from `cody-utils.ts:409`
- `parseCommentBody(body: string): Partial<CodyInput>` from `cody-utils.ts:858`
- `formatDuration(ms: number): string` from `cody-utils.ts`
- `formatStatusCommentV2(state: PipelineStateV2): string` from `cody-utils.ts`
- `readTask(taskDir: string): TaskDefinition` from `pipeline-utils.ts`
- `normalizeTask(raw: unknown): TaskDefinition` from `pipeline-utils.ts`
- `TaskDefinitionSchema` (Zod) from `pipeline-utils.ts`
- `getComplexityTier(score: number): ComplexityTier` from `pipeline-utils.ts`
- `resolveControlMode(taskDef, override)` from `pipeline-utils.ts`
- `resolvePipelineProfile(taskDef)` from `pipeline-utils.ts`
- `postComment(issueNumber, body)` from `github-api.ts`
- `setLifecycleLabel(issueNumber, label)` from `github-api.ts`
- `runPreflightChecks()` from `preflight.ts`
- `StageName` from `stages/registry.ts` (Phase 1)
- `MAX_PIPELINE_LOOP_ITERATIONS` from `config/constants.ts` (new)

## Reuse Inventory
- `createStageLogger(stage, taskId)` from `logger.ts:45` — reuse for stage-scoped logging
- `updateStage()` from `engine/status.ts` — reuse for writing `elapsed` field
- `StageName` from `stages/registry.ts` (Phase 1) — use for typed stage references
- `ciGroup`/`ciGroupEnd` from `logger.ts` — extend for sub-groups
- `postComment`/`editComment` from `github-api.ts` — use for enriched failure comments
- Existing `preflight.ts` pattern — extend for LLM key checks

## Integration Points
- `config/constants.ts` MUST be a leaf dependency — zero imports from other cody modules
- `cli-parser.ts` imports `CodyInput` from `cody-utils.ts` (after slimming)
- `status-format.ts` imports `PipelineStateV2` from `engine/types.ts`
- `modes/*.ts` each import from `engine/pipeline-resolver`, `engine/status`, `pipeline-utils`, `git-utils` etc. as needed
- `pipeline/task-schema.ts` exports `TaskDefinition` and Zod schema — imported by `task-io.ts` and `definitions.ts`
- `pipeline/complexity.ts` imports `getStageComplexityThreshold` from `stages/registry.ts` (Phase 1)
- `entry.ts` imports mode handlers from `modes/index.ts`
- All consumers importing from `cody-utils` must be checked: some need to switch to `cli-parser`, `status-format`, or `github-api`

## Imports Verified
- `entry.ts:389` dynamically imports `setLifecycleLabel` from `./github-api` ✅
- `entry.ts:391` calls `postComment` — imported at top of file from `./cody-utils` (re-export) ✅
- `agent-handler.ts:13` imports `runAgentWithFileWatch` from `../agent-runner` ✅
- `agent-handler.ts:14` imports `stageOutputFile` from `../pipeline-utils` ✅ (moved to registry in Phase 1)
- `state-machine.ts` imports `updateStage`, `writeState` from `./status` ✅
- `cody-utils.ts:14` imports `ALL_STAGES` from `./stage-prompts` ✅ (changed to registry in Phase 1)
- `cody-utils.ts:15` imports `discoverTaskIdFromIssue` from `./github-api` ✅
- `cody-utils.ts:388-403` re-exports 12 functions from `./github-api` ✅
- `logger.ts:10` imports `getEnv` from `./env` ✅
- `preflight.ts` exists and exports `runPreflightChecks` ✅
