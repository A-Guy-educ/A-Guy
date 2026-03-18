# Codebase Context: 260315-auto-599

## Files to Modify
- `scripts/cody/rerun-utils.ts` (lines 1, 69+) — Add ALL_STAGES import, add findNearestEarlierStage function
- `scripts/cody/entry.ts` (lines 39, 716-722) — Add import, replace throw with fallback
- `tests/unit/scripts/cody/rerun-gate-approval.test.ts` (lines 19, 228+) — Add import + new describe block

## Files to Read (reference patterns)
- `scripts/cody/rerun-utils.ts` — Pure function pattern for pipeline utilities
- `scripts/cody/stage-prompts.ts` (lines 29-44) — ALL_STAGES constant definition
- `tests/unit/scripts/cody/rerun-gate-approval.test.ts` — Test fixture pattern (createBaseState, createStage, describe blocks)
- `scripts/cody/entry.ts` (lines 680-737) — runRerunMode function context

## Key Signatures
- `export function findNearestEarlierStage(missingStage: string, pipelineOrder: string[]): string` — NEW in `scripts/cody/rerun-utils.ts`
- `export function resolveRerunFromStage(fromStage: string, feedback: string | undefined, implStages: string[]): string` from `scripts/cody/rerun-utils.ts`
- `export function resolveFromStageAfterGateApproval(approvedStage: string, pipelineOrder: string[]): string` from `scripts/cody/rerun-utils.ts`
- `export const ALL_STAGES = ['taskify', 'gap', 'clarify', 'architect', 'plan-gap', 'test', 'build', 'commit', 'review', 'fix', 'verify', 'autofix', 'docs', 'pr'] as const` from `scripts/cody/stage-prompts.ts`
- `export function flattenPipelineOrder(order): string[]` from `scripts/cody/pipeline/definitions.ts`
- `logger` from `scripts/cody/logger` — already imported in entry.ts

## Reuse Inventory
- `ALL_STAGES` from `scripts/cody/stage-prompts` — canonical stage ordering for walkback logic
- `logger` from `scripts/cody/logger` — for `.warn()` fallback message in entry.ts
- Test fixture functions `createBaseState`, `createStage` from existing test file — reuse for new test cases if needed
- Existing import line 39 in entry.ts — extend with `findNearestEarlierStage`

## Integration Points
- `entry.ts` line 717-722: `const fromStage` → `let fromStage` + fallback (downstream use at line 729)
- `entry.ts` line 39: Add `findNearestEarlierStage` to existing `import { ... } from './rerun-utils'`
- `rerun-utils.ts` line 1: Add `import { ALL_STAGES } from './stage-prompts'`
- Test file line 19: Add `findNearestEarlierStage` to existing import from `rerun-utils`

## Imports Verified
- `scripts/cody/stage-prompts` → exports `ALL_STAGES` as const ✅
- `scripts/cody/rerun-utils` → exports `resolveRerunFromStage`, `resolveFromStageAfterGateApproval` ✅
- `scripts/cody/logger` → exports `logger` ✅ (already imported in entry.ts line 28)
- `scripts/cody/engine/status` → exports `resetFromStage` ✅ (dynamic import at entry.ts line 724)

## Test Commands
```bash
# Run specific test file
pnpm vitest run tests/unit/scripts/cody/rerun-gate-approval.test.ts

# Type check
pnpm -s tsc --noEmit
```

## Lightweight Pipeline Stage Orders (for reference in tests)
- **Standard**: `['taskify', 'gap', 'clarify', 'architect', 'plan-gap', 'build', 'commit', 'verify', 'pr']`
- **Lightweight**: `['taskify', 'clarify', 'architect', 'build', 'commit', 'verify', 'pr']`
- These are used in the existing test file and should be reused for new tests.
