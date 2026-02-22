# Plan: Replace `plan-review` with `plan-gap`

## Summary

Replace the read-only PASS/FAIL `plan-review` gate with a `plan-gap` agent that analyzes
`plan.md` against `spec.md` + codebase, **auto-revises** the plan to fix gaps, and writes
a `plan-gap.md` report. This eliminates the expensive architect retry loop (currently up to
2 full architect re-runs on FAIL).

**Current flow:**
```
architect → plan-review (PASS/FAIL gate) → build
                 ↓ FAIL
           delete plan.md, re-run architect + plan-review (up to 2x)
```

**New flow:**
```
architect → plan-gap (edits plan.md, writes plan-gap.md) → build
```

No retry loop. No FAIL/PASS verdict. The gap agent fixes whatever it finds.

**Net effect:** ~120 lines deleted, ~80 lines added. Simpler pipeline, no retry loops,
self-healing plan stage.

---

## Step 1: Create `plan-gap` agent prompt + delete `plan-review` prompt

**Files:**
- `.opencode/agents/plan-review.md` → **DELETE**
- `.opencode/agents/plan-gap.md` → **NEW**

**Behavior:**
The new agent mirrors the spec `gap.md` agent pattern:
- Reads `spec.md`, `plan.md`, `task.json`
- Explores the codebase for the task's domain (collections, hooks, components, etc.)
- Identifies gaps: missing spec requirements in the plan, wrong file paths, overlooked
  constraints, incorrect patterns, missing test gates
- **Edits `plan.md`** directly to fix gaps (adds missing steps, corrects file paths, etc.)
- Writes `plan-gap.md` as a report documenting what was found and changed

**Agent config:**
```yaml
name: plan-gap
description: Analyzes plan.md for gaps vs spec and codebase, auto-revises plan
mode: primary
tools:
  read: true
  write: true
  edit: true    # Key difference from old plan-review (had edit: false)
  bash: true
```

**Output format** (same as spec gap report):
```markdown
# Plan Gap Analysis: <task-id>

## Summary
- Gaps Found: X
- Plan Revised: Yes/No

## Gaps Identified
### Gap 1: [Title]
**Severity:** Critical / High / Medium
**Issue:** [Description]
**Fix Applied:** [How the plan was revised]

## Changes Made to Plan
- Added Step N: [description]
- Updated Step M file paths: [description]

## No Gaps Found (if clean)
No gaps identified. The plan covers all spec requirements.
```

**STOP CONDITION:** After writing plan-gap.md, DONE. Do NOT implement anything.

**Tests (run after all steps):**
- Agent file `.opencode/agents/plan-gap.md` exists
- Agent file `.opencode/agents/plan-review.md` does NOT exist

**Acceptance:**
- [ ] `plan-gap.md` agent prompt has `edit: true` in tools
- [ ] Agent prompt instructs to read spec.md, plan.md, task.json
- [ ] Agent prompt instructs to explore codebase based on task domain
- [ ] Agent prompt instructs to edit plan.md and write plan-gap.md
- [ ] Old `plan-review.md` agent prompt is deleted

---

## Step 2: Update other agent prompts that reference `plan-review`

**Files:**
- `.opencode/agents/architect.md` — **MODIFIED** (lines 14, 32-35)
- `.opencode/agents/build.md` — **MODIFIED** (line 63)

### architect.md changes:
- Line 14: Remove `plan-review.rejected.md` from inputs list
  - Before: `spec.md, clarified.md, and on reruns: rerun-feedback.md, plan-review.rejected.md`
  - After: `spec.md, clarified.md, and on reruns: rerun-feedback.md`
- Lines 32-35: Delete entire "Plan-review rejection" section (the block starting with
  `**Plan-review rejection** (when plan-review.rejected.md is listed...)`)
  This concept no longer exists — plan-gap fixes the plan directly.

### build.md changes:
- Line 63: `plan-review.md` → `plan-gap.md`
  - Before: `Address any SUGGESTIONS from plan-review.md (non-blocking, but improve quality)`
  - After: `Address any SUGGESTIONS from plan-gap.md (non-blocking, but improve quality)`

**Tests:**
- `grep -c 'plan-review' .opencode/agents/architect.md` returns 0
- `grep -c 'plan-review' .opencode/agents/build.md` returns 0

