# Fix: dev CI CodeQL failure on b7bcf835

## What

Two CodeQL "format string depends on user-provided value" security alerts, one each in:
- `src/server/payload/jobs/pdf-to-exercises-task.ts` line 347
- `src/server/payload/jobs/pdf-to-exercises-v2-task.ts` line 277

Both had `console.error(\`[label] Job ${job.id} failed:\`, error)` where `job.id` was
interpolated into the format string. CodeQL flags this because a malicious `job.id` containing
`%s` or similar specifiers would have them interpreted as format codes.

## Fix

Changed to use a `%s` placeholder and pass `job.id` as a separate argument:
`console.error('[label] Job %s failed:', job.id, error)`

## Verification

All quality gates pass (typecheck, lint, tests).
