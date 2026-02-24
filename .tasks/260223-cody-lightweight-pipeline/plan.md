# Plan: Cody Lightweight Pipeline for Simple Fixes

## Summary

The Cody pipeline currently runs the full heavyweight flow for every task — including spec generation, gap analysis, plan-gap analysis, auditor, and apply-audit stages — even for simple bug fixes or small changes. This produces overkill for straightforward fixes where these stages add latency (and LLM cost) without proportional value.

**Solution**: Introduce a `pipeline_profile` concept (driven by the taskify agent) that allows simple/low-risk tasks to skip heavyweight stages while preserving them for complex changes. The lightweight profile skips: `spec`, `gap`, `plan-gap`, `auditor`, `apply-audit` — 5 LLM calls saved.

## Requirements Traced

- **REQ-1**: Simple fixes should not trigger the full pipeline (user-reported issue)
- **REQ-1a**: Spec stage should also be skipped for simple fixes (user clarification)
- **REQ-2**: Complex/risky changes should still get full pipeline treatment
- **REQ-3**: The mechanism must be opt-out safe — defaulting to full pipeline if unsure

## Assumptions

1. The `taskify` agent already classifies `risk_level` and `task_type` — we leverage these to derive the pipeline profile
2. The existing `input_quality` skip mechanism already handles `spec` skipping — when `skip_stages` includes `spec`, taskify promotes `task.md` content to `spec.md` directly. Lightweight uses this same mechanism.
3. Stages skipped in lightweight: `spec`, `gap`, `plan-gap`, `auditor`, `apply-audit`
4. Stages that ALWAYS run: `taskify`, `build`, `commit`, `verify`, `pr` (core delivery stages)
5. `architect` still runs in lightweight — it reads the promoted `spec.md` (written by taskify) and produces a plan
6. Downstream agents (architect, build) don't need changes — they read `spec.md` which taskify writes as a promoted file
7. We will NOT touch the GitHub Actions workflow YAML — all changes are in the TypeScript pipeline logic and the taskify agent prompt

---

### Step 1: Add `pipeline_profile` to TaskDefinition and taskify agent

**Goal**: Teach the taskify agent to classify tasks as `lightweight` or `standard` based on risk and complexity, and emit this in `task.json`. For lightweight tasks, taskify also promotes `task.md` → `spec.md` (reusing the existing `input_quality` skip mechanism).

**Files to Touch**:
- `scripts/cody/pipeline-utils.ts` (MODIFIED — lines 10-100, 146-211, 213-326: add type, validation, profile resolver, normalize)
- `.opencode/agents/taskify.md` (MODIFIED — add pipeline_profile output field + decision criteria + lightweight promotion rules)

**Exact Behavior**:

1. **New type**: Add `pipeline_profile?: 'lightweight' | 'standard'` to `TaskDefinition` interface
2. **New constant**: `VALID_PIPELINE_PROFILES = ['lightweight', 'standard'] as const`
3. **New function**: `resolvePipelineProfile(taskDef: TaskDefinition): 'lightweight' | 'standard'`
   - Returns `'lightweight'` when: `risk_level === 'low'` AND `task_type` in `['fix_bug', 'refactor', 'docs', 'ops']`
   - Returns `'standard'` for everything else (default safe fallback)
   - If `taskDef.pipeline_profile` is explicitly set and valid, use it (agent override)
4. **Update `normalizeTask()`**: If `pipeline_profile` is present, validate it. If missing, leave as `undefined` (resolved at runtime by `resolvePipelineProfile`)
5. **Update `validateTask()`**: Accept optional `pipeline_profile` field, validate against `VALID_PIPELINE_PROFILES`
6. **Update taskify agent** (`.opencode/agents/taskify.md`):
   - Add `pipeline_profile` to the output contract JSON
   - Add decision criteria: "Set `lightweight` for low-risk bug fixes, refactors, docs, and ops tasks. Set `standard` for everything else."
   - For lightweight tasks, instruct taskify to set `input_quality.skip_stages: ['spec']` AND write a promoted `spec.md` from `task.md` content (the existing mechanism handles the rest)

**Tests** (location: `tests/unit/scripts/cody/pipeline-utils.test.ts` — NEW):

1. **Test: `resolvePipelineProfile returns lightweight for low-risk bug fixes`**
   - Input: `{ task_type: 'fix_bug', risk_level: 'low', ... }`
   - Expected: `'lightweight'`
   - FAILS before: function doesn't exist

