# PRD: Cody Pipeline Gate/Pause Mechanism Tests

## 1. Overview

**Test Task ID**: `260226-test-gate-pause`  
**Related Cody Task**: `260223-cody-state-machine-rewrite`  
**Domain**: CI/CD - Cody Pipeline Testing  
**Priority**: High

### Summary

Test the gate mechanism that pauses the pipeline for human approval. Gates create `gate-<name>.md` files and throw `PipelinePausedError` to halt execution until `@cody approve` is received.

---

## 2. Background

Gates pause the pipeline for human approval:
1. Stage with `check-gate` post-action creates `gate-<name>.md`
2. Pipeline throws `PipelinePausedError`
3. Human reviews and adds `@cody approve` comment
4. `handleGateApproval()` resumes pipeline

Gate types:
- **hard-stop**: High-risk tasks require explicit approval
- **risk-gated**: Medium-risk tasks pause after architect

---

## 3. Test Objectives

| Objective | Description | Test Type |
|-----------|-------------|-----------|
| O1 | Verify gate file creation (`gate-<name>.md`) | Unit |
| O2 | Verify `PipelinePausedError` is thrown at gate | Unit |
| O3 | Verify pipeline state changes to 'paused' on gate | Integration |
| O4 | Verify `@cody approve` comment resumes pipeline | Integration |
| O5 | Verify parallel stages handle `PipelinePausedError` correctly | Integration |

---

## 4. Test Scenarios

### 4.1 Unit Tests

| ID | Scenario | Input | Expected Output |
|----|----------|-------|-----------------|
| UT-01 | Gate file created | Run `check-gate` post-action | `gate-architect.md` exists with correct content |
| UT-02 | Gate content format | Gate file content | Contains risk table, plan snippet, approval instructions |
| UT-03 | PipelinePausedError thrown | Gate check returns 'waiting' | `PipelinePausedError` is thrown |
| UT-04 | No pause when approved | Gate check returns 'approved' | No error, pipeline continues |
| UT-05 | Gate approval parsing | Comment body with `@cody approve` | Extracts approval correctly |

### 4.2 Integration Tests

| ID | Scenario | Description |
|----|----------|-------------|
| IT-01 | Pipeline pauses at hard-stop gate | Run pipeline with high-risk task → verify state = 'paused' |
| IT-02 | Pipeline pauses at risk gate | Run pipeline with medium-risk task → verify state = 'paused' after architect |
| IT-03 | Resume after approval | Pause at gate → add approval comment → verify pipeline completes |
| IT-04 | Parallel stage PipelinePausedError | One parallel stage pauses → verify pipeline pauses (not fails) |
| IT-05 | Gate comment posted to issue | Verify gate comment contains `## 🚦 Risk Gate` or `## 🚫 Hard Stop` |

---

## 5. Implementation Plan

### Step 1: Create Test File
- Location: `tests/unit/scripts/cody/gate-handler.test.ts`
- Mock: `handleGateApproval`, GitHub API calls

### Step 2: Implement Unit Tests
- Test gate file creation logic
- Test `PipelinePausedError` throwing
- Test approval parsing

### Step 3: Implement Integration Tests
- Use existing gate-*.md files from `.tasks/` as fixtures
- Test full pause/resume flow

### Step 4: Verify
```bash
pnpm vitest run tests/unit/scripts/cody/gate-handler.test.ts
pnpm vitest run tests/int/scripts/cody.int.spec.ts --grep "gate"
```

---

## 6. Dependencies

- `scripts/cody/handlers/gate-handler.ts` - Gate approval handler
- `scripts/cody/pipeline/post-actions.ts` - `check-gate` post-action
- `scripts/cody/engine/types.ts` - `PipelinePausedError` class
- `scripts/cody/cody-utils.ts` - GitHub API utilities

---

## 7. Acceptance Criteria

| Criterion | Description |
|-----------|-------------|
| AC-1 | All unit tests pass (gate file creation, error throwing) |
| AC-2 | All integration tests pass (pause/resume flow) |
| AC-3 | Pipeline correctly pauses at hard-stop and risk gates |
| AC-4 | `@cody approve` correctly resumes pipeline |
| AC-5 | Parallel stage PipelinePausedError is handled (paused, not failed) |

---

## 8. Related Documentation

- [Cody Pipeline README](../scripts/cody/README.md) - Gates section
- [260223-cody-state-machine-rewrite/plan.md](../.tasks/260223-cody-state-machine-rewrite/plan.md) - G30, G42 details
