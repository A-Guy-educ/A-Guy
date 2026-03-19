# Codebase Context: fix-canary-rerun-git

## Files to Modify
- `scripts/cody/modes/rerun.ts` (line 41) — add `!input.dryRun` guard to GITHUB_ACTIONS check

## Files to Read (reference patterns)
- `tests/canary/pipeline-canary.test.ts` (lines 220-250) — the failing test that validates the fix
- `scripts/cody/git-utils.ts` (line 191) — `checkoutTaskBranch` function that crashes

## Key Signatures
- `runRerunMode(ctx: PipelineContext): Promise<void>` from `scripts/cody/modes/rerun.ts`
- `checkoutTaskBranch(taskId: string, taskDir?: string): boolean` from `scripts/cody/git-utils.ts`
- `ctx.input.dryRun: boolean` — flag indicating dry-run mode (no side effects)

## Reuse Inventory
- `ctx.input.dryRun` — existing boolean on PipelineContext.input, already used at line 90

## Integration Points
- Canary test suite: `pnpm test:canary` runs `vitest run --config ./vitest.config.canary.mts`
- The rerun test at line 220 exercises `main()` with `['--task-id', taskId, '--mode', 'rerun', '--from', 'build', '--dry-run', '--local']`

## Imports Verified
- `checkoutTaskBranch` imported from `../git-utils` in rerun.ts ✅
- `PipelineContext` imported from `../engine/types` in rerun.ts ✅
- `input.dryRun` field available on context — used at line 90 ✅
