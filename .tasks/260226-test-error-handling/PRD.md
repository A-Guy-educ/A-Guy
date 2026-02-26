# PRD: Cody Pipeline Error Handling Tests

## 1. Overview

**Test Task ID**: `260226-test-error-handling`  
**Related Cody Task**: `260219-cody-pipeline-bugfix`  
**Domain**: CI/CD - Cody Pipeline Testing  
**Priority**: Medium

### Summary

Test the pipeline's error handling mechanisms including stage failures, timeouts, retries, and graceful degradation.

---

## 2. Background

Error handling in the Cody pipeline:
- **Stage fails** → state = failed, pipeline stops
- **Retry**: `maxRetries` in stage definition (default 2)
- **Skip**: `shouldSkip` returns `{shouldSkip: true, reason}`
- **Pause**: throw `PipelinePausedError`

Key scenarios:
- Stage timeout (handler exceeds timeout)
- Stage failure (handler throws error)
- Retry exhaustion (all retries used)
- Missing input files (stage output doesn't exist)

---

## 3. Test Objectives

| Objective | Description | Test Type |
|-----------|-------------|-----------|
| O1 | Verify stage failure sets correct state | Unit |
| O2 | Verify retry mechanism works correctly | Unit |
| O3 | Verify timeout handling | Unit |
| O4 | Verify missing input file handling | Integration |
| O5 | Verify error messages are captured | Integration |

---

## 4. Test Scenarios

### 4.1 Unit Tests

| ID | Scenario | Input | Expected Output |
|----|----------|-------|-----------------|
| UT-01 | Stage failure recorded | `updateStageStatus('build', 'failed')` | `status.stages.build.state === 'failed'` |
| UT-02 | Retry count tracked | 3 failures with retries | `status.stages.build.retries === 2` |
| UT-03 | Timeout recorded | Stage times out | `status.stages.build.state === 'timeout'` |
| UT-04 | Error message captured | Failure with error message | `status.stages.build.error` contains message |
| UT-05 | Retry exhaustion | All retries used | `status.stages.build.state === 'failed'`, pipeline stops |

### 4.2 Integration Tests

| ID | Scenario | Description |
|----|----------|-------------|
| IT-01 | Stage fails, retries, then succeeds | Verify retry mechanism |
| IT-02 | Stage fails, all retries exhausted | Verify pipeline stops after exhaustion |
| IT-03 | Stage times out | Verify timeout state and message |
| IT-04 | Missing input file | Stage output doesn't exist → verify graceful handling |
| IT-05 | Pipeline completes after error | Other parallel stages complete when one fails |

---

## 5. Implementation Plan

### Step 1: Create Test File
- Location: `tests/unit/scripts/cody/error-handling.test.ts`
- Mock: Stage handlers, file system

### Step 2: Implement Unit Tests
- Test status update functions
- Test retry tracking
- Test timeout handling

### Step 3: Implement Integration Tests
- Use existing test fixtures
- Simulate failures and timeouts

### Step 4: Verify
```bash
pnpm vitest run tests/unit/scripts/cody/error-handling.test.ts
pnpm vitest run tests/int/scripts/cody.int.spec.ts --grep "error\|fail\|timeout"
```

---

## 6. Dependencies

- `scripts/cody/cody-utils.ts` - `updateStageStatus`, `readStatus`
- `scripts/cody/engine/state-machine.ts` - Execution loop
- `scripts/cody/pipeline/definitions.ts` - Stage definitions with maxRetries

---

## 7. Acceptance Criteria

| Criterion | Description |
|-----------|-------------|
| AC-1 | All unit tests pass |
| AC-2 | All integration tests pass |
| AC-3 | Stage failures correctly recorded with error messages |
| AC-4 | Retry count tracked correctly |
| AC-5 | Timeouts handled gracefully |
| AC-6 | Pipeline stops after retry exhaustion |

---

## 8. Related Documentation

- [Cody Pipeline README](../scripts/cody/README.md) - Error Handling section
- [260219-cody-pipeline-bugfix/task.md](../.tasks/260219-cody-pipeline-bugfix/task.md) - Related bugfix
