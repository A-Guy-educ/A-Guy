# Build Agent Report: gap-stage-implementation

## Changes

- **`.opencode/agents/gap.md`** - Created new gap agent with system prompt for analyzing spec vs codebase and auto-revising spec
- **`scripts/cody/stage-prompts.ts`** - Added `gap` to SPEC_STAGES, ALL_STAGES, STAGE_CONTEXT_FILES, and stageInstructions
- **`scripts/cody/pipeline-utils.ts`** - Added `gap` to SPEC_ONLY_STAGES, STAGE_OUTPUT_MAP, and DRY_RUN_OUTPUTS
- **`scripts/cody/content-validators.ts`** - Added `validateGapReport()` function for gap.md content validation
- **`scripts/cody/agent-runner.ts`** - Added gap stage timeout (15 minutes)
- **`scripts/cody/cody.ts`** - Added gap stage to spec pipeline (taskify → spec → gap → [clarify]) with post-gap validation
- **`scripts/cody/cody-utils.ts`** - Added `gap` to VALID_STAGES for stage validation
- **`.github/workflows/cody.yml`** - No changes needed (workflow already handles new stages automatically)

## Tests Written

- `tests/unit/scripts/cody/content-validators.test.ts` - Added validateGapReport tests (6 test cases)
- `tests/unit/scripts/cody/pipeline-utils.test.ts` - Added gap stage registration tests (5 test cases) + stage-prompts tests (3 test cases)
- `tests/unit/scripts/cody/cody-utils-extended.test.ts` - Added 'gap' to isValidStage valid stages
- `tests/unit/scripts/cody.spec.ts` - Added gap stage in spec pipeline tests (5 test cases)
- `tests/int/scripts/cody.int.spec.ts` - Added gap stage integration tests (5 test cases)
- `tests/unit/scripts/cody/stage-prompts.test.ts` - Updated existing tests to include gap (4 test updates)
- `tests/unit/scripts/cody/bugfixes.test.ts` - Updated SPEC_ONLY_STAGES test (1 test update)
- `tests/unit/scripts/cody/bug-exposure.test.ts` - Fixed pre-existing build timeout test (1 test fix)

## Quality

- TypeScript: PASS
- Lint: PASS (all warnings are pre-existing in codebase)
- Unit Tests: 1852 passed

## Pipeline Flow (Updated)

```
taskify → [hard-stop gate] → spec → gap → [clarify] → architect → plan-review → build → commit → verify → auditor → apply-audit → pr
```

## Gap Stage Behavior

1. **Input**: Reads spec.md and task.json
2. **Analysis**: Explores codebase to identify gaps (missing requirements, conflicting patterns, overlooked dependencies)
3. **Output**: 
   - Rewrites spec.md with any missing requirements/constraints
   - Writes gap.md documenting findings
4. **Validation**: 
   - Validates gap.md has required sections
   - Re-validates spec.md after revision to ensure it wasn't corrupted

## Edge Cases Handled

- If no gaps found: writes minimal "No gaps identified" gap.md, leaves spec.md unchanged
- If spec.md corrupted by gap agent: pipeline fails with clear error
- If gap.md is invalid: pipeline fails with clear error
- Idempotency: if gap.md already exists, stage is skipped (consistent with other stages)
