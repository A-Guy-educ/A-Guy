# Build Agent Report: 260221-plan-gap-replace

## Changes

- **Created** `.opencode/agents/plan-gap.md` - New agent that analyzes plan.md for gaps vs spec and codebase, auto-revises plan directly
- **Deleted** `.opencode/agents/plan-review.md` - Removed read-only PASS/FAIL gate agent
- **Modified** `.opencode/agents/architect.md` - Removed `plan-review.rejected.md` from inputs and deleted "Plan-review rejection" section
- **Modified** `.opencode/agents/build.md` - Changed reference from `plan-review.md` to `plan-gap.md`
- **Modified** `opencode.json` - Replaced `plan-review` agent config with `plan-gap` (same Gemini 2.5 Flash model)
- **Modified** `scripts/cody/pipeline-utils.ts` - Renamed stage output map, DRY_RUN_OUTPUTS, IMPL_PIPELINE from `plan-review` to `plan-gap`
- **Modified** `scripts/cody/stage-prompts.ts` - Updated ALL_STAGES, STAGE_CONTEXT_FILES, stageInstructions, getImplStages
- **Modified** `scripts/cody/agent-runner.ts` - Changed timeout from 10 min to 15 min for plan-gap
- **Modified** `scripts/cody/content-validators.ts` - Removed plan-review validators, added validatePlanGapReport
- **Modified** `scripts/cody/stage-hooks.ts` - Removed PlanReviewFailError and handlePlanReviewGate, added handlePlanGapValidation
- **Modified** `scripts/cody/cody.ts` - Replaced post-stage hook from plan-review to plan-gap, deleted ~35-line retry loop
- **Modified** `.opencode/PIPELINE.md` - Updated all references, rewrote plan-gap section (no verdict, auto-revision, no retry loop)

## Tests Written

- `tests/unit/scripts/cody/stage-hooks.test.ts` - Rewrote to test handlePlanGapValidation instead of handlePlanReviewGate
- `tests/unit/scripts/cody/content-validators.test.ts` - Added tests for validatePlanGapReport, removed plan-review tests

## Quality

- TypeScript: PASS (pre-existing warnings unrelated to changes)
- Lint: PASS (pre-existing warnings unrelated to changes)
- Unit Tests: PASS (1862 tests passed)

## Summary

Replaced the read-only `plan-review` gate with a self-healing `plan-gap` agent. The new agent:
- Reads spec.md, plan.md, task.json
- Explores codebase for task domain
- Identifies gaps (missing requirements, wrong paths, constraints)
- **Edits plan.md directly** to fix gaps
- Writes plan-gap.md as a report

This eliminates the expensive architect retry loop (was up to 2 retries on FAIL). Pipeline is now:
```
architect → plan-gap → build → commit → verify → auditor → apply-audit → pr
```

Net: ~137 lines changed (251 added, 388 deleted), simpler pipeline, self-healing plan stage.
