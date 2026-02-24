# Build Agent Report: 260223-cody-lightweight-pipeline

## Changes

- **scripts/cody/pipeline-utils.ts**: Added `pipeline_profile` to TaskDefinition interface, added `VALID_PIPELINE_PROFILES` constant, added `resolvePipelineProfile()` function to determine profile from task_type and risk_level, added `LIGHTWEIGHT_IMPL_PIPELINE` constant with reduced stages, added `getImplPipeline()`, `getAllImplStageNames()`, `getSpecStagesForProfile()` helper functions
- **scripts/cody/cody.ts**: Updated `runSpecPipeline` to resolve profile after taskify and determine remaining stages dynamically, updated `runImplPipeline` to use profile-aware pipeline selection, updated `runRerunPipeline` to use profile-aware stage names for deletion
- **scripts/cody/stage-prompts.ts**: Updated `getSpecStages()` and `getImplStages()` to accept optional `profile` parameter for backward compatibility
- **.opencode/agents/taskify.md**: Added `pipeline_profile` to output contract JSON, added decision criteria for lightweight vs standard, added instructions for lightweight task promotion (writing spec.md)

## Tests Written

- `tests/unit/scripts/cody/pipeline-utils.test.ts`: 12 new tests for `resolvePipelineProfile` function and pipeline_profile validation
- `tests/unit/scripts/cody/stage-prompts.test.ts`: 3 new tests for profile-aware stage list functions
- `tests/unit/scripts/cody/lightweight-pipeline.integration.test.ts`: 30 new integration tests for end-to-end lightweight pipeline behavior

## Quality

- TypeScript: PASS
- Lint: PASS
- Prettier: PASS
- Build: PASS
- Unit Tests: PASS (2340 tests)

## Summary

Successfully implemented the Cody lightweight pipeline feature. For simple fixes (low-risk bug fixes, refactors, and ops tasks), the pipeline now skips 5 heavyweight stages: `spec`, `gap`, `plan-gap`, `auditor`, `apply-audit`. This saves 5-6 LLM calls per task (~20-60 minutes). The standard pipeline remains unchanged for complex tasks.
