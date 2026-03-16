# Codebase Context: pipeline-stabilization Phase 3

## Files to Modify
- `scripts/cody/entry.ts` (line 397, 406) — add testability hook to avoid process.exit in tests
- `scripts/cody/engine/state-machine.ts` (lines 555-585 post-action tracking, line 588 retry logic) — post-action observability + declarative retry
- `scripts/cody/engine/types.ts` (StageStateV2, StageDefinition, PipelineContext) — add postActionLog, retryWithFix, stateStore
- `scripts/cody/pipeline/definitions.ts` (verify stage definition) — add retryWithFix policy
- `scripts/cody/engine/status.ts` — implement FileSystemStateStore wrapping existing functions
- `.github/workflows/cody.yml` (line ~280) — remove `|| true` from smoke test, add canary
- `package.json` — add `test:canary` script

## Files to Create
- `tests/canary/pipeline-canary.test.ts` (NEW) — 6 canary tests for all pipeline modes
- `vitest.config.canary.mts` (NEW) — canary test configuration
- `scripts/cody/engine/retry-policy.ts` (NEW) — RetryWithFixPolicy type + hasRetriesRemaining
- `scripts/cody/engine/state-store.ts` (NEW) — StateStore interface + FileSystemStateStore + InMemoryStateStore
- `tests/helpers/cody/test-runner.ts` (NEW) — TestRunner backend for tests
- `tests/helpers/cody/test-handler.ts` (NEW) — TestHandler for configurable stage results

## Files to Read (reference patterns)
- `tests/unit/scripts/cody/engine/integration.test.ts` — the only existing test that calls runPipeline(); use as pattern
- `scripts/cody/runner-backend.ts` (lines 27-36) — RunnerBackend interface for TestRunner
- `scripts/cody/handlers/handler.ts` — StageHandler interface for TestHandler
- `scripts/cody/engine/state-machine.ts` (lines 268-271) — dry-run shortcircuit pattern
- `scripts/cody/engine/state-machine.ts` (lines 578-584) — current post-action execution loop
- `scripts/cody/engine/state-machine.ts` (lines 587-648) — current hardcoded verify→fix retry loop
- `scripts/cody/engine/status.ts` (lines 67-87) — atomic writeState (to wrap in FileSystemStateStore)
- `scripts/cody/engine/status.ts` (lines 376-442) — resetFromStage with artifact deletion
- `.github/workflows/cody.yml` (lines 226-310) — current smoke test with `|| true`

## Key Signatures
- `main(argv?: string[]): Promise<void>` from `scripts/cody/entry.ts` — the entry point to test
- `runPipeline(ctx, pipeline, hooks?, rebuildPipeline?): Promise<PipelineStateV2>` from `engine/state-machine.ts`
- `resolveNextStep(pipeline, state): PipelineStep | null` from `engine/state-machine.ts`
- `handleStageResult(ctx, state, stageName, result, def): Promise<PipelineStateV2>` from `engine/state-machine.ts`
- `executePostAction(ctx, action, state): Promise<void>` from `pipeline/post-actions.ts`
- `RunnerBackend` interface: `{ name: string; spawn(stage, prompt, env, cwd, options?): ChildProcess }` from `runner-backend.ts`
- `StageHandler` interface: `{ execute(ctx, def): Promise<StageResult> }` from `handlers/handler.ts`
- `loadState(taskId): PipelineStateV2 | null` from `engine/status.ts`
- `writeState(taskId, state): void` from `engine/status.ts`
- `updateStage(state, stageName, updates): PipelineStateV2` from `engine/status.ts`
- `buildPipeline(mode, profile, ctx): PipelineDefinition` from `pipeline/definitions.ts`
- `StageName` from `stages/registry.ts` (Phase 1)
- `DEFAULT_MAX_FIX_ATTEMPTS` from `config/constants.ts` (Phase 2)

## Reuse Inventory
- `RunnerBackend` interface from `runner-backend.ts` — TestRunner implements this
- `StageHandler` interface from `handlers/handler.ts` — TestHandler implements this  
- `engine/integration.test.ts` mock pattern — reuse its approach of mocking getHandler
- `InMemoryStateStore` — new, replaces temp dir filesystem in tests
- `createMockPipelineContext()` from `tests/helpers/cody/` (Phase 1) — extend with stateStore
- `createMockLogger()` from `tests/helpers/cody/` (Phase 1) — reuse in canary tests
- Existing `PipelineStateV2Schema` Zod schema — extend for new optional fields (backward compatible)

## Integration Points
- `engine/state-store.ts` defines StateStore interface — imported by state-machine.ts, status.ts, entry.ts
- `engine/retry-policy.ts` defines RetryWithFixPolicy — imported by types.ts and state-machine.ts
- `PipelineContext.stateStore` is set in entry.ts (FileSystemStateStore) or tests (InMemoryStateStore)
- `StageDefinition.retryWithFix` is set in definitions.ts on verify stage
- `StageStateV2.postActionLog` and `currentPostAction` are new optional fields (Zod backward compat)
- Canary tests import `main()` from entry.ts — need testability hook to avoid process.exit
- CI workflow runs `pnpm test:canary` as a required check for cody file changes
- `vitest.config.canary.mts` must be separate config (canary tests need longer timeout than unit tests)

## Imports Verified
- `engine/state-machine.ts` imports `loadState`, `writeState`, `updateStage` from `./status` ✅
- `engine/state-machine.ts` imports `executePostAction` from `../pipeline/post-actions` ✅
- `engine/state-machine.ts:588` hardcodes `stageName === 'verify'` and `state.stages['fix']` ✅
- `entry.ts:406` calls `process.exit(0)` ✅
- `entry.ts:397` calls `process.exit(1)` ✅
- `runner-backend.ts:27-36` defines `RunnerBackend` interface ✅
- `handlers/handler.ts:17-19` defines `StageHandler` interface ✅
- `engine/integration.test.ts` mocks `getHandler` and calls `runPipeline` ✅
- `.github/workflows/cody.yml:~280` has `|| true` on smoke test ✅
- `vitest.config.cody-int.mts` exists ✅
