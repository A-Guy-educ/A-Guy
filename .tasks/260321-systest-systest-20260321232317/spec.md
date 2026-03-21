# Pipeline Health Monitoring Utility - Specification

## Overview

Create a new utility module at `src/infra/utils/pipeline-health.ts` that exports a `PipelineHealthReport` class for monitoring Cody pipeline health.

## Requirements

### 1. TypeScript Interfaces

Define the following interfaces:

- **HealthStatus**: Represents the health of a single stage
  - `status`: 'pass' | 'fail' | 'warn'
  - `message`: string
  - `timestamp`: Date

- **Report**: Represents a full pipeline health report
  - `overallHealth`: 'healthy' | 'degraded' | 'unhealthy'
  - `stageStatuses`: Record<string, HealthStatus>
  - `generatedAt`: Date

- **RetryStrategy**: Recommends retry behavior for failed stages
  - `shouldRetry`: boolean
  - `maxRetries`: number
  - `backoffMultiplier`: number

### 2. PipelineHealthReport Class

Exports a class with the following public methods:

- **`checkStageHealth(stage: string): HealthStatus`**
  - Validates stage parameter with Zod
  - Returns health status for the specified stage

- **`generateReport(): Report`**
  - Returns a full pipeline health report with all stage statuses

- **`getRetryRecommendation(failedStage: string): RetryStrategy`**
  - Validates failedStage parameter with Zod
  - Returns retry strategy for the given failed stage

### 3. Helper Functions

- **`getStageTimeout(stage: string): number`**
  - Returns default timeout in milliseconds per stage
  - Must support at minimum: taskify, architect, gap, plan-gap, build, commit, review, verify, pr

### 4. Validation

All public method parameters must be validated using Zod schemas:
- `stage` parameter in `checkStageHealth`
- `failedStage` parameter in `getRetryRecommendation`

### 5. Documentation

All exported members must have JSDoc comments.

### 6. Tests

Write integration tests at `tests/unit/infra/utils/pipeline-health.test.ts` covering:
- All public methods of PipelineHealthReport
- Zod validation for invalid inputs
- getStageTimeout helper function
