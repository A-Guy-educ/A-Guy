# Task

## Issue Title

Resilient `fromStage` Resolution
## Fix Plan: Resilient `fromStage` Resolution

### File: `scripts/cody/entry.ts`

**Change the hard crash at lines 716-722** to a graceful fallback:

```typescript
// Current (crashes):
const fromStage = input.fromStage || 'build'
if (!stageOrder.includes(fromStage)) {
  throw new Error(`Stage "${fromStage}" not found in rerun pipeline...`)
}

// Proposed (falls back to nearest earlier stage):
let fromStage = input.fromStage || 'build'
if (!stageOrder.includes(fromStage)) {
  const fallback = findNearestEarlierStage(fromStage, stageOrder)
  logger.warn(
    `Stage "${fromStage}" not in pipeline (valid: ${stageOrder.join(', ')}). Falling back to "${fallback}".`
  )
  fromStage = fallback
}
```

### New function: `findNearestEarlierStage`

**File: `scripts/cody/rerun-utils.ts`** (co-located with the other rerun resolution functions)

```typescript
/**
 * Find the nearest earlier stage in the pipeline order.
 * Uses ALL_STAGES as a reference to determine ordering.
 * Falls back to first stage in pipeline if nothing earlier exists.
 */
export function findNearestEarlierStage(
  missingStage: string,
  pipelineOrder: string[],
): string {
  const missingIdx = ALL_STAGES.indexOf(missingStage)
  if (missingIdx === -1) return pipelineOrder[0] // unknown stage -> first stage
  
  // Walk backwards through ALL_STAGES to find the nearest one that exists in pipeline
  for (let i = missingIdx - 1; i >= 0; i--) {
    if (pipelineOrder.includes(ALL_STAGES[i])) {
      return ALL_STAGES[i]
    }
  }
  
  // Nothing earlier exists, use first pipeline stage
  return pipelineOrder[0]
}
```

### Tests: `tests/unit/scripts/cody/rerun-gate-approval.test.ts`

Add tests for `findNearestEarlierStage`:
- `gap` missing from lightweight → falls back to `taskify`
- `plan-gap` missing from lightweight → falls back to `architect`
- Unknown stage → falls back to first pipeline stage
- Stage exists → returns itself (sanity check — though caller wouldn't invoke this)

### Summary

| Item | Detail |
|---|---|
| Files modified | 2: `entry.ts`, `rerun-utils.ts` |
| Files for tests | 1: `rerun-gate-approval.test.ts` |
| Risk | Low — only changes error path, not happy path |
| Backward compat | Fully compatible — previously this crashed, now it recovers |



---
_Created by @aguyaharonyair via Cody dashboard_
