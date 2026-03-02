# Build Agent Report: 260227-cody-crash-recovery

## Changes

### 1. `scripts/cody/engine/status.ts` (MODIFIED)
- Added `recoverStaleStages()` function - resets any stage stuck in "running" state to "pending" on pipeline startup
- Added `recoverPipelineState()` function - auto-completes/fails pipeline when all stages are done, respecting advisory stages (like auditor)
- Both functions are exported and return new state objects (immutable pattern)

### 2. `scripts/cody/engine/state-machine.ts` (MODIFIED)
- Added imports for `recoverStaleStages`, `recoverPipelineState`, and `flattenPipelineOrder`
- Integrated recovery logic into `runPipeline()`:
  - After loading existing state (resume scenario), runs recovery
  - First resets stale running stages to pending
  - Then checks if pipeline should auto-complete or auto-fail
  - If pipeline is already done, returns immediately without executing stages

### 3. `scripts/cody/entry.ts` (MODIFIED)
- Improved signal handler (`cleanupOnSignal`):
  - Now marks ALL running stages as failed (not just pipeline-level)
  - Adds error message with signal name to each failed stage
  - In CI mode (GITHUB_ACTIONS=true): attempts to commit and push status.json to preserve recovery state

### 4. `tests/unit/scripts/cody/engine/status-recovery.test.ts` (NEW)
- 13 tests covering all recovery scenarios:
  - recoverStaleStages: resets running stages, identity when no running
  - recoverPipelineState: completes pipeline when all done, fails when non-advisory stage fails, ignores advisory failures, leaves running if stages pending, ignores extra stages

## Tests Written

- `tests/unit/scripts/cody/engine/status-recovery.test.ts` - 13 tests for status recovery functions

## Quality

- TypeScript: ✅ PASS
- Lint: ✅ PASS
- Unit Tests: ✅ PASS (2561 tests, including 13 new)
