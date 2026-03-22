# Codebase Context: pipeline-stabilization-p2

## Files to Modify
- `scripts/cody/entry.ts` (lines 374-384) — wrap GitHub API calls in try/catch in main catch block
- `scripts/cody/handlers/agent-handler.ts` (lines 63-67) — enrich failure reason with validation errors and artifact paths
- `scripts/cody/pipeline/post-actions.ts` (lines 257-270) — fix misleading error on git failure in validate-src-changes
- `scripts/cody/pipeline/post-actions.ts` (lines 611-612) — throw on unknown post-action type
- `scripts/cody/engine/state-machine.ts` (lines 557-668) — compute and write `elapsed` field in handleStageResult
- `scripts/cody/engine/state-machine.ts` (lines 112-113) — add loop iteration guard (loopCount already exists, add MAX check)
- `scripts/cody/logger.ts` (lines 77-205) — delete dead legacy logging code (130 lines, zero callers)
- `scripts/cody/cody-utils.ts` (lines 135-366) — delete deprecated v1 status FUNCTIONS (keep types, keep getLastFailedStage/getLastPausedStage)
- `scripts/cody/cody-utils.ts` (lines 373-386) — delete re-exports from github-api
- `scripts/cody/cody-utils.ts` (lines 392-1004) — extract to cli-parser.ts
- `scripts/cody/cody-utils.ts` (lines 1026-1125) — extract to status-format.ts
- `scripts/cody/pipeline-utils.ts` (lines 10-696) — extract task schemas/validation to pipeline/task-schema.ts
- `scripts/cody/pipeline-utils.ts` (lines 698-741) — extract readTask to pipeline/task-io.ts
- `scripts/cody/pipeline-utils.ts` (lines 61-139) — extract complexity to pipeline/complexity.ts
- `scripts/cody/entry.ts` (lines 400-865) — extract 6 mode handlers to modes/*.ts
- `scripts/cody/preflight.ts` — add LLM key and opencode.json validation
- `scripts/cody/clarify-workflow.ts` (line 11) — update imports from cody-utils → github-api

## Files to Create
- `scripts/cody/config/constants.ts` (NEW) — named constants for all magic numbers
- `scripts/cody/cli-parser.ts` (NEW) — parseCliArgs extracted from cody-utils
- `scripts/cody/status-format.ts` (NEW) — formatDuration, formatStatusComment* extracted from cody-utils
- `scripts/cody/modes/spec.ts` (NEW) — runSpecMode extracted from entry.ts
- `scripts/cody/modes/impl.ts` (NEW) — runImplMode extracted from entry.ts
- `scripts/cody/modes/full.ts` (NEW) — runFullMode extracted from entry.ts
- `scripts/cody/modes/rerun.ts` (NEW) — runRerunMode extracted from entry.ts
- `scripts/cody/modes/fix.ts` (NEW) — runFixMode extracted from entry.ts
- `scripts/cody/modes/status.ts` (NEW) — runStatusMode extracted from entry.ts
- `scripts/cody/modes/index.ts` (NEW) — barrel export
- `scripts/cody/pipeline/task-schema.ts` (NEW) — TaskDefinition, Zod schemas, normalization, validation
- `scripts/cody/pipeline/task-io.ts` (NEW) — readTask file I/O
- `scripts/cody/pipeline/complexity.ts` (NEW) — complexity scoring, tiers, control modes
- `tests/unit/scripts/cody/error-handling.test.ts` (NEW) — tests for Step 1
- `tests/unit/scripts/cody/duration-tracking.test.ts` (NEW) — tests for Step 2
- `tests/unit/scripts/cody/constants.test.ts` (NEW) — tests for Step 4
- `tests/unit/scripts/cody/loop-guard.test.ts` (NEW) — tests for Step 5
- `tests/unit/scripts/cody/preflight.test.ts` (NEW) — tests for Step 9

## Files to Read (reference patterns)
- `scripts/cody/engine/state-machine.ts` — handleStageResult (line 550), main loop (line 112), verify-fix loop
- `scripts/cody/engine/status.ts` — writeState (line 67), updateStage, loadState, completeState
- `scripts/cody/engine/types.ts` — StageResult (line 19), StageDefinition, StageStateV2 (check for `elapsed` field)
- `scripts/cody/handlers/agent-handler.ts` — execute method, result mapping
- `scripts/cody/agent-runner.ts` — AgentRunResult (line 105): has `validationErrors`, NO `exitCode`
- `scripts/cody/pipeline/post-actions.ts` — executePostAction switch, validate-src-changes case
- `scripts/cody/cody-utils.ts` — all sections to understand extraction boundaries
- `scripts/cody/pipeline-utils.ts` — all sections to understand extraction boundaries
- `scripts/cody/entry.ts` — mode handlers (lines 400-865), catch block (333-386)
- `scripts/cody/preflight.ts` — existing preflight check pattern (86 lines)

## Key Signatures
- `handleStageResult(ctx, state, stageName, result, def): Promise<PipelineStateV2>` from `engine/state-machine.ts:550`
- `updateStage(state, stageName, updates): PipelineStateV2` from `engine/status.ts`
- `writeState(taskId, state): void` from `engine/status.ts`
- `loadState(taskId): PipelineStateV2 | null` from `engine/status.ts`
- `completeState(state, outcome): PipelineStateV2` from `engine/status.ts`
- `executePostAction(ctx, action, state): Promise<void>` from `pipeline/post-actions.ts`
- `runAgentWithFileWatch(input, name, outputFile, timeout, options): Promise<AgentRunResult>` from `agent-runner.ts`
- `AgentRunResult` — has `succeeded`, `timedOut`, `retries`, `tokenUsage`, `cost`, `sessionId`, `validationErrors?` — NO `exitCode`
- `StageResult` — has `outcome`, `reason?`, `retries`, `outputFile?`, `tokenUsage?`, `cost?`, `sessionId?`
- `StageDefinition` — has `name`, `timeout`, `agentName?`, `validator?`, `maxRetries?`, `postActions?`, `advisory?`, `fallbackOnMissingOutput?`
- `parseCliArgs(argv: string[]): CodyInput` from `cody-utils.ts:392`
- `formatDuration(ms: number): string` from `cody-utils.ts:1026`
- `formatStatusComment(input, status, currentStage?, currentState?): string` from `cody-utils.ts:1037`
- `formatStatusCommentV2(input, stateV2): Promise<string>` from `cody-utils.ts:1121`
- `readTask(taskDir: string): TaskDefinition | null` from `pipeline-utils.ts:698`
- `normalizeTask(raw: Record<string, unknown>): Record<string, unknown>` from `pipeline-utils.ts:455`
- `TaskDefinitionSchema` (Zod) from `pipeline-utils.ts:214`
- `getComplexityTier(score: number): ComplexityTier` from `pipeline-utils.ts:67`
- `resolveControlMode(taskDef, override)` from `pipeline-utils.ts:96`
- `resolvePipelineProfile(taskDef)` from `pipeline-utils.ts:111`
- `postComment(issueNumber, body)` from `github-api.ts`
- `setLifecycleLabel(issueNumber, label)` from `github-api.ts`
- `preflight()` from `preflight.ts`
- `StageName` from `stages/registry.ts` (Phase 1)

## Reuse Inventory
- `createStageLogger(stage, taskId)` from `logger.ts:45` — reuse for stage-scoped logging
- `updateStage()` from `engine/status.ts` — reuse for writing `elapsed` field
- `completeState()` from `engine/status.ts` — reuse for marking pipeline failed
- `StageName` from `stages/registry.ts` (Phase 1) — use for typed stage references
- `ciGroup`/`ciGroupEnd` from `logger.ts` — CI log grouping
- `postComment`/`setLifecycleLabel` from `github-api.ts` — GitHub interactions

## Integration Points
- `config/constants.ts` MUST be a leaf dependency — zero imports from other cody modules
- `cli-parser.ts` imports `CodyInput`, `isValidMode`, `isValidStage`, `validateTaskId` from `cody-utils.ts`
- `status-format.ts` imports `CodyInput`, `CodyPipelineStatus`, `StageStatus` types from `cody-utils.ts`
- `modes/*.ts` each import from pipeline resolver, engine/status, pipeline-utils, git-utils as needed
- `pipeline/task-schema.ts` exports `TaskDefinition`, Zod schema — imported by `task-io.ts` and `definitions.ts`
- `pipeline/complexity.ts` imports `getStageComplexityThreshold` from `stages/registry.ts` (Phase 1)
- `entry.ts` imports mode handlers from `modes/index.ts`
- `clarify-workflow.ts:11` must switch `getLatestIssueComment`, `getLatestApprovalComment` from `cody-utils` to `github-api`
- `engine/status.ts:402` imports `CodyPipelineStatus`, `StageStatus` types from `cody-utils` — these types MUST stay
- `getLastFailedStage`, `getLastPausedStage` are NOT deprecated — used by entry.ts

## Imports Verified
- `entry.ts:41` imports `ensureTaskMarkerComment, postComment` from `./github-api` ✅ (already direct)
- `entry.ts:42` imports `formatStatusComment` from `./cody-utils` ✅ (will move to status-format)
- `entry.ts:24` imports `parseCliArgs, validateAuth, ensureTaskDir, getLastFailedStage, getLastPausedStage` from `./cody-utils` ✅
- `agent-handler.ts:13` imports `runAgentWithFileWatch` from `../agent-runner` ✅
- `agent-handler.ts:12` imports `StageDefinition, StageResult` from `../engine/types` ✅
- `state-machine.ts` imports `updateStage`, `writeState`, `completeState` from `./status` ✅
- `cody-utils.ts:14` imports `STAGE_NAMES` from `./stages/registry` ✅
- `cody-utils.ts:15` imports `discoverTaskIdFromIssue` from `./github-api` ✅
- `cody-utils.ts:373-386` re-exports 12 functions from `./github-api` ✅
- `logger.ts:10` imports `getEnv` from `./env` ✅
- `preflight.ts` exports `preflight` ✅
- `clarify-workflow.ts:11` imports `getLatestIssueComment, getLatestApprovalComment, type CodyInput` from `./cody-utils` ✅ (must update)
- `engine/status.ts:402` imports `type { CodyPipelineStatus, StageStatus }` from `../cody-utils` ✅ (types stay)

## Test Files That Need Import Updates
- `tests/unit/scripts/cody/commander-cli.test.ts:2` — `parseCliArgs` → from `cli-parser`
- `tests/unit/scripts/cody/pipeline-cli-contract.test.ts:31` — `parseCliArgs` → from `cli-parser`
- `tests/unit/scripts/cody/cost-tracking.test.ts:10-11` — `formatStatusComment` → from `status-format`
- `tests/unit/scripts/cody/cody-utils.test.ts:395` — `editComment` → from `github-api`
- `tests/unit/scripts/cody/cody-utils.test.ts:14` — check what's imported, split
- `tests/unit/scripts/cody/cody-utils-extended.test.ts:54` — check what's imported, split
- `tests/unit/scripts/cody/clarify-workflow.test.ts:17-18` — may need update if it mocks cody-utils re-exports
- `tests/helpers/cody/pipeline-test-harness.ts:10` — `CodyInput` type stays in cody-utils ✅

## StageStateV2 (check for elapsed field)
- Located in `scripts/cody/engine/types.ts`
- Verify it has `elapsed?: number` — if not, add it
