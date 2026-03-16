# Plan: Implicit Gate Approval on `@cody rerun`

**Task ID**: 260315-auto-789
**Task Type**: fix_bug
**Risk**: Low

## Research Findings

- ✅ `scripts/cody/entry.ts` exists — `runRerunMode()` starts at line 579, the bug is at lines 642-644
- ✅ `scripts/cody/clarify-workflow.ts` exists — `handleGateApproval()` at line 359, `getGateFiles()` at line 171, `GateResult` type at line 156
- ✅ `scripts/cody/engine/status.ts` exists — `resumeFromGate()` at line 352, `loadState/writeState` available
- ✅ `scripts/cody/git-utils.ts` exists — `commitPipelineFiles()` at line 745
- ✅ `tests/unit/scripts/cody/rerun-gate-approval.test.ts` exists (361 lines) — contains fixtures and tests for issue #673 and #827
- **Pattern observed**: The explicit approval branch (lines 610-637) already does: commit approval files → resumeFromGate → set `gateApprovedStage`. The `'waiting'` branch (lines 642-644) does nothing — this is the bug.
- **Integration point**: After gate approval, lines 674-679 use `gateApprovedStage` to calculate `fromStage` via `resolveFromStageAfterGateApproval()`. If `gateApprovedStage` is never set (the bug), fromStage falls through to the paused-stage logic at lines 694-696, which re-runs the gated stage.

## Reuse Inventory

### Existing utilities the plan will reuse (with import paths):
- `getGateFiles(taskDir, gatePoint)` from `scripts/cody/clarify-workflow.ts` — returns `{ requestPath, approvedPath }` paths; used to write the gate-approved marker file
- `commitPipelineFiles(opts)` from `scripts/cody/git-utils.ts` — commits and pushes task directory files
- `resumeFromGate(state, gateStageName)` from `scripts/cody/engine/status.ts` — marks gate stage as completed, sets pipeline to running
- `loadState(taskId)` / `writeState(taskId, state)` from `scripts/cody/engine/status.ts` — read/write pipeline state
- `createBaseState()` / `createStage()` test fixtures from `tests/unit/scripts/cody/rerun-gate-approval.test.ts`
- `resolveFromStageAfterGateApproval()` from `scripts/cody/rerun-utils.ts`

### New code justification:
- **`approveGate()` helper** (NEW in `scripts/cody/entry.ts`) — extracts the 20-line approval logic from the explicit branch into a reusable function. This avoids duplicating lines 610-637 in the `'waiting'` branch. No existing utility does this; the logic is specific to `entry.ts`'s orchestration (write file → commit → update state → set variable).

---

## Steps

### Step 1: Extract `approveGate()` helper and call it from both branches

**Root Cause**: When `handleGateApproval` returns `'waiting'` during `@cody rerun`, the code at line 642-644 logs and does nothing. The pipeline then falls through to re-run the gated stage from scratch, which triggers the gate post-action again, re-posting the same gate question. The user must approve again, wasting a full pipeline cycle.

**Files to Touch**:

- `scripts/cody/entry.ts` (MODIFIED — lines 598-649)

**Reproduction Test**: Write a test that demonstrates the bug (MUST FAIL now):

- Test location: `tests/unit/scripts/cody/rerun-gate-approval.test.ts`
- Test name: `@cody rerun on pipeline paused at gate should implicitly approve the gate`
- What it tests: When `handleGateApproval` returns `'waiting'` and the mode is `'rerun'`, the gate should be implicitly approved (approval file written, state updated, `gateApprovedStage` set) so that `fromStage` resolves to the next stage after the gate.
- Why it fails now: The `'waiting'` branch at lines 642-644 only logs and does nothing — `gateApprovedStage` remains `null`, so the pipeline falls through to re-run the gated stage.

**Fix**:

1. **Extract a helper function** `approveGate(ctx, pausedStage, reason)` in `entry.ts` that encapsulates the approval logic currently at lines 610-637:
   - Writes `gate-{stage}-approved.md` with the `reason` string (e.g., "implicitly approved via @cody rerun")
   - Calls `commitPipelineFiles()` to commit + push
   - Calls `resumeFromGate()` to update pipeline state
   - Returns the `pausedStage` so the caller can set `gateApprovedStage`

