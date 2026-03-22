# Codebase Context: pipeline-stabilization

## Files to Modify
- `scripts/cody/engine/types.ts` (lines 50-51, 82, 84-85, 161, 174-175) — narrow `string` types to `StageName`
- `scripts/cody/handlers/handler.ts` (line 29) — narrow `getHandler` parameter to `StageName`
- `scripts/cody/pipeline-utils.ts` (lines 36-39, 66-80, 765-779, 783, 806, 878-954) — delete scattered maps and dead code
- `scripts/cody/agent-runner.ts` (lines 65-80) — delete `STAGE_TIMEOUTS`, import from registry
- `scripts/cody/stage-prompts.ts` (lines 12, 21-46, 69-116) — delete `ALL_STAGES`, `Stage`, `STAGE_CONTEXT_FILES`, import from registry
- `scripts/cody/pipeline/definitions.ts` (lines 17, 36-37, 42-82) — delete local order arrays, import from registry
- `scripts/cody/pipeline/skip-conditions.ts` (line 12) — update import source
- `scripts/cody/pipeline/post-actions.ts` (line 29) — update timeout import
- `scripts/cody/cody-utils.ts` (line 14) — update `ALL_STAGES` import to registry
- `scripts/cody/rerun-utils.ts` (line 7) — update `ALL_STAGES` import to registry
- `scripts/cody/engine/pipeline-resolver.ts` — may need import updates
- `scripts/cody/entry.ts` — update string literals to StageName
- `scripts/cody/engine/status.ts` — update `stageOutputFile` import
- `scripts/cody/handlers/agent-handler.ts` — update `stageOutputFile` import
- `scripts/cody/README.md` — update architecture docs
- `eslint-plugin-aguy/index.js` → `.mjs` (MODIFIED — CJS to ESM)
- `eslint-plugin-aguy/rules/*.js` → `.mjs` (MODIFIED — CJS to ESM, 5 files)
- `eslint.config.mjs` (lines 12-14, 41-45) — enable custom plugin
- `tests/unit/scripts/cody/pipeline-bugfixes.test.ts` — remove source audit tests
- `tests/unit/scripts/cody/pipeline-bugfixes-round2.test.ts` — remove source audit tests
- `tests/unit/scripts/cody/pipeline-bugfixes-round3.test.ts` — remove source audit tests
- `tests/unit/scripts/cody/cody-utils-security.test.ts` — DELETE entirely
- `tests/unit/scripts/cody/git-utils.test.ts` — refactor brittle mocks
- `tests/unit/scripts/cody/agent-runner.test.ts` — refactor brittle mocks
- `tests/unit/scripts/cody/stage-prompts.test.ts` — update imports
- `tests/unit/scripts/cody/pipeline-utils.test.ts` — delete tests for removed exports
- ~10 other test files — update imports for ALL_STAGES, STAGE_TIMEOUTS, etc.

## Files to Create
- `scripts/cody/stages/registry.ts` (NEW) — single source of truth for all stage metadata
- `tests/unit/scripts/cody/stage-registry.test.ts` (NEW) — registry contract tests
- `tests/int/scripts/cody/state-machine.int.spec.ts` (NEW) — state machine integration tests
- `tests/int/scripts/cody/entry-modes.int.spec.ts` (NEW) — entry mode routing tests
- `tests/helpers/cody/mock-logger.ts` (NEW) — shared mock logger
- `tests/helpers/cody/fixtures.ts` (NEW) — shared test fixtures
- `tests/helpers/cody/pipeline-test-harness.ts` (NEW) — pipeline context factory
- `tests/helpers/cody/index.ts` (NEW) — barrel export
- `eslint-plugin-aguy/rules/no-exec-sync.mjs` (NEW) — security lint rule
- `tests/unit/eslint-plugin-aguy/no-exec-sync.test.ts` (NEW) — lint rule tests

## Files to Read (reference patterns)
- `scripts/cody/engine/state-machine.ts` — execution loop, resolveNextStep, verify-fix loop
- `scripts/cody/engine/pipeline-resolver.ts` — resolvePipelineForMode, createRebuildCallback
- `scripts/cody/pipeline/validators.ts` — validator pattern for stages
- `tests/unit/scripts/cody/engine/integration.test.ts` — existing engine integration test pattern
- `tests/unit/scripts/cody/pipeline-cli-contract.test.ts` — contract test pattern (good example)
- `tests/int/scripts/cody.int.spec.ts` — existing integration test pattern
- `eslint-plugin-aguy/rules/require-collection-access.js` — existing ESLint rule pattern

