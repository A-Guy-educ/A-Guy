# Pipeline Health Monitoring Utility Module

## Overview

Create a new utility module at `src/infra/utils/pipeline-health.ts` that exports a `PipelineHealthReport` class for monitoring Cody pipeline health.

## Requirements

### 1. PipelineHealthReport Class

Export a `PipelineHealthReport` class with the following methods:

- `checkStageHealth(stage: string): HealthStatus` - Check health status of a pipeline stage
- `generateReport(): Report` - Generate a comprehensive health report
- `getRetryRecommendation(failedStage: string): RetryStrategy` - Get retry strategy for a failed stage

### 2. TypeScript Interfaces

Define the following interfaces:

- `HealthStatus` - Represents the health status of a stage
- `Report` - Represents a comprehensive pipeline health report
- `RetryStrategy` - Represents retry recommendations for failed stages

### 3. Helper Function

- `getStageTimeout(stage: string): number` - Returns default timeouts per stage name

### 4. Documentation

- Add JSDoc comments on all exported members

### 5. Validation

- Include input validation using Zod schemas for all public method parameters

### 6. Tests

- Write a companion integration test at `tests/unit/infra/utils/pipeline-health.test.ts` covering all public methods

## Acceptance Criteria

1. ✅ `PipelineHealthReport` class is exported from `src/infra/utils/pipeline-health.ts`
2. ✅ All required methods are implemented with proper signatures
3. ✅ All TypeScript interfaces are defined and exported
4. ✅ `getStageTimeout` helper function is implemented and exported
5. ✅ All exported members have JSDoc comments
6. ✅ Zod schemas validate inputs for all public methods
7. ✅ Integration tests exist at `tests/unit/infra/utils/pipeline-health.test.ts`
8. ✅ All public methods are covered by tests

## File Structure

```
src/infra/utils/pipeline-health.ts    # Main utility module
tests/unit/infra/utils/pipeline-health.test.ts  # Integration tests
```

## Technical Notes

- This is a utility module following existing patterns in `src/infra/utils/`
- Uses Zod for runtime validation
- Standard TypeScript with no external dependencies beyond project dependencies
