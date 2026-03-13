# Plan: Fix Complexity Scoring Consistency

**Task ID**: 260312-fix-complexity-scoring-consistency
**Task Type**: fix_bug
**Estimated Steps**: 4
**Estimated Time**: 40-60 minutes

## Overview

Four inconsistencies exist between the complexity scoring source of truth (`STAGE_COMPLEXITY_THRESHOLDS` in `pipeline-utils.ts`) and its consumers: the taskify LLM prompt, the `resolvePipelineProfile()` docstring, GitHub label thresholds, and the README file map. The code logic itself is correct everywhere except `github-api.ts` labels — the other issues are docs/prompt bugs, but they cause real behavioral impact (the LLM uses incorrect thresholds when scoring tasks).

---

### Step 1: Fix taskify prompt stage activation table

**Root Cause**: The markdown table in `.opencode/agents/taskify.md` (lines 261-267) tells the LLM agent the wrong stage activation rules. For example:
- Row "20-34 Moderate" says `+ architect, build` — but architect activates at 10 (already listed in Simple) and build always runs (threshold 0)
- Row "35-49 Complex" says `+ spec, gap` — but spec activates at 20, not 35
- Row "50-100 Very Complex" says `+ plan-gap, clarify` — but plan-gap activates at 40 and clarify at 60

The table should be cumulative (each row shows only NEW stages at that threshold).

**Files to Touch**:
- `.opencode/agents/taskify.md` (MODIFIED — lines 261-267)

**Exact Change**: Replace the 5-row table (lines 261-267) with the correct 8-row table derived from `STAGE_COMPLEXITY_THRESHOLDS`:

```markdown
| Score | Tier | Stages That Run |
|-------|------|-----------------|
| 1-9 | Trivial | taskify → build → commit → verify → pr (always-run stages only) |
| 10-19 | Simple | + architect |
| 20-29 | Moderate | + spec |
| 30-34 | Moderate+ | + review |
| 35-39 | Complex | + gap |
| 40-49 | Complex+ | + plan-gap |
| 50-59 | Very Complex | (no additional stages at this threshold) |
| 60-100 | Very Complex+ | + clarify |
```

**Reproduction Test** (MUST FAIL before fix):
- Test location: `tests/unit/scripts/cody/complexity-scoring.test.ts`
- New test: `taskify prompt stage table matches STAGE_COMPLEXITY_THRESHOLDS`
- What it does:
  1. Read `.opencode/agents/taskify.md` from disk
  2. Extract the markdown table between "## Complexity Score" and "### Scoring Dimensions"
  3. Parse each row's score range and stage names
  4. For each non-zero threshold in `STAGE_COMPLEXITY_THRESHOLDS`, verify there's a row whose score range starts at that threshold
  5. Verify "architect" appears in a row starting at score 10, "spec" at score 20, "review" at score 30, "gap" at score 35, "plan-gap" at score 40, "clarify" at score 60
- Why it fails now: The current table says architect appears at 20-34, spec at 35-49, etc. — all wrong

**Verification**:
```bash
pnpm vitest run tests/unit/scripts/cody/complexity-scoring.test.ts --config vitest.config.unit.mts
```
- Test FAILS before fix → PASSES after fix

**Acceptance Criteria**:
- [ ] Every non-zero threshold from `STAGE_COMPLEXITY_THRESHOLDS` has a corresponding row in the table
- [ ] Each row correctly names the NEW stage that activates at that threshold boundary
- [ ] The table is cumulative (each row adds only newly activated stages)
- [ ] The test reads the file, parses the table, and cross-checks against `STAGE_COMPLEXITY_THRESHOLDS`

---

### Step 2: Fix `resolvePipelineProfile()` stale docstring and inline comment

**Root Cause**: The JSDoc at lines 128-131 says `complexity < 35 → lightweight` and `complexity >= 35 → standard`, but the code on line 142 actually uses `STAGE_COMPLEXITY_THRESHOLDS.spec` which is **20**. The inline comment on line 141 says `"Threshold 35 = where spec stage kicks in"` — spec kicks in at 20. The **code is correct** (uses the constant), but the **comments are misleading**.

**Files to Touch**:
- `scripts/cody/pipeline-utils.ts` (MODIFIED — lines 129-131 and 141)

