# Task 2264: Fix dev CI CodeQL failure

## What I did

Fixed two CodeQL "Use of externally-controlled format string" alerts by changing two `console.error` calls to pass `job.id` as a separate argument instead of interpolating it in a template literal.

**Files changed:**
- `src/server/payload/jobs/pdf-to-exercises-task.ts` line 347
- `src/server/payload/jobs/pdf-to-exercises-v2-task.ts` line 277

**Before:** `console.error(\`[PDF→Exercises] Job ${job.id} failed:\`, error)`
**After:** `console.error('[PDF→Exercises] Job failed:', job.id, error)`

## Why

CodeQL flagged that `job.id` (from Payload's job queue, which can carry user-controlled data in `job.input`) was being interpolated into the format string. Passing it as a separate argument separates the format string from the external value, eliminating the alert.

## Verification

Quality gates (typecheck, lint, tests) passed on first attempt.
