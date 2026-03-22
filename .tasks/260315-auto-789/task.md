# Task

## Issue Title

Implicit Gate Approval on `@cody rerun`
## Fix Plan: Implicit Gate Approval on `@cody rerun`

### Problem

When `@cody rerun` is triggered on a pipeline paused at a risk gate, the rerun re-runs the gated stage from scratch and re-posts the same gate question. The user has to approve again, wasting a full pipeline cycle.

### Scope

The fix is **only needed in `rerun` mode** (`runRerunMode` in `entry.ts`). Other modes (`full`, `fix`, `impl`) start fresh pipelines where re-asking the gate is correct behavior.

### Root Cause

**File**: `scripts/cody/entry.ts:642-644`

When `handleGateApproval` returns `'waiting'` (because `@cody rerun` is not in `APPROVAL_KEYWORDS`), the code logs and does nothing. The pipeline then falls through to re-run the gated stage, which triggers the gate post-action again.

### Fix (single location)

**File**: `scripts/cody/entry.ts`, lines 642-644

When `gateResult === 'waiting'`, implicitly approve the gate. The rationale: `@cody rerun` is a clear signal the user wants the pipeline to proceed — they should never need to separately approve a gate they've already seen.

Replace:
```typescript
} else if (gateResult === 'waiting') {
  logger.info(`Gate ${pausedStage} still waiting for approval`)
}
```

With the same approval logic already at lines 610-637 (the explicit `'approved'` branch):
1. Write `gate-{stage}-approved.md` with "implicitly approved via @cody rerun"
2. Commit + push approval files
3. Call `resumeFromGate` to update state
4. Set `gateApprovedStage` so `fromStage` resolves to the next stage after the gate

This is ~20 lines duplicated from the explicit approval branch. Could extract a shared helper `approveGate(ctx, pausedStage, reason)` to avoid duplication.

### Test Plan

**File**: `tests/unit/scripts/cody/rerun-gate-approval.test.ts` (existing)

Add test cases:
1. `@cody rerun` on pipeline paused at gate → gate implicitly approved, `fromStage` resolves to next stage
2. Approval file is written with "implicitly approved via @cody rerun" message
3. No double gate question posted

### Files Touched

| File | Change |
|------|--------|
| `scripts/cody/entry.ts` | Implicit approval in `'waiting'` branch + extract helper (~25 lines) |
| `tests/unit/scripts/cody/rerun-gate-approval.test.ts` | Add 2-3 test cases |

### Risk

Low — isolated to rerun mode. `@cody approve` continues to work. `full`/`fix`/`impl` modes are unaffected. The only behavioral change: `@cody rerun` on a gated pipeline no longer re-asks the same question.



---
_Created by @aguyaharonyair via Cody dashboard_
