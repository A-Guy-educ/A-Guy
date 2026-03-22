# Pipeline Health Monitoring Utility - Specification

## Overview

Create a new utility module for monitoring Cody pipeline health. This module provides a `PipelineHealthReport` class with methods for checking stage health, generating reports, and providing retry recommendations.

## Requirements

### 1. PipelineHealthReport Class

Export a `PipelineHealthReport` class with the following methods:

- `checkStageHealth(stage: string): HealthStatus` - Checks the health status of a specific pipeline stage
- `generateReport(): Report` - Generates a comprehensive health report
- `getRetryRecommendation(failedStage: string): RetryStrategy` - Provides retry strategy for a failed stage

### 2. TypeScript Interfaces

Define the following interfaces:

- `HealthStatus` - Represents the health status of a stage
- `Report` - Represents a comprehensive health report
- `RetryStrategy` - Represents retry recommendations for failed stages

### 3. Helper Functions

- `getStageTimeout(stage: string): number` - Returns default timeouts per stage

### 4. Documentation

- Add JSDoc comments on all exported members

### 5. Validation

- Include input validation using Zod schemas for all public method parameters

## File Locations

- Source: `src/infra/utils/pipeline-health.ts`
- Tests: `tests/unit/infra/utils/pipeline-health.test.ts`

## Acceptance Criteria

1. `PipelineHealthReport` class is exported with all three methods
2. All required TypeScript interfaces are defined and exported
3. `getStageTimeout` helper function is implemented and exported
4. All exported members have JSDoc comments
5. Zod schemas validate all public method parameters
6. Integration tests cover all public methods
7. Tests follow project conventions (vitest)

## Constraints

- This is a SYSTEM TEST. The PR should NOT be merged.
- Only create utility module and tests; no production code integration
