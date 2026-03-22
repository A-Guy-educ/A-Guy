# Codebase Context: 260315-auto-789

## Files to Modify
- `scripts/cody/entry.ts` (lines 598-649) — Extract `approveGate()` helper from explicit approval branch (610-637), add implicit approval in `'waiting'` branch (642-644)
- `tests/unit/scripts/cody/rerun-gate-approval.test.ts` (append after line 361) — Add new `describe` block with 2-3 test cases for implicit gate approval on rerun

## Files to Read (reference patterns)
- `scripts/cody/entry.ts` (lines 579-699) — Full `runRerunMode()` function showing gate approval flow and fromStage resolution
- `scripts/cody/clarify-workflow.ts` (lines 148-484) — `handleGateApproval()` implementation, `getGateFiles()`, `GateResult` type, `APPROVAL_KEYWORDS`
- `scripts/cody/engine/status.ts` (lines 352-366) — `resumeFromGate()` implementation
- `tests/unit/scripts/cody/rerun-gate-approval.test.ts` (full file) — Existing test fixtures (`createBaseState`, `createStage`) and test patterns for gate approval + resetFromStage interaction

## Key Signatures
- `handleGateApproval(input: CodyInput, taskDir: string, gatePoint: string, taskDef: { risk_level: string; task_type: string; confidence: number; scope: string[] }, planContent?: string): GateResult` from `scripts/cody/clarify-workflow.ts`
- `type GateResult = 'approved' | 'rejected' | 'waiting'` from `scripts/cody/clarify-workflow.ts`
- `getGateFiles(taskDir: string, gatePoint: string): { requestPath: string; approvedPath: string }` from `scripts/cody/clarify-workflow.ts` (private, not exported — will need to inline the path logic: `path.join(taskDir, \`gate-${stage}-approved.md\`)`)
- `resumeFromGate(state: PipelineStateV2, gateStageName: string): PipelineStateV2` from `scripts/cody/engine/status.ts`
- `loadState(taskId: string): PipelineStateV2 | null` from `scripts/cody/engine/status.ts`
- `writeState(taskId: string, state: PipelineStateV2): void` from `scripts/cody/engine/status.ts`
- `commitPipelineFiles(opts: { taskDir, taskId, message, ensureBranch, stagingStrategy, push, isCI, dryRun }): Promise<void>` from `scripts/cody/git-utils.ts`
- `resolveFromStageAfterGateApproval(gateStage: string, pipeline: string[]): string` from `scripts/cody/rerun-utils.ts`
- `createBaseState(overrides?: Partial<PipelineStateV2>): PipelineStateV2` — test fixture in `tests/unit/scripts/cody/rerun-gate-approval.test.ts`
- `createStage(state: StageStateV2['state'], extra?: Partial<StageStateV2>): StageStateV2` — test fixture in `tests/unit/scripts/cody/rerun-gate-approval.test.ts`

## Reuse Inventory
- `resumeFromGate` from `scripts/cody/engine/status.ts` — marks gate stage as completed, sets pipeline to running
- `loadState` / `writeState` from `scripts/cody/engine/status.ts` — pipeline state persistence
- `commitPipelineFiles` from `scripts/cody/git-utils.ts` — commit and push task files
- `resolveFromStageAfterGateApproval` from `scripts/cody/rerun-utils.ts` — calculates next stage after gate
- Gate file path pattern: `path.join(taskDir, \`gate-${gatePoint}-approved.md\`)` (from `getGateFiles` which is private/not exported)
- `fs.writeFileSync` — for writing approval marker file (same pattern as explicit branch at entry.ts:614)

## Integration Points
- The `gateApprovedStage` variable (line 587) must be set in the `'waiting'` branch for `fromStage` resolution at lines 674-679 to work correctly
- `commitPipelineFiles` is async — the `'waiting'` branch must be `await`ed (the outer try/catch already handles errors)
- `getGateFiles` is not exported from `clarify-workflow.ts` — the approval file path must be constructed inline using the same pattern: `path.join(taskDir, \`gate-${pausedStage}-approved.md\`)`
- After the helper writes the file and updates state, control continues to the existing `fromStage` resolution block at line 673, which checks `gateApprovedStage` and calculates the correct next stage

## Imports Verified
- `import { resumeFromGate, loadState, writeState } from './engine/status'` — already dynamically imported in the approval branch ✅
- `import { commitPipelineFiles } from './git-utils'` — already dynamically imported in the approval branch ✅
- `import { resolveFromStageAfterGateApproval } from './rerun-utils'` — already imported at top of entry.ts ✅
- `import * as fs from 'fs'` — already imported in entry.ts ✅
- `import * as path from 'path'` — already imported in entry.ts ✅

## Important Notes
- `getGateFiles` is a **private function** in `clarify-workflow.ts` — it is NOT exported. The `approveGate` helper must construct the path inline or the function must be exported. Simplest approach: inline the path pattern.
- The explicit approval branch (lines 610-637) uses dynamic imports (`await import(...)`) for `commitPipelineFiles` and `loadState/writeState/resumeFromGate`. The helper should follow the same pattern.
- The `'waiting'` return from `handleGateApproval` occurs in two scenarios: (1) gate request file already exists but no approval keyword found, (2) first time hitting the gate. In rerun mode, scenario (1) is the one we care about — the gate was posted in a previous run and the user triggered `@cody rerun` instead of `@cody approve`.
