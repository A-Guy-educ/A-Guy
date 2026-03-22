# Plan: Resilient `fromStage` Resolution

**Task ID**: 260315-auto-599
**Task Type**: fix_bug
**Spec Reference**: task.md

## Research Findings

- `scripts/cody/entry.ts` ✅ exists — lines 716-722 contain the hard crash to fix
- `scripts/cody/rerun-utils.ts` ✅ exists — contains `resolveRerunFromStage` and `resolveFromStageAfterGateApproval`; new `findNearestEarlierStage` will be added here
- `tests/unit/scripts/cody/rerun-gate-approval.test.ts` ✅ exists — already has test fixtures and patterns to follow
- `scripts/cody/stage-prompts.ts` ✅ exists — exports `ALL_STAGES` array (line 29): `['taskify', 'gap', 'clarify', 'architect', 'plan-gap', 'test', 'build', 'commit', 'review', 'fix', 'verify', 'autofix', 'docs', 'pr']`
- `scripts/cody/entry.ts` already imports from `./rerun-utils` (line 39): `{ resolveRerunFromStage, resolveFromStageAfterGateApproval }`
- `fromStage` (const) at line 717 is used downstream at line 729 in `resetFromStage(state, fromStage, stageOrder, taskDir)` — must remain valid after the fallback

### Patterns Observed

- `rerun-utils.ts` uses pure functions with no side effects — `findNearestEarlierStage` follows this pattern
- Test file uses `describe` blocks with clear fixture functions (`createBaseState`, `createStage`)
- Entry.ts uses `logger.warn`/`logger.info` for pipeline diagnostics
- `ALL_STAGES` from `stage-prompts.ts` is the canonical stage ordering reference

### Integration Points

- `entry.ts` line 717-722: Replace `throw` with fallback using `findNearestEarlierStage`
- `entry.ts` imports: Add `findNearestEarlierStage` to existing import from `./rerun-utils`
- `rerun-utils.ts`: Add import of `ALL_STAGES` from `./stage-prompts`
- Test file: Add import of `findNearestEarlierStage` and new `describe` block

## Reuse Inventory

| Existing Code | Import Path | Usage |
|---|---|---|
| `ALL_STAGES` | `scripts/cody/stage-prompts` | Canonical ordering reference for `findNearestEarlierStage` |
| `logger` | `scripts/cody/logger` | Already imported in entry.ts for `.warn()` logging |
| `resolveFromStageAfterGateApproval` pattern | `scripts/cody/rerun-utils` | Follow same pure-function style |
| Test fixtures (`createBaseState`, `createStage`) | test file | Reuse for new tests |

**New code justification**: `findNearestEarlierStage` is genuinely new logic — no existing utility finds the nearest earlier stage by walking backwards through `ALL_STAGES`.

---

## Step 1: Add `findNearestEarlierStage` to `rerun-utils.ts` and write tests

**Root Cause**: When `fromStage` (e.g., `gap`) is not present in the resolved pipeline order (e.g., lightweight pipeline has no `gap`), `entry.ts` line 718-722 throws a fatal error crashing the pipeline. The fix needs a fallback function that finds the nearest earlier valid stage.

**Files to Touch**:

- `scripts/cody/rerun-utils.ts` (MODIFIED — add import at top, add function after line 69)
- `tests/unit/scripts/cody/rerun-gate-approval.test.ts` (MODIFIED — add import + new describe block after line 228)

**Reproduction Test** (write FIRST — must FAIL before implementation):