2. **Test: `resolvePipelineProfile returns standard for medium-risk features`**
   - Input: `{ task_type: 'implement_feature', risk_level: 'medium', ... }`
   - Expected: `'standard'`
   - FAILS before: function doesn't exist

3. **Test: `resolvePipelineProfile returns standard for high-risk bug fixes`**
   - Input: `{ task_type: 'fix_bug', risk_level: 'high', ... }`
   - Expected: `'standard'`
   - FAILS before: function doesn't exist

4. **Test: `resolvePipelineProfile returns lightweight for low-risk refactor`**
   - Input: `{ task_type: 'refactor', risk_level: 'low', ... }`
   - Expected: `'lightweight'`
   - FAILS before: function doesn't exist

5. **Test: `resolvePipelineProfile returns standard for low-risk implement_feature`**
   - Input: `{ task_type: 'implement_feature', risk_level: 'low', ... }`
   - Expected: `'standard'` (features always get full treatment regardless of risk)
   - FAILS before: function doesn't exist

6. **Test: `resolvePipelineProfile respects explicit agent override`**
   - Input: `{ task_type: 'fix_bug', risk_level: 'low', pipeline_profile: 'standard', ... }`
   - Expected: `'standard'` (agent explicitly chose standard even though heuristics say lightweight)
   - FAILS before: function doesn't exist

7. **Test: `validateTask accepts valid pipeline_profile values`**
   - Input: task.json with `pipeline_profile: 'lightweight'`
   - Expected: validation passes
   - FAILS before: field not validated

8. **Test: `validateTask rejects invalid pipeline_profile values`**
   - Input: task.json with `pipeline_profile: 'turbo'`
   - Expected: validation error
   - FAILS before: field not validated

**Acceptance Criteria**:
- [ ] `resolvePipelineProfile()` exported from pipeline-utils.ts
- [ ] TaskDefinition interface includes optional `pipeline_profile` field
- [ ] Validation accepts/rejects pipeline_profile correctly
- [ ] Taskify agent .md includes pipeline_profile in output contract with clear decision criteria
- [ ] Taskify agent instructions say to promote task.md → spec.md for lightweight tasks
- [ ] All 8 tests pass

---

### Step 2: Build lightweight pipeline variants (spec + impl)

**Goal**: Create lightweight variants of both the spec and impl pipelines, plus selector functions.

**Files to Touch**:
- `scripts/cody/pipeline-utils.ts` (MODIFIED — after line 500, add lightweight pipeline constants + selectors)

**Exact Behavior**:

1. **Lightweight spec stages**: `['taskify']` — spec is skipped via `input_quality` (taskify promotes spec.md), gap is dropped entirely
2. **Lightweight impl pipeline**: `['architect', 'build', 'commit', 'verify', 'pr']` — drops `plan-gap`, parallel `auditor` group, `apply-audit`
3. **New constants**:
   - `LIGHTWEIGHT_IMPL_PIPELINE: PipelineStage[] = ['architect', 'build', 'commit', 'verify', 'pr']`
   - `ALL_LIGHTWEIGHT_IMPL_STAGE_NAMES = flattenPipeline(LIGHTWEIGHT_IMPL_PIPELINE)`
4. **New functions**:
   - `getImplPipeline(profile: 'lightweight' | 'standard'): PipelineStage[]` — returns the appropriate pipeline
   - `getAllImplStageNames(profile: 'lightweight' | 'standard'): string[]` — returns flattened stage names
   - `getSpecStagesForProfile(profile: 'lightweight' | 'standard', clarify: boolean): string[]`
     - standard: `['taskify', 'spec', 'gap']` + optional `'clarify'`
     - lightweight: `['taskify']` + optional `'clarify'` (spec skipped via input_quality, gap dropped)

**Tests** (location: `tests/unit/scripts/cody/pipeline-utils.test.ts`):

1. **Test: `getImplPipeline('standard') returns full pipeline with all stages`**
   - Expected: matches current `IMPL_PIPELINE` (7 entries including parallel group)
   - FAILS before: function doesn't exist

2. **Test: `getImplPipeline('lightweight') returns reduced pipeline`**
   - Expected: `['architect', 'build', 'commit', 'verify', 'pr']` (5 entries, no parallel group)
   - FAILS before: function doesn't exist

3. **Test: `getImplPipeline('lightweight') does not include plan-gap, auditor, or apply-audit`**
   - Expected: flattened stage names don't include 'auditor', 'apply-audit', 'plan-gap'
   - FAILS before: function doesn't exist

