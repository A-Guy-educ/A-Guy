# Pipeline Health Monitoring Utility

## Overview

A new utility module at `src/infra/utils/pipeline-health.ts` that exports a `PipelineHealthReport` class for monitoring Cody pipeline health.

## Requirements

### 1. PipelineHealthReport Class

Export a class with the following methods:

- `checkStageHealth(stage: string): HealthStatus` - Checks the health of a specific pipeline stage
- `generateReport(): Report` - Generates a comprehensive health report
- `getRetryRecommendation(failedStage: string): RetryStrategy` - Provides retry strategy for a failed stage

### 2. TypeScript Interfaces

Define and export the following interfaces:

- `HealthStatus` - Represents the health status of a stage
- `Report` - Represents a comprehensive health report
- `RetryStrategy` - Represents retry recommendations for failed stages

### 3. Helper Functions

- `getStageTimeout(stage: string): number` - Returns default timeouts per stage

### 4. Documentation

- JSDoc comments on all exported members

### 5. Validation

- Input validation using Zod schemas for all public method parameters

### 6. Testing

- Companion integration test at `tests/unit/infra/utils/pipeline-health.test.ts` covering all public methods

## Acceptance Criteria

- [ ] `PipelineHealthReport` class exports correctly
- [ ] All three methods are implemented and return correct types
- [ ] All interfaces are properly defined
- [ ] `getStageTimeout` returns appropriate timeout values per stage
- [ ] All exported members have JSDoc comments
- [ ] Zod schemas validate all public method inputs
- [ ] Integration tests cover all public methods with passing tests
- [ ] Code follows project TypeScript conventions (no `any` types, proper error handling)
