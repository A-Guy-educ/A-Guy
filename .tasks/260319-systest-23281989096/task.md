# Task

## Issue Title

[SYSTEM-TEST] Add pipeline health monitoring utility module
Create a new utility module at `src/infra/utils/pipeline-health.ts` that exports a `PipelineHealthReport` class for monitoring Cody pipeline health. The module should:

1. Export a `PipelineHealthReport` class with methods: `checkStageHealth(stage: string): HealthStatus`, `generateReport(): Report`, and `getRetryRecommendation(failedStage: string): RetryStrategy`
2. Define TypeScript interfaces: `HealthStatus`, `Report`, `RetryStrategy`
3. Implement a `getStageTimeout(stage: string): number` helper that returns default timeouts per stage
4. Add JSDoc comments on all exported members
5. Include input validation using Zod schemas for all public method parameters
6. Write a companion integration test at `tests/unit/infra/utils/pipeline-health.test.ts` covering all public methods

This is a medium-complexity feature that requires creating new TypeScript source files, defining types, implementing business logic, and writing tests.

**This is a SYSTEM TEST. The PR should NOT be merged.**
