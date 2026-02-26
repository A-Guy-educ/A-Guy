# PRD: Cody Pipeline Profile Resolution Tests

## 1. Overview

**Test Task ID**: `260226-test-profile-resolution`  
**Related Cody Task**: `260223-cody-lightweight-pipeline`  
**Domain**: CI/CD - Cody Pipeline Testing  
**Priority**: High

### Summary

Test the pipeline profile resolution logic that determines whether a task runs in `standard` or `lightweight` mode. This is critical for two-phase execution where the profile determines which stages run.

---

## 2. Background

The Cody pipeline supports two profiles:
- **standard**: Full pipeline (includes gap, plan-gap, auditor, apply-audit)
- **lightweight**: Skips spec, gap, plan-gap, auditor, apply-audit

Profile is resolved in `resolve-profile` post-action based on:
- Explicit `pipeline_profile` in task.json
- Task type + risk level (fix_bug/refactor/ops + low risk = lightweight)

Two-phase execution requires proper profile resolution to determine the correct stage order after taskify.

---

## 3. Test Objectives

| Objective | Description | Test Type |
|-----------|-------------|-----------|
| O1 | Verify `resolvePipelineProfile` returns `lightweight` for low-risk bug fixes | Unit |
| O2 | Verify `resolvePipelineProfile` returns `standard` for medium-risk features | Unit |
| O3 | Verify explicit agent override takes precedence | Unit |
| O4 | Verify two-phase rebuild returns correct stages based on profile | Integration |
| O5 | Verify profile is stored in context and accessible throughout pipeline | Integration |

---

## 4. Test Scenarios

### 4.1 Unit Tests

| ID | Scenario | Input | Expected Output |
|----|----------|-------|-----------------|
| UT-01 | Low-risk bug fix | `{ task_type: 'fix_bug', risk_level: 'low' }` | `'lightweight'` |
| UT-02 | Low-risk refactor | `{ task_type: 'refactor', risk_level: 'low' }` | `'lightweight'` |
| UT-03 | Low-risk ops | `{ task_type: 'ops', risk_level: 'low' }` | `'lightweight'` |
| UT-04 | Medium-risk feature | `{ task_type: 'implement_feature', risk_level: 'medium' }` | `'standard'` |
| UT-05 | High-risk bug fix | `{ task_type: 'fix_bug', risk_level: 'high' }` | `'standard'` |
| UT-06 | Low-risk feature (not lightweight) | `{ task_type: 'implement_feature', risk_level: 'low' }` | `'standard'` |
| UT-07 | Explicit override to standard | `{ task_type: 'fix_bug', risk_level: 'low', pipeline_profile: 'standard' }` | `'standard'` |
| UT-08 | Explicit override to lightweight | `{ task_type: 'implement_feature', risk_level: 'high', pipeline_profile: 'lightweight' }` | `'lightweight'` |
| UT-09 | Invalid profile value | `{ pipeline_profile: 'invalid' }` | Validation error |

### 4.2 Integration Tests

| ID | Scenario | Description |
|----|----------|-------------|
| IT-01 | Two-phase rebuild with standard | Run taskify → verify rebuild returns all spec + impl stages |
| IT-02 | Two-phase rebuild with lightweight | Run taskify → verify rebuild returns only core stages |
| IT-03 | Profile persists in context | Verify `ctx.profile` is accessible in post-actions |
| IT-04 | Profile affects stage skipping | Verify lightweight skips spec/gap/auditor stages |

---

## 5. Implementation Plan

### Step 1: Create Test File
- Location: `tests/unit/scripts/cody/pipeline-profile.test.ts`
- Framework: Vitest with mocking

### Step 2: Implement Unit Tests
- Import `resolvePipelineProfile` from `pipeline-utils.ts`
- Mock dependencies if needed
- Cover all scenarios in 4.1

### Step 3: Implement Integration Tests
- Use existing test fixtures from `tests/int/scripts/cody.int.spec.ts`
- Add profile-specific scenarios

### Step 4: Verify
```bash
pnpm vitest run tests/unit/scripts/cody/pipeline-profile.test.ts
pnpm vitest run tests/int/scripts/cody.int.spec.ts --grep "profile"
```

---

## 6. Dependencies

- `scripts/cody/pipeline-utils.ts` - Contains `resolvePipelineProfile` function
- `scripts/cody/pipeline/definitions.ts` - Stage definitions
- `scripts/cody/cody-utils.ts` - Context management

---

## 7. Acceptance Criteria

| Criterion | Description |
|-----------|-------------|
| AC-1 | All 9 unit tests pass |
| AC-2 | All 4 integration tests pass |
| AC-3 | Profile resolution correctly identifies lightweight tasks |
| AC-4 | Explicit agent override takes precedence over heuristics |
| AC-5 | Two-phase rebuild uses correct stage order based on profile |

---

## 8. Related Documentation

- [Cody Pipeline README](../scripts/cody/README.md) - Pipeline modes and profiles
- [260223-cody-lightweight-pipeline/plan.md](../.tasks/260223-cody-lightweight-pipeline/plan.md) - Original implementation
