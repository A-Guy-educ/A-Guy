# Implementation Plan

## Step 1: Create pipeline-health.ts utility module

### 1.1 Define Zod Schemas
- Create validation schema for stage names
- Create validation schema for method parameters

### 1.2 Define TypeScript Interfaces
- `HealthStatus` interface with status, message, timestamp fields
- `Report` interface with stages, generatedAt, summary fields
- `RetryStrategy` interface with shouldRetry, maxRetries, delayMs fields

### 1.3 Implement getStageTimeout Helper
- Map of stage names to timeout values in milliseconds
- Default timeout for unknown stages

### 1.4 Implement PipelineHealthReport Class
- `checkStageHealth(stage: string): HealthStatus` - validates input, returns health status
- `generateReport(): Report` - generates full report
- `getRetryRecommendation(failedStage: string): RetryStrategy` - provides retry guidance

### 1.5 Add JSDoc Comments
- Document class and all methods
- Document interfaces
- Document helper function

## Step 2: Create integration tests

### 2.1 Create tests/unit/infra/utils/pipeline-health.test.ts
- Test `checkStageHealth` with valid and invalid inputs
- Test `generateReport` basic functionality
- Test `getRetryRecommendation` for various stages
- Test `getStageTimeout` helper

### 2.2 Ensure tests follow project conventions
- Use existing test framework patterns
- Include proper beforeAll/afterAll hooks if needed

## Files to Create/Modify

1. **CREATE**: `src/infra/utils/pipeline-health.ts`
2. **CREATE**: `tests/unit/infra/utils/pipeline-health.test.ts`
