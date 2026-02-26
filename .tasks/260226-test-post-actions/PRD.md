# PRD: Cody Pipeline Post-Action Validation Tests

## 1. Overview

**Test Task ID**: `260226-test-post-actions`  
**Related Cody Task**: `260223-cody-state-machine-rewrite`  
**Domain**: CI/CD - Cody Pipeline Testing  
**Priority**: Medium

### Summary

Test the post-action validators that run after each stage completes. These actions validate stage outputs, resolve profiles, check gates, and commit files.

---

## 2. Background

Post-actions run after each stage completes:

| Action | Purpose |
|--------|---------|
| `validate-task-json` | Ensure task.json is valid |
| `resolve-profile` | Set ctx.profile, set pipelineNeedsRebuild |
| `check-gate` | Pause for approval if gate file exists |
| `commit-task-files` | Commit and push |

Each post-action can:
- Modify context
- Throw errors (validation failures)
- Throw `PipelinePausedError` (gate approval)

---

## 3. Test Objectives

| Objective | Description | Test Type |
|-----------|-------------|-----------|
| O1 | Verify `validate-task-json` passes valid tasks | Unit |
| O2 | Verify `validate-task-json` fails invalid tasks | Unit |
| O3 | Verify `resolve-profile` sets correct profile | Unit |
| O4 | Verify `resolve-profile` sets pipelineNeedsRebuild | Unit |
| O5 | Verify post-actions run in correct order | Integration |
| O6 | Verify post-action errors propagate correctly | Integration |

---

## 4. Test Scenarios

### 4.1 Unit Tests

| ID | Scenario | Input | Expected Output |
|----|----------|-------|-----------------|
| UT-01 | Validate valid task.json | Valid TaskDefinition | `{ valid: true, errors: [] }` |
| UT-02 | Validate invalid task.json (missing fields) | `{ task_type: 'fix_bug' }` | `{ valid: false, errors: [...] }` |
| UT-03 | Validate invalid task_type | `{ task_type: 'invalid' }` | Validation error |
| UT-04 | Validate invalid risk_level | `{ risk_level: 'critical' }` | Validation error |
| UT-05 | Resolve profile for low-risk bug | `{ task_type: 'fix_bug', risk_level: 'low' }` | `'lightweight'` |
| UT-06 | Resolve profile for medium feature | `{ task_type: 'implement_feature', risk_level: 'medium' }` | `'standard'` |
| UT-07 | pipelineNeedsRebuild set after taskify | ctx after taskify stage | `ctx.pipelineNeedsRebuild === true` |

### 4.2 Integration Tests

| ID | Scenario | Description |
|----|----------|-------------|
| IT-01 | Post-actions run after spec stage | Verify all spec post-actions execute |
| IT-02 | Post-action failure aborts pipeline | Throw error in post-action → verify pipeline fails |
| IT-03 | Post-action modifies context | Verify ctx changes persist to next stage |
| IT-04 | PipelinePausedError from post-action | Throw PipelinePausedError → verify pipeline pauses |

---

## 5. Implementation Plan

### Step 1: Create Test File
- Location: `tests/unit/scripts/cody/post-actions.test.ts`
- Mock: `executePostAction`, stage handlers

### Step 2: Implement Unit Tests
- Import validation functions from `pipeline-utils.ts`
- Test task validation with various invalid inputs
- Test profile resolution

### Step 3: Implement Integration Tests
- Use existing stage definitions from `pipeline/definitions.ts`
- Test full post-action chain

### Step 4: Verify
```bash
pnpm vitest run tests/unit/scripts/cody/post-actions.test.ts
pnpm vitest run tests/int/scripts/cody.int.spec.ts --grep "post-action"
```

---

## 6. Dependencies

- `scripts/cody/pipeline-utils.ts` - `validateTask`, `resolvePipelineProfile`
- `scripts/cody/pipeline/post-actions.ts` - Post-action definitions
- `scripts/cody/pipeline/definitions.ts` - Stage definitions with post-actions

---

## 7. Acceptance Criteria

| Criterion | Description |
|-----------|-------------|
| AC-1 | All unit tests pass (validation, profile resolution) |
| AC-2 | All integration tests pass (post-action execution) |
| AC-3 | Invalid task.json correctly rejected with specific errors |
| AC-4 | Profile correctly resolved based on task type + risk |
| AC-5 | pipelineNeedsRebuild set after taskify |
| AC-6 | Post-action errors correctly propagate to pipeline state |

---

## 8. Related Documentation

- [Cody Pipeline README](../scripts/cody/README.md) - Post-Actions section
- [260223-cody-state-machine-rewrite/plan.md](../.tasks/260223-cody-state-machine-rewrite/plan.md) - Post-action fixes (G13, G15)