**Acceptance:**
- [ ] architect.md no longer references plan-review.rejected.md
- [ ] architect.md no longer has "Plan-review rejection" section
- [ ] build.md references plan-gap.md instead of plan-review.md

---

## Step 3: Update `opencode.json` — agent-to-model mapping

**Files:**
- `opencode.json` — **MODIFIED** (lines 33-36)

**Changes:**
```json
// Before:
"plan-review": {
  "model": "google/gemini-2.5-flash",
  "description": "Reviews architect plan for quality and completeness"
}

// After:
"plan-gap": {
  "model": "google/gemini-2.5-flash",
  "description": "Analyzes plan for gaps vs spec and codebase, auto-revises plan"
}
```

Keep the same model (Gemini 2.5 Flash) — the plan-gap agent needs to be fast, not deep.
The gap analysis + edit should complete within the timeout.

**Tests:**
- `grep -c 'plan-review' opencode.json` returns 0
- `grep -c 'plan-gap' opencode.json` returns 1

**Acceptance:**
- [ ] `plan-review` key removed from opencode.json
- [ ] `plan-gap` key added with correct model and description

---

## Step 4: Update `pipeline-utils.ts` — rename stage in pipeline definition

**Files:**
- `scripts/cody/pipeline-utils.ts` — **MODIFIED** (lines 285, 327-332, 394, 400)

**Changes:**
1. **`STAGE_OUTPUT_MAP`** (line 285):
   - `'plan-review': 'plan-review.md'` → `'plan-gap': 'plan-gap.md'`