4. **Test: `getSpecStagesForProfile('lightweight', false) returns only taskify`**
   - Expected: `['taskify']`
   - FAILS before: function doesn't exist

5. **Test: `getSpecStagesForProfile('standard', false) returns taskify, spec, gap`**
   - Expected: `['taskify', 'spec', 'gap']`
   - FAILS before: function doesn't exist

6. **Test: `getSpecStagesForProfile('lightweight', true) returns taskify + clarify`**
   - Expected: `['taskify', 'clarify']`
   - FAILS before: function doesn't exist

7. **Test: `getAllImplStageNames('lightweight') returns flat list without audit stages`**
   - Expected: `['architect', 'build', 'commit', 'verify', 'pr']`
   - FAILS before: function doesn't exist

**Acceptance Criteria**:
- [ ] `LIGHTWEIGHT_IMPL_PIPELINE` exported
- [ ] `getImplPipeline()` returns correct pipeline for each profile
- [ ] `getSpecStagesForProfile()` returns correct stages for each profile
- [ ] Lightweight impl pipeline has exactly 5 stages: architect, build, commit, verify, pr
- [ ] Lightweight spec stages has only taskify (spec promoted via input_quality)
- [ ] Standard pipelines unchanged (backward compatible)
- [ ] All 7 tests pass

---

### Step 3: Wire pipeline profile into spec pipeline (cody.ts)

**Goal**: Make `runSpecPipeline` resolve the pipeline profile after taskify completes, then use it to determine which remaining spec stages to run.

**Files to Touch**:
- `scripts/cody/cody.ts` (MODIFIED — `runSpecPipeline` function, ~lines 283-538)

**Exact Behavior**:

The key insight: taskify runs first (always). After taskify, we read `task.json`, resolve the profile, and dynamically decide the remaining stages.

Current code (line 329):
```typescript
const stages = input.clarify ? ['taskify', 'spec', 'gap', 'clarify'] : ['taskify', 'spec', 'gap']
```

Change to:
```typescript
// Start with just taskify — remaining stages determined after taskify produces task.json
let stages = ['taskify']
```

After the taskify stage completes and task.json is validated (~line 475), add:
```typescript
// Resolve pipeline profile from task.json
const taskDef = readTask(taskDir)
const profile = taskDef ? resolvePipelineProfile(taskDef) : 'standard'
console.log(`  Pipeline profile: ${profile}`)

// Determine remaining spec stages based on profile
const remainingStages = getSpecStagesForProfile(profile, input.clarify ?? false).filter(s => s !== 'taskify')
stages.push(...remainingStages)
```

For lightweight: taskify already sets `input_quality.skip_stages: ['spec']` and writes promoted `spec.md`, so the existing skip logic handles spec. Gap is simply not in the stage list. Net result: only taskify runs as an LLM call.

- Log: `"Pipeline profile: lightweight (spec promoted by taskify, gap/plan-gap/auditor/apply-audit skipped)"`

**Tests** (location: `tests/unit/scripts/cody/cody-spec-pipeline.test.ts` — NEW):

1. **Test: `spec pipeline with lightweight profile skips spec and gap stages`**
   - Setup: task.json with `risk_level: 'low', task_type: 'fix_bug', pipeline_profile: 'lightweight'`
   - Pre-create `spec.md` (simulating taskify promotion) and `task.json`
   - Mock: `runAgentWithFileWatch` to track which stages are called
   - Expected: only taskify stage is called as LLM; spec and gap are NOT called
   - FAILS before: spec and gap always run

2. **Test: `spec pipeline with standard profile runs all spec stages`**
   - Setup: task.json with `risk_level: 'medium', task_type: 'implement_feature'`
   - Expected: taskify, spec, and gap stages all run
   - FAILS before: test doesn't exist (regression guard)

**Acceptance Criteria**:
- [ ] Lightweight tasks: only taskify runs as LLM call in spec pipeline
- [ ] Lightweight tasks: spec.md exists (promoted by taskify via input_quality)
- [ ] Standard tasks still run taskify → spec → gap (no regression)
- [ ] Profile is logged for observability
- [ ] Both tests pass

---

### Step 4: Wire pipeline profile into impl pipeline (cody.ts)

**Goal**: Make `runImplPipeline` use the lightweight pipeline when the task profile is `lightweight`, and update rerun pipeline accordingly.

**Files to Touch**:
- `scripts/cody/cody.ts` (MODIFIED — `runImplPipeline` ~lines 540-931, `runRerunPipeline` ~lines 949-1017)

**Exact Behavior**:

**In `runImplPipeline`** (~line 575, after `taskDef` is read):
```typescript
// Replace: const pipeline: PipelineStage[] = [...IMPL_PIPELINE]
const profile = resolvePipelineProfile(taskDef)
const pipeline: PipelineStage[] = getImplPipeline(profile)
console.log(`Pipeline profile: ${profile} (${flattenPipeline(pipeline).join(' → ')})`)
```

**In `runRerunPipeline`** (~line 994):
```typescript
// Replace: let fromIndex = ALL_IMPL_STAGE_NAMES.indexOf(normalizedFromStage)
const taskDef = readTask(taskDir)
const profile = taskDef ? resolvePipelineProfile(taskDef) : 'standard'
const stageNames = getAllImplStageNames(profile)
let fromIndex = stageNames.indexOf(normalizedFromStage)
```

And update the deletion loop (~line 1003):
```typescript
// Replace: const stagesToDelete = ALL_IMPL_STAGE_NAMES.slice(fromIndex)
const stagesToDelete = stageNames.slice(fromIndex)
```

Post-stage hooks for `plan-gap` and `apply-audit` are naturally skipped since those stages won't appear in the lightweight pipeline loop.

**Tests** (location: `tests/unit/scripts/cody/cody-impl-pipeline.test.ts` — NEW):

1. **Test: `impl pipeline with lightweight profile uses reduced stage list`**
   - Setup: task.json with `risk_level: 'low', task_type: 'fix_bug'`, pre-create `clarified.md` and `spec.md`
   - Mock: `runAgentWithFileWatch` and scripted stage runners to track calls
   - Expected: `plan-gap`, `auditor`, `apply-audit` are NOT called; `architect`, `build`, `commit`, `verify`, `pr` ARE called
   - FAILS before: all stages always run

2. **Test: `impl pipeline with standard profile uses full stage list`**
   - Setup: task.json with `risk_level: 'high', task_type: 'implement_feature'`
   - Expected: all stages run including `plan-gap`, `auditor`, `apply-audit`
   - FAILS before: test doesn't exist (regression guard)

3. **Test: `rerun pipeline with lightweight profile uses correct stage names for deletion`**
   - Setup: task.json with lightweight profile, create all stage output files (including auditor.md, plan-gap.md)
   - Rerun from `build`
   - Expected: only lightweight stage files from build onward are deleted (build.md, commit.md, verify.md, pr.md). auditor.md and plan-gap.md are NOT deleted (they shouldn't exist but also shouldn't be in the deletion list)
   - FAILS before: rerun uses ALL_IMPL_STAGE_NAMES which includes all stages

**Acceptance Criteria**:
- [ ] Lightweight impl pipeline runs exactly: architect → build → commit → verify → pr
- [ ] Standard impl pipeline unchanged: architect → plan-gap → build → commit → verify+auditor → apply-audit → pr
- [ ] Rerun with lightweight profile uses correct stage name list
- [ ] Pipeline profile is logged with stage flow
- [ ] All 3 tests pass

---

### Step 5: Update stage-prompts.ts for profile-aware stage lists

**Goal**: Update the exported helper functions in stage-prompts.ts to be profile-aware for any callers.

**Files to Touch**:
- `scripts/cody/stage-prompts.ts` (MODIFIED — lines 190-202, update helper functions)

**Exact Behavior**:
- Update `getImplStages(profile?: 'lightweight' | 'standard')`: delegates to `getAllImplStageNames(profile ?? 'standard')` from pipeline-utils
- Update `getSpecStages(profile?: 'lightweight' | 'standard')`: delegates to `getSpecStagesForProfile(profile ?? 'standard', false)` from pipeline-utils
- Default to `'standard'` when no profile provided (backward compatible)

**Tests** (location: `tests/unit/scripts/cody/stage-prompts.test.ts` — NEW):

1. **Test: `getImplStages('lightweight') returns reduced stage list`**
   - Expected: `['architect', 'build', 'commit', 'verify', 'pr']`
   - FAILS before: function doesn't accept profile parameter

2. **Test: `getImplStages() with no argument returns full stage list (backward compat)`**
   - Expected: `['architect', 'plan-gap', 'build', 'commit', 'verify', 'auditor', 'apply-audit', 'pr']`
   - FAILS before: test doesn't exist (regression guard)

3. **Test: `getSpecStages('lightweight') returns only taskify`**
   - Expected: `['taskify']`
   - FAILS before: function doesn't accept profile parameter

