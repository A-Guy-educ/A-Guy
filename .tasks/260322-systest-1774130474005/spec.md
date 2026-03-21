# Pipeline Health Monitoring Utility

## Overview

Create a new utility module at `src/infra/utils/pipeline-health.ts` that exports a `PipelineHealthReport` class for monitoring Cody pipeline health.

## Requirements

### FR-1: PipelineHealthReport Class
- Export a `PipelineHealthReport` class with the following methods:
  - `checkStageHealth(stage: string): HealthStatus` - Check health status of a pipeline stage
  - `generateReport(): Report` - Generate a full pipeline health report
  - `getRetryRecommendation(failedStage: string): RetryStrategy` - Get retry strategy for a failed stage

### FR-2: TypeScript Interfaces
Define the following interfaces:
- `HealthStatus` - Represents health status of a stage (status, message, timestamp)
- `Report` - Represents a full pipeline health report
- `RetryStrategy` - Represents retry recommendations for failed stages

### FR-3: getStageTimeout Helper
- Implement a `getStageTimeout(stage: string): number` helper function
- Returns default timeouts per pipeline stage

### FR-4: JSDoc Documentation
- Add JSDoc comments on all exported members

### FR-5: Input Validation
- Use Zod schemas for validating all public method parameters

### FR-6: Integration Tests
- Write companion integration test at `tests/unit/infra/utils/pipeline-health.test.ts`
- Cover all public methods

## Acceptance Criteria

1. PipelineHealthReport class is exported and instantiable
2. All methods have proper TypeScript types
3. Zod validation is applied to all public method inputs
4. JSDoc comments present on all exported members
5. Integration tests exist and cover all public methods
6. Tests pass when run