2. **`DRY_RUN_OUTPUTS`** (lines 327-332):
   - Rename key `'plan-review'` → `'plan-gap'`
   - Change content from verdict format to gap report format:
     ```typescript
     'plan-gap': (taskId) =>
       `# Plan Gap Analysis (dry-run)\n\nNo gaps identified for ${taskId}.\n`,
     ```

3. **`IMPL_PIPELINE`** (line 400):
   - `'plan-review'` → `'plan-gap'`

4. **Comment** (line 394):
   - `architect → plan-review → build` → `architect → plan-gap → build`

`ALL_IMPL_STAGE_NAMES` updates automatically (derived from `flattenPipeline(IMPL_PIPELINE)`).

**Tests (Step 9 — listed here for reference):**
- `ALL_IMPL_STAGE_NAMES` contains `'plan-gap'` and does NOT contain `'plan-review'`
- `IMPL_PIPELINE` has `'plan-gap'` as 2nd element
- `stageOutputFile(dir, 'plan-gap')` returns `dir/plan-gap.md`

**Acceptance:**
- [ ] `STAGE_OUTPUT_MAP` has `plan-gap` key, no `plan-review` key
- [ ] `DRY_RUN_OUTPUTS` has `plan-gap` key with gap report format
- [ ] `IMPL_PIPELINE` array has `'plan-gap'` where `'plan-review'` was
- [ ] `ALL_IMPL_STAGE_NAMES` has 8 entries, includes `plan-gap`

---

## Step 5: Update `stage-prompts.ts` — rename stage in all registries

**Files:**
- `scripts/cody/stage-prompts.ts` — **MODIFIED** (lines 35, 73-75, 106, 152, 203)

**Changes:**
1. **`ALL_STAGES`** (line 35):
   - `'plan-review'` → `'plan-gap'`

2. **`STAGE_CONTEXT_FILES`** (lines 73-75):
   - Remove: `'plan-review': ['spec.md', 'plan.md']`
   - Add: `'plan-gap': ['spec.md', 'plan.md', 'task.json']`
     (add task.json for domain context, same as spec gap agent)
   - Update `architect` entry (line 73): remove `'plan-review.rejected.md'` from array
     - Before: `['spec.md', 'clarified.md', 'rerun-feedback.md', 'plan-review.rejected.md']`
     - After: `['spec.md', 'clarified.md', 'rerun-feedback.md']`
   - Update `build` entry (line 75): `'plan-review.md'` → `'plan-gap.md'`
     - Before: `['spec.md', 'clarified.md', 'plan.md', 'plan-review.md']`
     - After: `['spec.md', 'clarified.md', 'plan.md', 'plan-gap.md']`

3. **`stageInstructions`** (line 106):
   - Rename key: `'plan-review': () => ''` → `'plan-gap': () => ''`

4. **Comment** (line 152):
   - Remove reference to `plan-review.rejected.md`

5. **`getImplStages()`** (line 203):
   - `'plan-review'` → `'plan-gap'` in returned array

**Tests (Step 9):**
- `ALL_STAGES` contains `'plan-gap'`, not `'plan-review'`
- `STAGE_CONTEXT_FILES['plan-gap']` equals `['spec.md', 'plan.md', 'task.json']`
- `STAGE_CONTEXT_FILES.architect` does NOT contain `'plan-review.rejected.md'`
- `STAGE_CONTEXT_FILES.build` contains `'plan-gap.md'`

**Acceptance:**
- [ ] `ALL_STAGES` has 13 entries, includes `plan-gap`, no `plan-review`
- [ ] `STAGE_CONTEXT_FILES['plan-gap']` includes `task.json` for domain context
- [ ] architect context no longer includes `plan-review.rejected.md`
- [ ] build context references `plan-gap.md`
- [ ] `getImplStages()` returns array with `plan-gap`

---

## Step 6: Update `agent-runner.ts` — rename timeout key

**Files:**
- `scripts/cody/agent-runner.ts` — **MODIFIED** (line 37)

**Changes:**
- `'plan-review': 10 * 60_000` → `'plan-gap': 15 * 60_000`
- Bump to 15 min: plan-gap explores codebase + edits plan (same timeout as spec gap)

**Tests (Step 9):**
- `STAGE_TIMEOUTS['plan-gap']` equals `15 * 60_000`
- `STAGE_TIMEOUTS['plan-review']` is `undefined`

**Acceptance:**
- [ ] `plan-gap` timeout is 15 minutes
- [ ] No `plan-review` key in `STAGE_TIMEOUTS`

---

## Step 7: Update `content-validators.ts` — remove plan-review validators, add plan-gap

**Files:**
- `scripts/cody/content-validators.ts` — **MODIFIED** (lines 108-135)

**Changes:**
1. **Remove** these functions (no longer needed — no PASS/FAIL verdict):
   - `isPlanReviewFail(reviewContent: string): boolean`
   - `hasPlanReviewVerdict(reviewContent: string): boolean`
   - `validatePlanReviewVerdict(reviewFilePath: string): boolean`

2. **Add** `validatePlanGapReport(content: string): boolean`:
   - Reuse exact same logic as `validateGapReport()` — both follow same format
   - Check for `## Gaps Found` or `## Changes Made` or `"No gaps identified"`
   - Empty/short content = invalid (< 10 chars)

   (Alternative: just call `validateGapReport` directly from stage-hooks. Either works.
   A dedicated function is slightly clearer for intent.)

**Tests (Step 9):**
- `validatePlanGapReport` returns true for valid gap reports
- `validatePlanGapReport` returns false for empty/placeholder content
- `isPlanReviewFail`, `hasPlanReviewVerdict`, `validatePlanReviewVerdict` no longer exported

**Acceptance:**
- [ ] Plan-review validator functions removed
- [ ] `validatePlanGapReport` added and validates gap report format
- [ ] All removed functions are no longer importable

---

## Step 8: Update `stage-hooks.ts` — replace gate with validation

**Files:**
- `scripts/cody/stage-hooks.ts` — **MODIFIED** (lines 7-8 imports, 22-28, 64-101)

**Changes:**
1. **Remove** `PlanReviewFailError` class (lines 22-28)

2. **Remove** `handlePlanReviewGate()` function (lines 64-101)

3. **Remove** imports of `isPlanReviewFail`, `hasPlanReviewVerdict` from content-validators

4. **Add** import of `validatePlanGapReport` (or `validateGapReport`) from content-validators