## Key Signatures
- `StageDefinition.name: string` from `scripts/cody/engine/types.ts:51` → change to `StageName`
- `PipelineStep = string | { parallel: string[] }` from `scripts/cody/engine/types.ts:82` → change to `StageName | { parallel: StageName[] }`
- `PipelineDefinition.stages: Map<string, StageDefinition>` from `scripts/cody/engine/types.ts:85` → change to `Map<StageName, StageDefinition>`
- `getHandler(stageName: string, stageType: StageType): StageHandler` from `scripts/cody/handlers/handler.ts:29`
- `buildStagePrompt(stage: string, ...)` from `scripts/cody/stage-prompts.ts`
- `stageOutputFile(taskDir: string, stage: string): string` from `scripts/cody/pipeline-utils.ts:776`
- `readTask(taskDir: string)` from `scripts/cody/pipeline-utils.ts` — keep, no changes
- `runPipeline(ctx, pipeline, hooks, rebuildCallback)` from `scripts/cody/engine/state-machine.ts`
- `resolvePipelineForMode(mode, ctx, ...)` from `scripts/cody/engine/pipeline-resolver.ts`
- `buildPipeline(mode, profile, ctx)` from `scripts/cody/pipeline/definitions.ts`
- `createStageDefinitions(ctx)` from `scripts/cody/pipeline/definitions.ts:90`
- `ALL_STAGES` from `scripts/cody/stage-prompts.ts:29` → replaced by `STAGE_NAMES` from registry
- `STAGE_TIMEOUTS` from `scripts/cody/agent-runner.ts:65` → replaced by `getStageTimeout()` from registry
- `STAGE_COMPLEXITY_THRESHOLDS` from `scripts/cody/pipeline-utils.ts:66` → replaced by `getStageComplexityThreshold()` from registry
- `STAGE_OUTPUT_MAP` from `scripts/cody/pipeline-utils.ts:765` → replaced by `getStageOutputFile()` from registry
- `IMPL_ORDER_STANDARD` from `scripts/cody/pipeline/definitions.ts:44` → moved to registry
- `IMPL_ORDER_LIGHTWEIGHT` from `scripts/cody/pipeline/definitions.ts:57` → moved to registry
- `FIX_ORDER` from `scripts/cody/pipeline/definitions.ts:68` → moved to registry
- `IMPL_PIPELINE` from `scripts/cody/pipeline-utils.ts:878` → DELETE (dead code, already diverged)
- `getAllImplStageNames()` from `scripts/cody/pipeline-utils.ts:932` → DELETE
- `getImplPipeline()` from `scripts/cody/pipeline-utils.ts:925` → DELETE (zero callers)
- `getSpecStagesForProfile()` from `scripts/cody/pipeline-utils.ts:942` → move to registry

## Reuse Inventory
- `ms` from `ms` package — reuse for timeout values in registry (already used in agent-runner.ts)
- `flattenPipeline()` from `scripts/cody/pipeline-utils.ts:863` — keep in pipeline-utils, type-narrow to use StageName
- `isParallelStage()` from `scripts/cody/pipeline-utils.ts:845` — keep in pipeline-utils, type-narrow
- `flattenStage()` from `scripts/cody/pipeline-utils.ts:853` — keep in pipeline-utils, type-narrow
- `PipelineStateV2Schema` from `scripts/cody/engine/types.ts:191` — keep as-is (uses `z.record(z.string(), ...)` for backward compat)
- ESLint `RuleTester` from `eslint` — use for testing custom lint rules
- `eslint-plugin-aguy/` existing 5 rules — extend with new rule, reuse pattern

## Integration Points
- `scripts/cody/stages/registry.ts` MUST be a leaf dependency — zero imports from other cody modules
- `scripts/cody/engine/types.ts` imports StageName from registry → all downstream engine files get the type
- `scripts/cody/pipeline/definitions.ts` imports pipeline orders from registry → buildPipeline uses them
- `scripts/cody/stage-prompts.ts` imports STAGE_NAMES and getStageContextFiles from registry
- `scripts/cody/cody-utils.ts` imports STAGE_NAMES from registry (replaces ALL_STAGES from stage-prompts)
- `eslint.config.mjs` imports plugin from `eslint-plugin-aguy/index.mjs`
- Tests import shared helpers from `tests/helpers/cody/`
- `vitest.config.cody-int.mts` — integration tests must be discoverable by this config

## Imports Verified
- `scripts/cody/engine/types.ts` currently imports from `../cody-utils`, `../pipeline-utils`, `../agent-runner` ✅
- `scripts/cody/pipeline/definitions.ts` currently imports `STAGE_TIMEOUTS` from `../agent-runner` (line 17) ✅
- `scripts/cody/pipeline/definitions.ts` currently imports `STAGE_COMPLEXITY_THRESHOLDS` from `../pipeline-utils` (line 36) ✅
- `scripts/cody/stage-prompts.ts` currently imports `stageOutputFile`, `getSpecStagesForProfile`, `getAllImplStageNames` from `./pipeline-utils` (line 12) ✅
- `scripts/cody/cody-utils.ts` currently imports `ALL_STAGES` from `./stage-prompts` (line 14) ✅
- `scripts/cody/rerun-utils.ts` currently imports `ALL_STAGES` from `./stage-prompts` (line 7) ✅
- `scripts/cody/handlers/handler.ts` currently imports types from `../engine/types` (line 8) ✅
- `scripts/cody/handlers/agent-handler.ts` imports `stageOutputFile` from `../pipeline-utils` ✅
- `scripts/cody/engine/status.ts` imports `stageOutputFile` from `../pipeline-utils` ✅
- `eslint-plugin-aguy/index.js` exists as CJS module ✅
- `eslint.config.mjs` has commented-out TODO for plugin activation (lines 12-14, 41-45) ✅