**Acceptance Criteria**:
- [ ] `getImplStages()` without args returns same as before (backward compatible)
- [ ] `getImplStages('lightweight')` returns reduced list
- [ ] `getSpecStages('lightweight')` returns `['taskify']`
- [ ] All 3 tests pass

---

### Step 6: Integration test — end-to-end lightweight pipeline dry run

**Goal**: Verify the full lightweight pipeline flow works end-to-end with a dry run, confirming correct stage execution and status tracking.

**Files to Touch**:
- `tests/unit/scripts/cody/lightweight-pipeline.integration.test.ts` (NEW)

**Exact Behavior**:
- Create a task.md describing a simple fix
- Run the full pipeline logic (mocked backends) with dry_run=true
- Verify that only the expected stages are executed
- Verify status.json reflects the correct stages

**Tests**:

1. **Test: `lightweight pipeline dry run executes correct stages`**
   - Setup: task.md = "Fix typo in header component", dry_run=true
   - Mock: taskify writes task.json with `risk_level: 'low', task_type: 'fix_bug', pipeline_profile: 'lightweight', input_quality: { level: 'good_spec', skip_stages: ['spec'] }`
   - Also write promoted spec.md (as taskify would)
   - Expected stages executed: taskify, architect, build, commit, verify, pr
   - Expected stages NOT executed: spec, gap, plan-gap, auditor, apply-audit
   - FAILS before: all stages always execute

2. **Test: `standard pipeline dry run executes all stages`**
   - Setup: task.md = "Add new payment system", dry_run=true
   - Mock: taskify writes task.json with `risk_level: 'high', task_type: 'implement_feature'`
   - Expected: all stages execute including spec, gap, plan-gap, auditor, apply-audit
   - FAILS before: test doesn't exist (regression guard)

**Acceptance Criteria**:
- [ ] Lightweight pipeline skips 5 stages (spec, gap, plan-gap, auditor, apply-audit)
- [ ] Standard pipeline runs all stages
- [ ] Status tracking reflects actual stages run
- [ ] Both integration tests pass

---

## Lightweight vs Standard Pipeline Comparison

```
STANDARD (implement_feature, medium/high risk):
  Spec:  taskify → spec → gap → [clarify]
  Impl:  architect → plan-gap → build → commit → verify+auditor → apply-audit → pr
  Total LLM calls: ~9-10

LIGHTWEIGHT (fix_bug/refactor/docs/ops, low risk):
  Spec:  taskify (promotes spec.md directly)
  Impl:  architect → build → commit → verify → pr
  Total LLM calls: ~4
  Savings: 5-6 LLM calls (~20-60 min)
```

## Stage Summary

| Step | What it does | Time est. |
|------|-------------|-----------|
| Step 1 | Add pipeline_profile to TaskDefinition + taskify agent | 20 min |
| Step 2 | Build lightweight pipeline variants (spec + impl) | 10 min |
| Step 3 | Wire profile into spec pipeline | 15 min |
| Step 4 | Wire profile into impl pipeline | 20 min |
| Step 5 | Update stage-prompts helpers | 10 min |
| Step 6 | Integration test | 15 min |

**Total estimated time**: ~90 minutes

## Impact Analysis

- **Standard pipeline**: ZERO changes — all existing behavior preserved
- **Lightweight pipeline**: Saves ~5-6 LLM agent calls (spec, gap, plan-gap, auditor, apply-audit)
- **Estimated time savings for simple fixes**: 20-60 minutes per run
- **Risk**: Low — lightweight is opt-in via taskify classification, defaults to standard
- **Backward compatible**: All existing code paths unchanged, new functions have defaults

## Files Changed Summary

| File | Change Type | Lines Changed (est.) |
|------|------------|---------------------|
| `scripts/cody/pipeline-utils.ts` | MODIFIED | +70 |
| `scripts/cody/cody.ts` | MODIFIED | +40 |
| `scripts/cody/stage-prompts.ts` | MODIFIED | +15 |
| `.opencode/agents/taskify.md` | MODIFIED | +30 |
| `tests/unit/scripts/cody/pipeline-utils.test.ts` | NEW | +150 |
| `tests/unit/scripts/cody/cody-spec-pipeline.test.ts` | NEW | +80 |
| `tests/unit/scripts/cody/cody-impl-pipeline.test.ts` | NEW | +100 |
| `tests/unit/scripts/cody/stage-prompts.test.ts` | NEW | +50 |
| `tests/unit/scripts/cody/lightweight-pipeline.integration.test.ts` | NEW | +80 |