5. **Add** new function `handlePlanGapValidation(options: StageHookOptions): void`:
   ```typescript
   export function handlePlanGapValidation(options: StageHookOptions): void {
     const { taskDir } = options
     const outputFile = stageOutputFile(taskDir, 'plan-gap')

     if (!fs.existsSync(outputFile)) {
       return // No output file = stage didn't run or was skipped
     }

     const gapContent = fs.readFileSync(outputFile, 'utf-8')
     if (!validatePlanGapReport(gapContent)) {
       throw new Error(
         'Plan gap report is invalid — must contain ## Gaps Found, ## Changes Made, or "No gaps identified"'
       )
     }

     // Re-validate plan.md after gap agent may have revised it
     const planFile = path.join(taskDir, 'plan.md')
     if (!fs.existsSync(planFile)) {
       throw new Error('plan.md missing after plan-gap agent ran — agent may have deleted it')
     }

     console.log('  ✅ Plan gap analysis complete')
   }
   ```

6. **Update exports**: remove `PlanReviewFailError`, `handlePlanReviewGate`;
   add `handlePlanGapValidation`

**Tests (Step 9):**
- `handlePlanGapValidation` does nothing when plan-gap.md doesn't exist
- `handlePlanGapValidation` succeeds for valid gap report
- `handlePlanGapValidation` throws for invalid/empty gap report
- `handlePlanGapValidation` throws when plan.md is missing
- `PlanReviewFailError` is no longer exported

**Acceptance:**
- [ ] `PlanReviewFailError` class deleted
- [ ] `handlePlanReviewGate` function deleted
- [ ] `handlePlanGapValidation` validates plan-gap.md output
- [ ] `handlePlanGapValidation` re-validates plan.md exists post-edit

---

## Step 9: Update `cody.ts` — replace hook + delete retry loop

**Files:**
- `scripts/cody/cody.ts` — **MODIFIED** (lines 4-11 imports, 658-661, 787-823)

**Changes:**

### 9a. Update imports (lines 4-11):
- Remove: `PlanReviewFailError` from import of `stage-hooks`
- Remove: `handlePlanReviewGate` from import of `stage-hooks`
- Add: `handlePlanGapValidation` to import of `stage-hooks`

### 9b. Replace post-stage hook (lines 658-661):
```typescript
// Before:
if (stage === 'plan-review') {
  handlePlanReviewGate(hookOptions)
}

// After:
if (stage === 'plan-gap') {
  handlePlanGapValidation(hookOptions)
}
```

### 9c. Delete the plan-review retry loop (lines 787-823):
The entire `catch (err)` block that handles `PlanReviewFailError` is deleted.
This removes:
- `PlanReviewFailError` instanceof check
- `MAX_PLAN_RETRIES` constant
- Loop that re-runs `architect` + `plan-review` up to 2 times
- ~35 lines of retry logic

The sequential stage execution simplifies to:
```typescript
} else {
  // Run sequential stage
  console.log(`[${i + 1}/${pipeline.length}] ${pipelineStage}`)
  await runSingleStage(pipelineStage)
}
```

No special error handling — if plan-gap fails (agent timeout/error), it fails like
any other stage (propagates up normally).

**Tests:**
- Pipeline integration test should not reference `PlanReviewFailError`
- No retry loop for plan stage

**Acceptance:**
- [ ] `PlanReviewFailError` not imported
- [ ] Post-stage hook calls `handlePlanGapValidation` for `plan-gap` stage
- [ ] Architect retry loop (~35 lines) completely removed
- [ ] Sequential stage execution has no special plan-related catch

---

## Step 10: Update `.opencode/PIPELINE.md` — pipeline documentation

**Files:**
- `.opencode/PIPELINE.md` — **MODIFIED** (~11 references)

**Changes (all `plan-review` → `plan-gap`):**
- Line 9: `plan-review(gate)` → `plan-gap`
- Line 25: Stage table row — update name, description, output file
  - Name: `plan-gap`
  - Description: `Analyze plan for gaps vs spec/codebase, auto-revise`
  - Output: `plan-gap.md`
- Line 46: Model assignment — `plan-review` → `plan-gap`
- Lines 81-89: Rewrite the plan-review section to describe plan-gap behavior:
  - No PASS/FAIL verdict
  - Edits plan.md directly
  - No retry loop / pipeline deletion
- Line 168: `plan-review: Verdict check (PASS/FAIL gate)` →
  `plan-gap: Gap analysis + auto-revision`
- Lines 177-179: Update pipeline flows (feat, fix, refactor)
- Line 193: File tree — `plan-review.md` → `plan-gap.md`