- Test location: `tests/unit/scripts/cody/rerun-gate-approval.test.ts`
- Add `describe('findNearestEarlierStage', ...)` block with these test cases:
  1. **`gap` missing from lightweight pipeline → falls back to `taskify`**
     - Input: `findNearestEarlierStage('gap', ['taskify', 'clarify', 'architect', 'build', 'commit', 'verify', 'pr'])`
     - Expected: `'taskify'` (because in ALL_STAGES, `taskify` is before `gap` and exists in the pipeline)
     - Why it fails now: function doesn't exist yet → import error
  2. **`plan-gap` missing from lightweight → falls back to `architect`**
     - Input: `findNearestEarlierStage('plan-gap', ['taskify', 'clarify', 'architect', 'build', 'commit', 'verify', 'pr'])`
     - Expected: `'architect'` (because `architect` is the nearest earlier stage in ALL_STAGES that exists in pipeline)
  3. **Unknown stage → falls back to first pipeline stage**
     - Input: `findNearestEarlierStage('nonexistent', ['taskify', 'clarify', 'architect', 'build'])`
     - Expected: `'taskify'` (first stage in pipeline)
  4. **Stage exists in pipeline → returns first pipeline stage** (edge/sanity — caller wouldn't normally invoke this, but function should still be deterministic)
     - Input: `findNearestEarlierStage('build', ['taskify', 'clarify', 'architect', 'build', 'commit'])`
     - Expected: `'architect'` (nearest earlier stage in ALL_STAGES that exists in the pipeline)
  5. **No earlier stage exists → returns first pipeline stage**
     - Input: `findNearestEarlierStage('taskify', ['build', 'commit', 'verify', 'pr'])`
     - Expected: `'build'` (first in pipeline, since nothing in ALL_STAGES before `taskify`)

**Implementation** (after tests are written):

In `scripts/cody/rerun-utils.ts`:
1. Add `import { ALL_STAGES } from './stage-prompts'` at the top of the file
2. Add `findNearestEarlierStage` function after the existing `resolveFromStageAfterGateApproval` function (after line 69):
   - Takes `missingStage: string` and `pipelineOrder: string[]`
   - Returns `string`
   - Looks up `missingStage` index in `ALL_STAGES`
   - If unknown (`indexOf === -1`), return `pipelineOrder[0]`
   - Walks backwards from `missingIdx - 1` through `ALL_STAGES`
   - Returns first stage found in `pipelineOrder`
   - Fallback: `pipelineOrder[0]`

**Verification**:

```bash
pnpm vitest run tests/unit/scripts/cody/rerun-gate-approval.test.ts
```

- Before implementation: Tests FAIL (import error — `findNearestEarlierStage` not exported)
- After implementation: All 5 new tests PASS, all existing tests still PASS

**Acceptance Criteria**:

- [ ] `findNearestEarlierStage` exported from `rerun-utils.ts`
- [ ] Function imports `ALL_STAGES` from `./stage-prompts`
- [ ] All 5 test cases pass
- [ ] Existing `resolveFromStageAfterGateApproval` and `resolveRerunFromStage` tests unaffected
- [ ] `pnpm -s tsc --noEmit` passes (no type errors)

---

## Step 2: Replace hard crash in `entry.ts` with graceful fallback

**Root Cause**: `entry.ts` lines 716-722 throw a fatal `Error` when `fromStage` is not in `stageOrder`. This should gracefully fall back to the nearest earlier stage using the function from Step 1.

**Files to Touch**:

- `scripts/cody/entry.ts` (MODIFIED — lines 39, 716-722)

**Changes**:

1. **Line 39** — Add `findNearestEarlierStage` to the existing import:
   ```typescript
   import { resolveRerunFromStage, resolveFromStageAfterGateApproval, findNearestEarlierStage } from './rerun-utils'
   ```

2. **Lines 716-722** — Replace the `const` + `throw` block:
   - Change `const fromStage` to `let fromStage` (line 717)
   - Replace the `throw new Error(...)` block (lines 719-721) with:
     - Call `findNearestEarlierStage(fromStage, stageOrder)` to get fallback
     - Log a `logger.warn(...)` message indicating the fallback
     - Reassign `fromStage = fallback`
   - Keep the variable available for downstream use at line 729

**Reproduction Test**:

This is an integration-level behavior change. The unit tests from Step 1 validate the `findNearestEarlierStage` logic. The entry.ts change is a wiring change that replaces `throw` with the function call + log. Verification is:

- Test location: Same test file from Step 1 (the unit tests for `findNearestEarlierStage` validate the core logic)
- Additional manual verification: `pnpm -s tsc --noEmit` passes (no type errors from `let` vs `const`, import addition)

**Verification**:

```bash
pnpm -s tsc --noEmit
pnpm vitest run tests/unit/scripts/cody/rerun-gate-approval.test.ts
```

- TypeScript compiles without errors
- All tests pass (existing + new from Step 1)
- The `throw` path is removed — pipeline no longer crashes on missing `fromStage`

**Acceptance Criteria**:

- [ ] `findNearestEarlierStage` imported in entry.ts
- [ ] `const fromStage` changed to `let fromStage` at line 717
- [ ] `throw new Error(...)` replaced with fallback logic + `logger.warn`
- [ ] `fromStage` variable still used correctly at line 729 (`resetFromStage`)
- [ ] `pnpm -s tsc --noEmit` passes
- [ ] All existing pipeline behavior preserved (happy path where `fromStage` IS in `stageOrder` — no change)

---

## Self-Review Checklist

1. **Spec coverage**: ✅ All 3 items from task.md covered — new function (Step 1), entry.ts change (Step 2), tests (Step 1)
2. **Step ordering**: ✅ Step 1 creates the function + tests first; Step 2 wires it into entry.ts (depends on Step 1's export)
3. **File path accuracy**: ✅ All paths verified via Glob/Read during research
4. **Reuse check**: ✅ Using existing `ALL_STAGES`, existing test patterns, existing logger — no unnecessary new code
5. **Test feasibility**: ✅ vitest, pnpm — correct tools. Test file path confirmed.
6. **Step size**: ✅ Step 1: 2 files (utility + tests, ~15 min). Step 2: 1 file (wiring, ~10 min). Both under 30 min.
