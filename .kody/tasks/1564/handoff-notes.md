## Fix Summary

Fixed CI failure on PR #1564 by restoring the correct mock approach in the
orchestrator integration test.

### Problem
The test "orchestrator does not abort when one exercise fails — remaining
exercises are processed" was receiving `status: 'succeeded'` instead of
`status: 'needs_review'`, indicating the forced failure via mock wasn't
triggering and no failures were being recorded.

### Root Cause
A previous refactor attempt changed the mock from:
- `vi.mock('@/infra/llm/services/lesson-duplication-variation-service')` (correct)
to:
- `vi.mock('@/server/services/lesson-duplication/orchestrator')` (incorrect)

The orchestrator-level mock never applied (h.callCount stayed at 0), even
though the factory ran without errors. This left the real LLM call path
intact, but without a forced failure, the orchestrator processed all
exercises successfully.

### Fix
Restored the variation-service mock approach. The mock uses a hoisted call
counter (h.vgCallCount) to deterministically throw on the 3rd exercise.
The test passes reliably with this approach.

### Files Changed
- tests/int/lesson-duplication-orchestrator.int.spec.ts (restored mock)

### Key Insight
Vi.mock for an already-imported module (orchestrator) may not reliably
replace exports in all import paths. Mocking the deeper dependency
(variation-service) that is dynamically imported works correctly.

### Environment Note
When running tests locally, ensure DATABASE_URL points to the local MongoDB:
`DATABASE_URL=mongodb://127.0.0.1/a-guy pnpm test:int`