**Tests:**
- `grep -c 'plan-review' .opencode/PIPELINE.md` returns 0

**Acceptance:**
- [ ] No references to `plan-review` in PIPELINE.md
- [ ] Plan-gap described accurately (auto-revise, no verdict, no retry)

---

## Step 11: Update all test files

**Files (all MODIFIED):**

### 11a. `tests/unit/scripts/cody/stage-hooks.test.ts`
- **Remove** imports: `PlanReviewFailError`, `handlePlanReviewGate`
- **Add** import: `handlePlanGapValidation`
- **Remove** entire `describe('handlePlanReviewGate', ...)` block (lines 62-121)
- **Remove** entire `describe('PlanReviewFailError', ...)` block (lines 190-201)
- **Add** `describe('handlePlanGapValidation', ...)` with tests:
  - `does nothing when plan-gap.md does not exist`
  - `succeeds when plan-gap.md has valid gap report (## Gaps Found)`
  - `succeeds when plan-gap.md says "No gaps identified"`
  - `throws when plan-gap.md is invalid (empty/missing sections)`
  - `throws when plan.md is missing after gap agent ran`

### 11b. `tests/unit/scripts/cody/content-validators.test.ts`
- **Remove** imports: `isPlanReviewFail`, `hasPlanReviewVerdict`, `validatePlanReviewVerdict`
- **Add** import: `validatePlanGapReport`
- **Remove** `describe('isPlanReviewFail', ...)` (lines 169-185)
- **Remove** `describe('hasPlanReviewVerdict', ...)` (lines 187-203)
- **Remove** `describe('validatePlanReviewVerdict', ...)` (lines 205-221)
- **Add** `describe('validatePlanGapReport', ...)` with tests:
  - `returns true for report with ## Gaps Found`
  - `returns true for report with ## Changes Made`
  - `returns true for "No gaps identified"`
  - `returns false for empty content`
  - `returns false for placeholder text`
  - `returns false for report without required sections`

### 11c. `tests/unit/scripts/cody/stage-prompts.test.ts`
- Line 38 description: `plan-review` → `plan-gap`
- Line 45: `expect(stages).toContain('plan-review')` → `'plan-gap'`
- Line 53: stage count stays 13 (unchanged)
- Lines 67-72: architect context files — remove `'plan-review.rejected.md'` from expected
- Line 73: `STAGE_CONTEXT_FILES['plan-review']` → `STAGE_CONTEXT_FILES['plan-gap']`,
  expected value: `['spec.md', 'plan.md', 'task.json']`
- Lines 74-79: build context files — `'plan-review.md'` → `'plan-gap.md'`
- Line 110: `getImplStages()` — `'plan-review'` → `'plan-gap'`

### 11d. `tests/unit/scripts/cody/pipeline-utils.test.ts`
- Line 510 description: `plan-review` → `plan-gap`
- Line 512: `expect(ALL_IMPL_STAGE_NAMES).toContain('plan-review')` → `'plan-gap'`
- Line 524: `ALL_IMPL_STAGE_NAMES.indexOf('plan-review')` → `'plan-gap'`
  (rename variable: `planReviewIdx` → `planGapIdx`)
- Line 529 comment: `architect < plan-review < build` → `architect < plan-gap < build`
- Lines 530-531: use `planGapIdx`
- Line 33 (bugfixes section): `'plan-review'` → `'plan-gap'` in `toEqual` array
- Line 54: `expect(sequentialStages).toContain('plan-review')` → `'plan-gap'`

### 11e. `tests/unit/scripts/cody/bug-exposure.test.ts`
- Line 292 description: `plan-review` → `plan-gap`
- Line 294: `STAGE_TIMEOUTS['plan-review']` → `STAGE_TIMEOUTS['plan-gap']`
- Line 294: expected value `10 * 60_000` → `15 * 60_000`

### 11f. `tests/unit/scripts/cody/bugfixes.test.ts`
- Line 33: `'plan-review'` → `'plan-gap'` in `toEqual` array
- Line 54: `expect(sequentialStages).toContain('plan-review')` → `'plan-gap'`

### 11g. `tests/unit/scripts/cody/cody-utils-extended.test.ts`
- Line 157: `'plan-review'` → `'plan-gap'` in valid stages list
- Line 922: `'plan-review'` → `'plan-gap'` in valid stages list