**Exact Change**:
- Line 129: Change `complexity < 35 → lightweight (no spec/gap needed)` to `complexity < 20 → lightweight (below spec threshold)`  
- Line 130: Change `complexity >= 35 → standard (full pipeline)` to `complexity >= 20 → standard (spec and above stages enabled)`
- Line 141: Change `// Threshold 35 = where spec stage kicks in (the dividing line)` to `// Threshold = STAGE_COMPLEXITY_THRESHOLDS.spec (20) — below this is lightweight`

**Reproduction Test** (behavior already correct, test LOCKS it):
- Test location: `tests/unit/scripts/cody/complexity-scoring.test.ts`
- New test: `resolvePipelineProfile boundary matches STAGE_COMPLEXITY_THRESHOLDS.spec`
- What it does:
  1. Import `STAGE_COMPLEXITY_THRESHOLDS` and `resolvePipelineProfile`
  2. Create task with `complexity: STAGE_COMPLEXITY_THRESHOLDS.spec - 1` (19) → expect `'lightweight'`
  3. Create task with `complexity: STAGE_COMPLEXITY_THRESHOLDS.spec` (20) → expect `'standard'`
  4. This locks the boundary to the constant so future threshold changes are automatically validated
- Why it's valuable: Existing tests hardcode 15 and 20 — this test uses the constant directly to prove the boundary is exactly at `STAGE_COMPLEXITY_THRESHOLDS.spec`
- Note: This test will PASS both before and after the comment fix (since code is already correct). Its purpose is to lock the behavior.

**Verification**:
```bash
pnpm vitest run tests/unit/scripts/cody/complexity-scoring.test.ts --config vitest.config.unit.mts
```

**Acceptance Criteria**:
- [ ] JSDoc accurately says `complexity < 20 → lightweight`
- [ ] Inline comment references correct threshold value (20) and mentions `STAGE_COMPLEXITY_THRESHOLDS.spec`
- [ ] New boundary test uses the `STAGE_COMPLEXITY_THRESHOLDS.spec` constant (not magic numbers)
- [ ] All existing `resolvePipelineProfile` tests still pass

---

### Step 3: Align GitHub label thresholds with `getComplexityTier()` boundaries

**Root Cause**: `github-api.ts` lines 539-546 maps complexity to GitHub labels using different boundaries than `getComplexityTier()`:

| Current label logic | Tier logic (`getComplexityTier()`) |
|---|---|
| `≤ 30` → `complexity:simple` | `< 20` → simple |
| `31-60` → `complexity:moderate` | `20-34` → moderate |
| `> 60` → `complexity:complex` | `35-49` → complex, `≥ 50` → very_complex |

Real impact: A task scored 25 is "moderate" by tier but gets labeled `complexity:simple` on GitHub.

**Files to Touch**:
- `scripts/cody/github-api.ts` (MODIFIED — lines 537-548)

**Exact Change**: Replace the hardcoded if/else chain with a call to `getComplexityTier()`:

```typescript
// At top of file (new import):
import { getComplexityTier } from './pipeline-utils'

// Replace lines 538-548:
if (taskDef.complexity !== undefined) {
  const tier = getComplexityTier(taskDef.complexity)
  let label: string
  if (tier === 'trivial' || tier === 'simple') {
    label = 'complexity:simple'
  } else if (tier === 'moderate') {
    label = 'complexity:moderate'
  } else {
    // complex or very_complex
    label = 'complexity:complex'
  }
  labels.push(label)
}
```

New boundaries: `< 20` → simple, `20-34` → moderate, `≥ 35` → complex.

**Reproduction Test** (MUST FAIL before fix):
- Test location: `tests/unit/scripts/cody/github-api-labels.test.ts`
- Changes to existing tests:
  1. Line 148-156: Change test `should map complexity 25 to complexity:simple` → expect `complexity:moderate` instead (score 25 is "moderate" tier)
  2. Line 178-193: Change test `should set multiple labels` assertion for complexity 25 → expect `complexity:moderate`
- New boundary tests to add:
  1. `should map complexity 19 to complexity:simple` (boundary: < 20 = simple)
  2. `should map complexity 20 to complexity:moderate` (boundary: >= 20 = moderate)
  3. `should map complexity 34 to complexity:moderate` (boundary: < 35 = moderate)
  4. `should map complexity 35 to complexity:complex` (boundary: >= 35 = complex)
  5. `should map complexity 50 to complexity:complex` (not moderate — this test already exists at line 158 but expects `complexity:moderate`, needs updating)
