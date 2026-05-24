# Task 2000: Short-circuit lesson duplication for level=none

## What was done

Added a fast-path branch in `runDuplicationOrchestrator` (orchestrator.ts) that short-circuits the full per-exercise pipeline when `level === 'none'`. The slow path (light/medium/deep) is completely unchanged.

**Fast path behavior:**
1. Creates output lesson (same `createOutputLesson` as slow path)
2. Fetches all source exercises via `getSourceExercisesForLesson`
3. Bulk-creates cloned exercises in parallel via `Promise.allSettled` — no trimming, no validators, no LLM calls
4. Updates `outputExercises` + `failures` + `status` in ONE DB update (not per-exercise `$push`)
5. Returns `succeeded` (0 failures) or `needs_review` (partial failures)

**Edge cases handled:**
- Zero exercises: creates empty output lesson, marks `succeeded`
- One exercise fails to clone: records `GENERATION_FAILURE_CODE`, other exercises still land
- Source >5 blocks: NOT trimmed (exact copy requirement from issue)

**Key implementation detail:** The `cloneExercisesFastPath` helper uses `Promise.allSettled` so one throwing doesn't abort the batch. Failed clones are collected and recorded as `GENERATION_FAILED` entries so the admin review screen shows them.

## Files changed
- `src/server/services/lesson-duplication/orchestrator.ts` — added fast-path branch + `cloneExercisesFastPath` helper
- `tests/int/lesson-duplication-orchestrator-none.int.spec.ts` — new integration tests (trim verification, LLM-not-called)

## Known issue
Integration tests time out due to `populateLessonBlocks` migration running globally on Payload init in test env (283 lessons → ~60s added to every beforeAll). See followups.json.
