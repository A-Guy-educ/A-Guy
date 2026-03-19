# Pipeline Health Monitoring Utility Module

## Overview

Create a new utility module at `src/infra/utils/pipeline-health.ts` that exports a `PipelineHealthReport` class for monitoring Cody pipeline health.

## Requirements

1. **PipelineHealthReport Class**: Export a class with the following methods:
   - `checkStageHealth(stage: string): HealthStatus` - Check health of a specific pipeline stage
   - `generateReport(): Report` - Generate a full health report
   - `getRetryRecommendation(failedStage: string): RetryStrategy` - Get retry strategy for a failed stage

2. **TypeScript Interfaces**: Define the following interfaces:
   - `HealthStatus` - Status object for individual stage health
   - `Report` - Full health report object
   - `RetryStrategy` - Retry configuration object

3. **Helper Function**: Implement `getStageTimeout(stage: string): number` that returns default timeouts per pipeline stage

4. **Documentation**: Add JSDoc comments on all exported members

5. **Validation**: Include input validation using Zod schemas for all public method parameters

6. **Testing**: Write companion integration test at `tests/unit/infra/utils/pipeline-health.test.ts` covering all public methods

## Acceptance Criteria

- [ ] `PipelineHealthReport` class exports successfully
- [ ] All three class methods are implemented and return correct types
- [ ] `HealthStatus`, `Report`, and `RetryStrategy` interfaces are defined and exported
- [ ] `getStageTimeout` helper returns appropriate timeout values per stage
- [ ] All exported members have JSDoc comments
- [ ] Zod validation schemas are defined and used in public methods
- [ ] Test file exists at `tests/unit/infra/utils/pipeline-health.test.ts`
- [ ] Tests cover all public methods

## Technical Notes

- This is a medium-complexity feature requiring new TypeScript source files, type definitions, business logic, and tests
- Use existing utility patterns from `src/infra/utils/` as reference
- Follow Zod validation patterns from `src/infra/utils/validation/`
