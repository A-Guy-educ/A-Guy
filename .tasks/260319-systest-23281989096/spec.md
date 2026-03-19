# Pipeline Health Monitoring Utility Module

## Overview

Create a new utility module at `src/infra/utils/pipeline-health.ts` that exports a `PipelineHealthReport` class for monitoring Cody pipeline health.

## Requirements

### FR-001: PipelineHealthReport Class
Export a class with the following methods:
- `checkStageHealth(stage: string): HealthStatus` - Check health of a specific pipeline stage
- `generateReport(): Report` - Generate a full health report
- `getRetryRecommendation(failedStage: string): RetryStrategy` - Get retry strategy for a failed stage

### FR-002: TypeScript Interfaces
Define the following interfaces:
- `HealthStatus` - Status object for individual stage health (stage, status, timestamp, message)
- `Report` - Full health report object (stages array, overallHealth percentage, generatedAt)
- `RetryStrategy` - Retry configuration object (maxRetries, backoffMs, strategyType)

### FR-003: getStageTimeout Helper
Implement `getStageTimeout(stage: string): number` that returns default timeouts per pipeline stage. Must support stages: taskify, gap, clarify, architect, plan-gap, test, build, commit, review, fix, verify, docs, pr.

### FR-004: Documentation
Add JSDoc comments on all exported members

### FR-005: Validation
Include input validation using Zod schemas for all public method parameters

### FR-006: Testing
Write companion unit test at `tests/unit/infra/utils/pipeline-health.test.ts` covering all public methods

### NFR-001: HealthStatus Interface
**Priority:** MUST
**Description:** HealthStatus must include stage (string), status (enum: healthy | degraded | failed | unknown), timestamp (ISO string), and optional message (string)

### NFR-002: Report Interface
**Priority:** MUST
**Description:** Report must include stages (array of HealthStatus), overallHealth (percentage number 0-100), and generatedAt (ISO string timestamp)

### NFR-003: RetryStrategy Interface
**Priority:** MUST
**Description:** RetryStrategy must include maxRetries (number), backoffMs (number), and strategyType (enum: fixed | exponential | linear)

## Acceptance Criteria

- [ ] `PipelineHealthReport` class exports successfully
- [ ] All three class methods are implemented and return correct types
- [ ] `HealthStatus`, `Report`, and `RetryStrategy` interfaces are defined with required properties
- [ ] `getStageTimeout` helper returns appropriate timeout values for all pipeline stages
- [ ] All exported members have JSDoc comments
- [ ] Zod validation schemas are defined and used in public methods
- [ ] Test file exists at `tests/unit/infra/utils/pipeline-health.test.ts`
- [ ] Tests cover all public methods

## Guardrails

- Must NOT import directly from scripts/cody/stages/registry.ts to avoid tight coupling - define own stage list in this module
- Must follow existing utility patterns in src/infra/utils/
- Must use Zod validation as shown in src/infra/utils/validation/

## Out of Scope

- Integration with actual pipeline runtime (this is a utility module only)
- Database persistence
- Real-time monitoring hooks
