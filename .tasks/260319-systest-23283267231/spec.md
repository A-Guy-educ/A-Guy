# Pipeline Health Monitoring Utility - Specification

## Overview

Create a new utility module at `src/infra/utils/pipeline-health.ts` that exports a `PipelineHealthReport` class for monitoring Cody pipeline health.

## Requirements

1. **PipelineHealthReport Class**
   - Export a `PipelineHealthReport` class with the following methods:
     - `checkStageHealth(stage: string): HealthStatus` - Check health status of a pipeline stage
     - `generateReport(): Report` - Generate a full health report
     - `getRetryRecommendation(failedStage: string): RetryStrategy` - Get retry strategy for failed stages

2. **TypeScript Interfaces**
   - Define `HealthStatus` interface
   - Define `Report` interface
   - Define `RetryStrategy` interface

3. **Helper Functions**
   - Implement `getStageTimeout(stage: string): number` that returns default timeouts per stage

4. **Documentation**
   - Add JSDoc comments on all exported members

5. **Input Validation**
   - Include input validation using Zod schemas for all public method parameters

6. **Testing**
   - Write a companion integration test at `tests/unit/infra/utils/pipeline-health.test.ts` covering all public methods

## Acceptance Criteria

- [ ] PipelineHealthReport class is exported from the module
- [ ] HealthStatus, Report, and RetryStrategy interfaces are defined
- [ ] getStageTimeout helper returns appropriate timeouts per stage
- [ ] All exported members have JSDoc comments
- [ ] Zod schemas validate all public method parameters
- [ ] Integration tests cover all public methods
- [ ] Module compiles without TypeScript errors

## Technical Notes

- This is a utility module for monitoring Cody pipeline health
- Use Zod for input validation
- Follow existing utility patterns in the codebase
- This is a medium-complexity feature

## Notes

- **This is a SYSTEM TEST. The PR should NOT be merged.**