2. **Refactor the explicit `'approved'` branch** (lines 610-637) to call `approveGate(ctx, pausedStage, 'approved by user')`

3. **Add implicit approval in the `'waiting'` branch** (lines 642-644): Replace the log-only code with a call to `approveGate(ctx, pausedStage, 'implicitly approved via @cody rerun')` and set `gateApprovedStage = pausedStage`

The helper signature:
```typescript
async function approveGate(
  ctx: PipelineContext,
  pausedStage: string,
  reason: string,
): Promise<void>
```

**Acceptance Criteria**:
- [ ] `approveGate()` helper exists and is called from both the `'approved'` and `'waiting'` branches
- [ ] When `gateResult === 'waiting'` in rerun mode, the gate is implicitly approved
- [ ] `gateApprovedStage` is set so `fromStage` resolves to the next stage (not the gated stage)
- [ ] The approval file content says "implicitly approved via @cody rerun" (not "approved by user")
- [ ] Existing explicit approval (`@cody approve`) continues to work identically

**Verification**:
- Run reproduction test → FAILS (waiting branch does nothing)
- After fix applied → PASSES (gate is approved, state is updated)

---

### Step 2: Add test cases for implicit gate approval on rerun

**Root Cause**: No tests exist for the `'waiting'` branch behavior during rerun mode.

**Files to Touch**:

- `tests/unit/scripts/cody/rerun-gate-approval.test.ts` (MODIFIED — add new `describe` block after line 361)

**Tests to Add** (all MUST FAIL before Step 1 fix, PASS after):

1. **Test: `@cody rerun on pipeline paused at gate → gate implicitly approved, fromStage resolves to next stage`**
   - Setup: Create a pipeline state paused at `'taskify'`. Simulate `handleGateApproval` returning `'waiting'`.
   - Assert: After the implicit approval logic runs, `resumeFromGate` produces a state where `taskify` is `'completed'` and pipeline state is `'running'`. Then `resolveFromStageAfterGateApproval('taskify', pipeline)` returns the next stage (e.g., `'spec'` or `'gap'`).
   - Why it fails now: The `'waiting'` branch never calls `resumeFromGate`.

2. **Test: `Approval file is written with "implicitly approved via @cody rerun" message`**
   - Setup: Mock `fs.writeFileSync` or use a temp directory. Run the `approveGate()` helper with reason `'implicitly approved via @cody rerun'`.
   - Assert: The file `gate-{stage}-approved.md` exists and contains the text "implicitly approved via @cody rerun".
   - Why it fails now: No approval file is written in the `'waiting'` branch.

3. **Test: `Explicit approval still works — approveGate called with "approved by user"`**
   - Setup: Simulate `handleGateApproval` returning `'approved'`.
   - Assert: `approveGate()` is called with reason including "approved", and the approval file reflects this.
   - Purpose: Regression test ensuring the refactor didn't break explicit approval.

**Test Command**: `pnpm vitest run tests/unit/scripts/cody/rerun-gate-approval.test.ts`

**Acceptance Criteria**:
- [ ] At least 2 new test cases in a new `describe('Implicit gate approval on @cody rerun', ...)` block
- [ ] Tests validate: state transition (paused → completed), approval file content, and fromStage resolution
- [ ] All existing tests in the file continue to pass
- [ ] `pnpm vitest run tests/unit/scripts/cody/rerun-gate-approval.test.ts` passes with 0 failures

**Verification**:
- Run tests before Step 1 fix → new tests FAIL
- Run tests after Step 1 fix → all tests PASS (existing + new)

---

## Summary

| Step | Files | Change | Tests |
|------|-------|--------|-------|
| 1 | `scripts/cody/entry.ts` (MODIFIED, ~25 lines) | Extract `approveGate()` helper; add implicit approval in `'waiting'` branch | 2-3 new tests |
| 2 | `tests/unit/scripts/cody/rerun-gate-approval.test.ts` (MODIFIED, ~60 lines) | Add `describe` block with 2-3 test cases for implicit approval | Self-verifying |

**Total estimated time**: 20-30 minutes
**Test command**: `pnpm vitest run tests/unit/scripts/cody/rerun-gate-approval.test.ts`
**Quality gate**: `pnpm -s tsc --noEmit` must pass after changes
