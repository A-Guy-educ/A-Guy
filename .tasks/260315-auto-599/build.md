# Build Agent Report: 260315-auto-599

## Changes

- **`scripts/cody/rerun-utils.ts`** — Added `ALL_STAGES` import and new `findNearestEarlierStage` function that finds the nearest earlier stage in pipeline order by walking backwards through ALL_STAGES
- **`scripts/cody/entry.ts`** — Modified line 39 to import `findNearestEarlierStage`, changed lines 720-726 from hard crash (`throw new Error`) to graceful fallback using the new function + warning log
- **`tests/unit/scripts/cody/rerun-gate-approval.test.ts`** — Added import for new function and 5 test cases covering: gap missing from lightweight → taskify, plan-gap missing → architect, unknown stage fallback, stage exists → nearest earlier, no earlier stage exists → first pipeline

## Tests Written

- `tests/unit/scripts/cody/rerun-gate-approval.test.ts` — Added `findNearestEarlierStage` describe block with 5 test cases:
  1. `gap` missing from lightweight pipeline → falls back to `taskify`
  2. `plan-gap` missing from lightweight → falls back to `architect`
  3. Unknown stage → falls back to first pipeline stage
  4. Stage exists in pipeline → returns nearest earlier stage
  5. No earlier stage exists → returns first pipeline stage

## Deviations

- None — plan followed exactly

## Quality

- TypeScript: PASS (`pnpm -s tsc --noEmit`)
- Lint: PASS (`pnpm -s lint`)
- Tests: PASS (3624 tests passed, including 5 new tests for findNearestEarlierStage)