- Also update `classification-labels.test.ts`:
  1. Line 120-151: Test with `complexity: 20` currently expects `complexity:simple` → expect `complexity:moderate`

Why tests fail before fix: Current code maps score 25 → `complexity:simple` and score 50 → `complexity:moderate`; fixed code maps 25 → `complexity:moderate` and 50 → `complexity:complex`.

**Verification**:
```bash
pnpm vitest run tests/unit/scripts/cody/github-api-labels.test.ts --config vitest.config.unit.mts
pnpm vitest run tests/unit/scripts/cody/classification-labels.test.ts --config vitest.config.unit.mts
```
- Boundary tests FAIL before fix → PASS after

**Acceptance Criteria**:
- [ ] `github-api.ts` uses `getComplexityTier()` from `pipeline-utils.ts` (single source of truth)
- [ ] Score 19 → `complexity:simple`, score 20 → `complexity:moderate`, score 35 → `complexity:complex`
- [ ] No hardcoded threshold numbers in the label mapping code
- [ ] All existing `classification-labels.test.ts` tests pass (with updated expectations)
- [ ] All existing `github-api-labels.test.ts` tests pass (with updated expectations)

---

### Step 4: Remove stale `gsd-bridge.ts` reference from README

**Root Cause**: `scripts/cody/README.md` line 271 references `gsd-bridge.ts` in the "Agent Execution" file map table, but this file does not exist on disk (`ls scripts/cody/gsd-bridge.ts` → "No such file or directory").

**Files to Touch**:
- `scripts/cody/README.md` (MODIFIED — line 271)

**Exact Change**: Delete line 271: `| \`gsd-bridge.ts\`     | Maps complexity score to GSD workflow config                 |`

**Reproduction Test** (MUST FAIL before fix):
- Test location: `tests/unit/scripts/cody/complexity-scoring.test.ts`
- New test: `README file map should not reference non-existent .ts files`
- What it does:
  1. Read `scripts/cody/README.md`
  2. Find all rows in markdown tables that match the pattern `| \`<filename>.ts\` |`
  3. For each filename, verify the file exists at `scripts/cody/<filename>.ts`
- Why it fails now: `gsd-bridge.ts` is referenced but doesn't exist

**Verification**:
```bash
pnpm vitest run tests/unit/scripts/cody/complexity-scoring.test.ts --config vitest.config.unit.mts
```
- Test FAILS before fix → PASSES after fix

**Acceptance Criteria**:
- [ ] No references to `gsd-bridge.ts` in README
- [ ] All `.ts` filenames in README file map tables exist on disk
- [ ] Test scans ALL file map tables in README (not just the "Agent Execution" section)

---

## Execution Order

1. **Step 1** (taskify prompt) — highest impact, fixes LLM scoring mental model
2. **Step 3** (GitHub labels) — aligns observable labels with internal tiers
3. **Step 2** (docstring) — comment-only fix, locks behavior with test
4. **Step 4** (README) — docs cleanup

## Test Commands

```bash
# Run all new/modified tests
pnpm vitest run tests/unit/scripts/cody/complexity-scoring.test.ts --config vitest.config.unit.mts
pnpm vitest run tests/unit/scripts/cody/github-api-labels.test.ts --config vitest.config.unit.mts
pnpm vitest run tests/unit/scripts/cody/classification-labels.test.ts --config vitest.config.unit.mts

# TypeScript check (no code logic changes except github-api.ts import)
pnpm tsc --noEmit
```

## Assumptions

1. The `getComplexityTier()` function in `pipeline-utils.ts` is the canonical source of truth for tier boundaries and won't change simultaneously with this fix.
2. The `STAGE_COMPLEXITY_THRESHOLDS` constant at `pipeline-utils.ts:67-82` is the canonical source of truth for stage activation thresholds.
3. `github-api.ts` can import from `./pipeline-utils` without circular dependency issues (verified: `github-api.ts` currently has no imports from `pipeline-utils`, and `pipeline-utils` does not import from `github-api`).
4. The `docs` stage (threshold 15) is intentionally not included in the taskify prompt table because it's a non-user-facing stage. If the build agent believes it should be included, add a row for `15-19: + docs`.
