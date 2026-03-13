# Plan: Fix CI Test — ALL_IMPL_STAGE_NAMES Length Mismatch

## Rerun Context

The original task (lesson intro container width fix) was completed successfully. However, CI caught a pre-existing test failure in `tests/int/scripts/cody.int.spec.ts`: the `ALL_IMPL_STAGE_NAMES` array now has 10 elements (a `test` stage was added to the parallel group `{ parallel: ['test', 'build'] }` in `pipeline-utils.ts`), but the integration test still asserts a length of 9 and doesn't check for the `test` stage.

**What changed**: The `IMPL_PIPELINE` in `scripts/cody/pipeline-utils.ts` was updated to include `test` in a parallel group with `build`, but the corresponding integration test was not updated.

**Fix approach**: Update the test to include the `test` stage assertion and change expected length from 9 to 10. This is a test-only change.

---

### Step 1: Update pipeline stage integration test to include `test` stage

**Root Cause**: `IMPL_PIPELINE` in `scripts/cody/pipeline-utils.ts` (line 881) includes `{ parallel: ['test', 'build'] }`, making `ALL_IMPL_STAGE_NAMES` flatten to 10 elements. The test at line 474 expects 9 and has no assertion for the `test` stage.

**Files to Touch**:
- `tests/int/scripts/cody.int.spec.ts` (MODIFIED — lines 464-474)

**Reproduction Test**: The existing test IS the reproduction — it currently FAILS:
- Test location: `tests/int/scripts/cody.int.spec.ts`
- Test name: `defines correct stages for spec and impl pipelines`
- Why it fails: `expect(ALL_IMPL_STAGE_NAMES).toHaveLength(9)` — actual length is 10

**Fix**:
1. **Line 464**: Update comment to mention `test` stage:
   - Before: `// Impl pipeline should have architect, plan-gap, build, review/fix cycle, and commit/verify/pr`
   - After: `// Impl pipeline should have architect, plan-gap, test+build (parallel), review/fix cycle, and commit/verify/pr`

2. **After line 466** (after `plan-gap` assertion): Add assertion for `test` stage:
   - Add: `expect(ALL_IMPL_STAGE_NAMES).toContain('test')`

3. **Line 473**: Update comment:
   - Before: `// 9 stages: architect, plan-gap, build, commit, review, fix, commit, verify, pr`
   - After: `// 10 stages: architect, plan-gap, test, build, commit, review, fix, commit, verify, pr`

4. **Line 474**: Update expected length:
   - Before: `expect(ALL_IMPL_STAGE_NAMES).toHaveLength(9)`
   - After: `expect(ALL_IMPL_STAGE_NAMES).toHaveLength(10)`

**Verification**:
- Run: `pnpm vitest run tests/int/scripts/cody.int.spec.ts`
- Before fix: FAILS with `expected [ 'architect', 'plan-gap', …(8) ] to have a length of 9 but got 10`
- After fix: PASSES — all 28 tests green

**Acceptance Criteria**:
- [ ] Test asserts `ALL_IMPL_STAGE_NAMES` contains `test`
- [ ] Test expects length of 10 (not 9)
- [ ] Comments accurately reflect the 10-stage pipeline
- [ ] All 28 tests in `cody.int.spec.ts` pass
- [ ] `pnpm tsc --noEmit` passes (no type errors)
