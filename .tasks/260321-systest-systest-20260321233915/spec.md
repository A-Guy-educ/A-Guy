# Pipeline Health Monitoring Utility

## Overview

Create a new utility module at `src/infra/utils/pipeline-health.ts` that provides pipeline health monitoring capabilities for the Cody pipeline system.

## Requirements

1. **PipelineHealthReport Class**
   - Export a `PipelineHealthReport` class with the following methods:
     - `checkStageHealth(stage: string): HealthStatus` - Checks the health status of a given pipeline stage
     - `generateReport(): Report` - Generates a comprehensive health report
     - `getRetryRecommendation(failedStage: string): RetryStrategy` - Provides retry strategy recommendations for failed stages

2. **TypeScript Interfaces**
   - Define the following interfaces:
     - `HealthStatus` - Represents the health status of a stage
     - `Report` - Represents a comprehensive health report
     - `RetryStrategy` - Represents retry recommendations for failed stages

3. **Helper Functions**
   - Implement `getStageTimeout(stage: string): number` helper that returns default timeouts per stage

4. **Documentation**
   - Add JSDoc comments on all exported members

5. **Validation**
   - Include input validation using Zod schemas for all public method parameters

6. **Testing**
   - Write a companion integration test at `tests/unit/infra/utils/pipeline-health.test.ts` covering all public methods

## Technical Notes

- This is a medium-complexity feature
- Implementation should follow existing utility patterns in the codebase
- Zod should be used for input validation
- All public methods must have proper type signatures
