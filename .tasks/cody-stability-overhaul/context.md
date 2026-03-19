# Codebase Context: cody-stability-overhaul

## Files to Modify
- `scripts/cody/stages/registry.ts` (line 37) — Add STAGES constant after StageName type
- `scripts/cody/engine/types.ts` (line 76) — Add retryWith to StageDefinition interface
- `scripts/cody/engine/state-machine.ts` (lines 612-675, 699-710) — Replace hardcoded verify-fix loop with generic retry
- `scripts/cody/pipeline/definitions.ts` (lines 331-347) — Wire retryWith into verify stage
- `tests/unit/scripts/cody/stage-registry.test.ts` — Replace exact stage counts with structural assertions
- `tests/unit/scripts/cody/stage-prompts.test.ts` — Replace exact stage lists with toContain
- `tests/unit/scripts/cody/pipeline-utils.test.ts` — Replace hardcoded counts
- `tests/unit/scripts/cody/lightweight-pipeline.integration.test.ts` — Replace exact assertions
- `tests/unit/scripts/cody/post-actions.test.ts` — Use shared mock logger
- `tests/unit/scripts/cody/pipeline/post-action-feedback-loop.test.ts` — Use shared mock logger
- `tests/unit/scripts/cody/validate-src-changes.test.ts` — Use shared mock logger
- `tests/unit/scripts/cody/pipeline-bugfixes.test.ts` — Remove 4 no-op blocks
- `tests/helpers/cody/pipeline-test-harness.ts` — Add createTestPipeline, createMockHandler, assertPipelineValid
- `tests/helpers/cody/index.ts` — Update barrel exports
- `package.json` — Add lint:test-fragility script

## Files to Create (NEW)
- `scripts/cody/pipeline/verify-failures.ts` — Extracted verify failure capture logic
- `tests/unit/scripts/cody/cody-pure-utils.test.ts` — Pure function tests (0 mocks)
- `tests/unit/scripts/cody/handlers/verify-handler.test.ts` — ScriptedVerifyHandler tests
- `tests/unit/scripts/cody/handlers/pr-handler.test.ts` — PR handler tests
- `tests/unit/scripts/cody/pipeline/skip-conditions.test.ts` — Skip condition tests (0 mocks)
- `tests/unit/scripts/cody/engine/retry-loop.test.ts` — Declarative retry loop tests
- `tests/unit/scripts/cody/engine/parallel-execution.test.ts` — Parallel execution tests
- `tests/unit/scripts/cody/handlers/scripted-handler.test.ts` — Handler class tests
- `tests/unit/scripts/cody/pipeline/verify-failures.test.ts` — Verify failures extraction tests
- `tests/helpers/cody/assertions.ts` — Pipeline assertion helpers
- `tests/helpers/cody/TESTING-GUIDELINES.md` — Testing patterns doc
- `scripts/lint-test-fragility.ts` — CI lint script for test fragility

## Files to Delete
- `tests/unit/scripts/cody/error-handling.test.ts` — 12 mocks, fragile
- `tests/unit/scripts/cody/cody-utils-extended.test.ts` — 33 mocks, fragile
- `tests/unit/scripts/cody/scripted-stages.test.ts` — 10 mocks, 1462 lines
- `tests/int/scripts/cody.int.spec.ts` — ghost stages, outdated

## Files to Read (reference patterns)
- `scripts/cody/handlers/scripted-handler.ts` — ScriptedVerifyHandler pattern
- `scripts/cody/scripted-stages.ts` — runVerifyStage, runPrStage functions
- `scripts/cody/config/constants.ts` — Named constants
- `tests/helpers/cody/mock-logger.ts` — Shared mock logger pattern
- `tests/helpers/cody/fixtures.ts` — Test fixture pattern

## Key Signatures
- `runVerifyStage(outputFile, _taskJson?, timeout?, taskDir?)` from `scripts/cody/scripted-stages.ts`
- `runPrStage(ctx, _config?)` from `scripts/cody/scripted-stages.ts`
- `commitPipelineFiles(opts)` from `scripts/cody/git-utils.ts`
- `updateStage(state, stageName, update)` from `scripts/cody/engine/status`
- `writeState(taskId, state)` from `scripts/cody/engine/status`
- `loadState(taskId)` from `scripts/cody/engine/status`
- `handleStageResult(ctx, state, stageName, result, def)` from `scripts/cody/engine/state-machine.ts`
- `executeParallelStep(ctx, pipeline, state, stageNames)` from `scripts/cody/engine/state-machine.ts`
- `buildPipeline(mode, profile, clarify, ctx)` from `scripts/cody/pipeline/definitions.ts`
- `getHandler(name, type)` from `scripts/cody/handlers/handler.ts`

## Reuse Inventory
- `createMockLogger()` from `tests/helpers/cody/mock-logger.ts` — use in all new tests
- `createMockPipelineContext()` from `tests/helpers/cody/pipeline-test-harness.ts` — test context factory
- `createValidPipelineState()` from `tests/helpers/cody/fixtures.ts` — state factory
- `createValidTaskDefinition()` from `tests/helpers/cody/fixtures.ts` — task def factory
- `createMockRunnerBackend()` from `tests/helpers/cody/pipeline-test-harness.ts` — backend mock
- `DEFAULT_MAX_FIX_ATTEMPTS` from `scripts/cody/config/constants.ts` — retry constant
- `MAX_GATE_OUTPUT_CHARS` from `scripts/cody/config/constants.ts` — truncation constant

## Integration Points
- `STAGES` constant exports from `scripts/cody/stages/registry.ts` — used by new tests
- `retryWith` property on `StageDefinition` — consumed by `handleStageResult()` in state-machine.ts
- `captureVerifyFailures` imported by `definitions.ts` for verify stage's `retryWith.onFailure`
- `handleStageResult` needs `pipeline: PipelineDefinition` param for timeout recovery lookup

## Imports Verified
- `@/scripts/cody/stages/registry` → exports STAGE_NAMES, StageName, STAGE_REGISTRY ✅
- `@/scripts/cody/engine/types` → exports StageDefinition, PipelineContext, PipelineDefinition ✅
- `@/scripts/cody/engine/status` → exports updateStage, writeState, loadState ✅
- `@/scripts/cody/config/constants` → exports DEFAULT_MAX_FIX_ATTEMPTS, MAX_GATE_OUTPUT_CHARS ✅
- `@/tests/helpers/cody` → exports createMockLogger, createMockPipelineContext, fixtures ✅
