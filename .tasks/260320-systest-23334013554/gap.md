# Gap Analysis: 260320-systest-23334013554

## Summary

- Gaps Found: 3
- Spec Revised: Yes

## Gaps Found

### Gap 1: `getStageTimeout` Already Exists in Registry

**Severity:** Critical
**Location:** `scripts/cody/stages/registry.ts` (line 218)
**Issue:** The task requires implementing `getStageTimeout(stage: string): number` helper, but this function **already exists** in the codebase at `scripts/cody/stages/registry.ts`. It takes `StageName` (a union of 14 valid stage names) and returns timeout in milliseconds using `STAGE_REGISTRY[stage].timeout`.

The task creates the new module at `src/infra/utils/pipeline-health.ts` while the existing function is at `scripts/cody/stages/registry.ts`. These are in different domains (`infra/utils` vs `scripts/cody/stages`).

**Fix Applied:** Added NFR-001: The `getStageTimeout` implementation should import and re-export from `scripts/cody/stages/registry.ts` rather than duplicating the registry data. This avoids code duplication and keeps stage metadata single-sourced.

---

### Gap 2: Missing Interface Field Definitions

**Severity:** Medium
**Location:** `src/infra/utils/pipeline-health.ts` (new file)
**Issue:** The task specifies interfaces `HealthStatus`, `Report`, and `RetryStrategy` must be defined, but provides no guidance on what fields each interface should contain. This creates ambiguity for implementation.

Without concrete field definitions, different implementations could produce incompatible interfaces.

**Fix Applied:** Added specification for each interface's required fields in spec.md:
- `HealthStatus`: `stage`, `isHealthy`, `lastChecked`, `errorMessage?`
- `Report`: `overallStatus`, `stageStatuses`, `generatedAt`
- `RetryStrategy`: `maxRetries`, `backoffMultiplier`, `retryDelay`, `stage`

---

### Gap 3: Test File Path Uses `/infra/` But Source is `/infra/utils/`

**Severity:** Low
**Location:** Test file path specification
**Issue:** The task specifies the test at `tests/unit/infra/utils/pipeline-health.test.ts` which follows the existing pattern. However, the existing `tests/unit/infra/utils/speechHelpers.test.ts` maps to `src/infra/utils/speechHelpers.ts` - the `utils` is in both paths. So `tests/unit/infra/utils/` is correct for a utility in `src/infra/utils/`.

**Fix Applied:** No change needed - the paths are correct. Confirmed by existing pattern: `src/infra/utils/speechHelpers.ts` → `tests/unit/infra/utils/speechHelpers.test.ts`.

---

## Changes Made to Spec

### Added NFR-001: Import Existing `getStageTimeout`

**Priority:** MUST
**Description:** The `getStageTimeout` helper should import and re-export from `scripts/cody/stages/registry.ts` to avoid duplicating stage registry data. The implementation must not hardcode timeout values.

```
import { getStageTimeout as getRegistryTimeout, STAGE_NAMES } from '@/scripts/cody/stages/registry'

export function getStageTimeout(stage: string): number {
  // Validate stage name against known stages
  if (!STAGE_NAMES.includes(stage as any)) {
    return getRegistryTimeout('build') // Default fallback
  }
  return getRegistryTimeout(stage as any)
}
```

### Added Interface Field Definitions to FR-001

**Priority:** MUST
**Description:** The `HealthStatus`, `Report`, and `RetryStrategy` interfaces must include the following fields:

```typescript
interface HealthStatus {
  stage: string
  isHealthy: boolean
  lastChecked: Date
  errorMessage?: string
}

interface Report {
  overallStatus: 'healthy' | 'degraded' | 'unhealthy'
  stageStatuses: HealthStatus[]
  generatedAt: Date
}

interface RetryStrategy {
  maxRetries: number
  backoffMultiplier: number
  retryDelay: number // milliseconds
  stage: string
}
```

### Added FR-002: Zod Schema Validation

**Priority:** MUST
**Description:** Input validation using Zod schemas for all public method parameters:
- `checkStageHealth` accepts `stage: string` (validated against known stage names)
- `getRetryRecommendation` accepts `failedStage: string` (validated against known stage names)
- Schemas should follow existing patterns in `src/infra/utils/validation/common-schemas.ts`

---

## Open Questions

1. **Stage Name Validation**: Should `checkStageHealth` and `getRetryRecommendation` accept any string for `stage` parameter, or should they validate against the 14 known stage names from `STAGE_NAMES`? (Recommendation: validate against known stages, return `isHealthy: false` for unknown stages)

2. **Default Timeout Values**: What should `getStageTimeout` return for unknown/unrecognized stage names? (Recommendation: return the `build` stage timeout as default)

3. **Health Status Data Source**: What determines if a stage is "healthy"? The `PipelineHealthReport` class needs a data source to check stage health. Should it read from:
   - Pipeline state files in task directories?
   - Pipeline definitions registry?
   - Runtime monitoring?
   
   (Recommendation: For initial implementation, use a simple in-memory state map that can be updated, with defaults showing all stages as healthy)