### 11h. `tests/unit/scripts/cody/agent-runner.test.ts`
- Line 78: `'plan-review'` → `'plan-gap'`
- Line 79: `'/fake/path/plan-review.md'` → `'/fake/path/plan-gap.md'`

### 11i. `tests/unit/scripts/cody.spec.ts`
- Line 1004: `expect(isValidStage('plan-review')).toBe(true)` →
  `expect(isValidStage('plan-gap')).toBe(true)`

### 11j. `tests/int/scripts/cody.int.spec.ts`
- Line 462 comment: `plan-review` → `plan-gap`
- Line 464: `expect(ALL_IMPL_STAGE_NAMES).toContain('plan-review')` → `'plan-gap'`

**Acceptance:**
- [ ] Zero test files reference `plan-review` (verify: `grep -r 'plan-review' tests/`)
- [ ] All new `handlePlanGapValidation` tests pass
- [ ] All new `validatePlanGapReport` tests pass

---

## Step 12: Verify everything compiles and tests pass

**Commands:**
```bash
# TypeScript compiles
pnpm -s tsc --noEmit

# All cody unit tests pass
pnpm vitest run tests/unit/scripts/cody/

# Integration tests pass
pnpm vitest run tests/int/scripts/cody.int.spec.ts

# Main cody.spec.ts passes
pnpm vitest run tests/unit/scripts/cody.spec.ts

# Lint passes
pnpm -s lint

# Zero remaining references
grep -r 'plan-review' scripts/cody/ .opencode/ opencode.json tests/ --include='*.ts' --include='*.md' --include='*.json' | grep -v node_modules | grep -v .tasks/
# Should return 0 results
```

**Acceptance:**
- [ ] `tsc --noEmit` passes
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Lint passes
- [ ] Zero `plan-review` references in source/config/test files

---

## Files Changed Summary

| File | Action | Lines |
|------|--------|-------|
| `.opencode/agents/plan-review.md` | DELETE | all |
| `.opencode/agents/plan-gap.md` | NEW | ~100 |
| `.opencode/agents/architect.md` | MODIFIED | 14, 32-35 |
| `.opencode/agents/build.md` | MODIFIED | 63 |
| `opencode.json` | MODIFIED | 33-36 |
| `scripts/cody/pipeline-utils.ts` | MODIFIED | 285, 327-332, 394, 400 |
| `scripts/cody/stage-prompts.ts` | MODIFIED | 35, 73-75, 106, 152, 203 |
| `scripts/cody/agent-runner.ts` | MODIFIED | 37 |
| `scripts/cody/content-validators.ts` | MODIFIED | 108-135 |
| `scripts/cody/stage-hooks.ts` | MODIFIED | 7-8, 22-28, 64-101 |
| `scripts/cody/cody.ts` | MODIFIED | 4-11, 658-661, 787-823 |
| `.opencode/PIPELINE.md` | MODIFIED | 9, 25, 46, 81-89, 168, 177-179, 193 |
| `tests/unit/scripts/cody/stage-hooks.test.ts` | MODIFIED | 12-19, 62-121, 190-201 |
| `tests/unit/scripts/cody/content-validators.test.ts` | MODIFIED | 12-24, 169-221 |
| `tests/unit/scripts/cody/stage-prompts.test.ts` | MODIFIED | 38, 45, 67-79, 110 |
| `tests/unit/scripts/cody/pipeline-utils.test.ts` | MODIFIED | 510-534 |
| `tests/unit/scripts/cody/bug-exposure.test.ts` | MODIFIED | 292-294 |
| `tests/unit/scripts/cody/bugfixes.test.ts` | MODIFIED | 33, 54 |
| `tests/unit/scripts/cody/cody-utils-extended.test.ts` | MODIFIED | 157, 922 |
| `tests/unit/scripts/cody/agent-runner.test.ts` | MODIFIED | 78-79 |
| `tests/unit/scripts/cody.spec.ts` | MODIFIED | 1004 |
| `tests/int/scripts/cody.int.spec.ts` | MODIFIED | 462, 464 |

**22 files total** (1 deleted, 1 new, 20 modified)
