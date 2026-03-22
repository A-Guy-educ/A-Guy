# Build Agent Report: Inspector Overhaul

## Summary

Implemented a comprehensive overhaul of the Cody pipeline inspector system to make it actually *act* on problems instead of just observing them. The inspector now takes corrective actions for stuck/failing tasks and closes the improvement loop by creating self-healing Cody tasks for systemic issues.

## Changes

### Phase 1: Fix Broken Recovery Loops

**1.1 — Health-check: Add orphaned and stalled actions**
- `scripts/inspector/plugins/cody/health-check/index.ts`
  - Added `createOrphanedAction()` — immediately marks orphaned tasks as failed and sets up for retry
  - Added `createStalledWarningAction()` — posts warning at 30 min, escalates at 60 min
  - Added `createUnknownAction()` — handles unmonitorable issues (missing task IDs)
  - Changed threshold from 20 min to act at detection time (immediate recovery)
  - Added fs imports for status.json manipulation

**1.2 — Failure-analysis: Add cody:needs-manual label, fix blind retry**
- `scripts/inspector/plugins/cody/failure-analysis/index.ts`
  - Adds `cody:needs-manual` label after max retries exhausted
  - Adds `cody:needs-manual` label for non-retryable failures
  - Skips re-processing tasks with `cody:needs-manual` label
- `scripts/inspector/plugins/cody/failure-analysis/analyzer.ts`
  - Changed fallback to set `canRetry: false` on API errors (no more blind retry)
  - Added quality check: refinedFeedback must be >50 chars and not match generic fallback strings
  - Parse failures now return `canRetry: false`

**1.3 — Discovery: Handle missing task IDs**
- `scripts/inspector/plugins/cody/health-check/discovery.ts`
  - Issues without extractable task IDs now create snapshots with `unknown-{issueNumber}` task ID
  - These get evaluated as `unknown` health and trigger notification actions

**1.4 — Zombie-reaper: Reduce threshold**
- `scripts/inspector/plugins/cody/zombie-reaper/index.ts`
  - Reduced stale threshold from 2h to 45 min
  - Reduced dedup window from 23h to 2h
  - Updated comments to reflect new role as safety net

**1.5 — Add cody:needs-manual label support**
- `scripts/inspector/core/types.ts` — Added `untracked` to TaskHealth union
- `scripts/inspector/plugins/cody/health-check/index.ts` — Added untracked to healthCounts

### Phase 2: Close the Improvement Loop

**2.1 — Failure-miner: Create self-healing Cody tasks**
- `scripts/inspector/plugins/cody/failure-miner/analyzer.ts`
  - Increased threshold from >=2 to >=3 for hotspots and patterns
  - Added `exampleTaskIds` field to StageHotspot for context
- `scripts/inspector/plugins/cody/failure-miner/reporter.ts`
  - Updated issue bodies to include `@cody fix` trigger for self-healing
  - Added priority labels and auto control mode instructions
- `scripts/inspector/plugins/cody/failure-miner/index.ts`
  - Added max 2 active improvement issues limit

**2.2 — Success-tracker: Trigger investigation on degradation**
- `scripts/inspector/plugins/cody/success-tracker/index.ts`
  - When 7d success rate drops >15pp below 30d, creates a self-healing Cody task
  - Issue includes common failure patterns from recent runs
  - 48h dedup to prevent spam

**2.3 — Audit: Cap open issues**
- `scripts/inspector/plugins/cody/audit/index.ts`
  - Added MAX_OPEN_AUDIT_ISSUES = 5 cap
  - Skips creating new audit issues when limit reached
  - Posts warning to digest when at limit

**2.4 — Retry outcome tracking**
- `scripts/inspector/plugins/cody/failure-analysis/index.ts`
  - Added retry attempt storage in state: `cody:retry-attempts`
  - Added `shouldEscalateFromStage()` — backs up one stage if same stage already retried
  - Added per-stage success rate tracking (escalates if <20% success rate)

### Phase 3: Pipeline Intelligence & Dashboard

**3.1 — Smart stage-router**
- Already implemented in 2.4 via `shouldEscalateFromStage()`

**3.2 — Dashboard integration**
- Created `src/app/api/cody/inspector/health/route.ts`
  - GET endpoint returning inspector health status
  - Includes cycle number, health counts, stage retry stats
  - Reads from GH Actions variable or local state file

## Tests Updated

- `tests/unit/scripts/inspector/failure-miner.test.ts` — Updated threshold from >=2 to >=3, added test data for 3+ failures
- `tests/unit/scripts/inspector/failure-analysis.spec.ts` — Updated expected `canRetry` values to false for fallback cases

## Quality

- TypeScript: PASS
- Lint: PASS  
- Unit Tests: PASS (3699 passed, 17 skipped)

## Deviations

None — plan followed exactly.

## Notes

- The threshold changes from >=2 to >=3 mean fewer but more significant improvement issues are created
- The `cody:needs-manual` label coexists with `cody:failed` — both are applied when max retries hit
- The inspector now acts aggressively (immediately on detection) per the user's preference

## Test Fix (2026-03-15)

Fixed failing test in `tests/unit/scripts/inspector/failure-analysis.spec.ts`:
- Test "should add cody:needs-manual label when max retries exhausted" was failing
- Root cause: Mock comment didn't include taskId in body, but `countRetries()` checks for both retry tag AND taskId
- Fix: Updated mock comment to include taskId: `[inspector-retry: 3/3] Max retries for \`260307-max-retries-task\``
