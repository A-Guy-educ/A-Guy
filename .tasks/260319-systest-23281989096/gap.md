# Gap Analysis: 260319-systest-23281989096

## Summary

- Gaps Found: 4
- Spec Revised: Yes

## Gaps Found

### Gap 1: Interface properties not defined

**Severity:** High
**Location:** spec.md - Requirements section
**Issue:** The task requires defining `HealthStatus`, `Report`, and `RetryStrategy` TypeScript interfaces, but does not specify what properties each interface should contain. This leaves the implementation ambiguous.
**Fix Applied:** Added NFR-002: Interfaces must define concrete properties (HealthStatus: stage, status, timestamp, message; Report: stages, overallHealth, generatedAt; RetryStrategy: maxRetries, backoffMs, strategyType)

### Gap 2: Valid stage names not specified

**Severity:** High
**Location:** spec.md - Requirements section
**Issue:** The `getStageTimeout(stage: string)` helper needs to know what valid stages exist. The codebase already has a stage registry at `scripts/cody/stages/registry.ts` with defined stages (taskify, gap, clarify, architect, plan-gap, test, build, commit, review, fix, verify, docs, pr).
**Fix Applied:** Added FR-005: getStageTimeout must support all stages from STAGE_NAMES in scripts/cody/stages/registry.ts (taskify, gap, clarify, architect, plan-gap, test, build, commit, review, fix, verify, docs, pr)

### Gap 3: RetryStrategy properties not specified

**Severity:** Medium
**Location:** spec.md - Requirements section
**Issue:** The task mentions `RetryStrategy` interface but doesn't define what properties it should have (e.g., maxRetries, backoff strategy, delay, etc.)
**Fix Applied:** Added NFR-003: RetryStrategy interface must include maxRetries (number), backoffMs (number), and strategyType (enum: fixed | exponential | linear)

### Gap 4: HealthStatus properties not specified

**Severity:** Medium
**Location:** spec.md - Requirements section
**Issue:** The `checkStageHealth(stage: string): HealthStatus` method returns HealthStatus, but the interface properties are not defined.
**Fix Applied:** Added NFR-001: HealthStatus must include stage (string), status (enum: healthy | degraded | failed | unknown), timestamp (ISO string), and optional message (string)

## Changes Made to Spec

- Added NFR-001: HealthStatus interface must define stage, status (healthy|degraded|failed|unknown), timestamp, and optional message
- Added NFR-002: Report interface must define stages (array), overallHealth (percentage), and generatedAt (ISO string)
- Added NFR-003: RetryStrategy must define maxRetries, backoffMs, strategyType
- Added FR-005: getStageTimeout must support all stages from existing STAGE_NAMES (taskify, gap, clarify, architect, plan-gap, test, build, commit, review, fix, verify, docs, pr)
- Added Guardrail: Must NOT import from scripts/cody/stages/registry.ts directly - should define own stage list to avoid tight coupling (alternative: re-export from there)

## No Gaps Found

The spec was revised to address missing interface definitions and align with existing codebase patterns. The task is now complete with clear requirements.
