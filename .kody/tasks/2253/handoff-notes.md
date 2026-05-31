## Fix Summary

Fixed 2 CodeQL high-severity security vulnerabilities (format string injection) on commit `0d1ec67`.

## Changes Made

**`src/server/payload/jobs/pdf-to-exercises-task.ts:347`**
- Before: `console.error(\`[PDF→Exercises] Job ${job.id} failed:\`, error)` — template literal embeds user-provided `job.id` directly in format string
- After: `console.error('[PDF→Exercises] Job %s failed:', job.id, error)` — passes `job.id` as separate argument

**`src/server/payload/jobs/pdf-to-exercises-v2-task.ts:277`**
- Before: `console.error(\`[V2] Job ${job.id} failed:\`, error)`
- After: `console.error('[V2] Job %s failed:', job.id, error)`

## Why This Fixes CodeQL

CodeQL's security checker flags `console.error` (and similar variadic logging functions) when a user-controlled value is interpolated into the format string template rather than passed as a positional argument. The Node.js `console` API accepts printf-style format strings: `%s`, `%d`, etc. By using `%s` and passing `job.id` as an argument, `job.id` is treated as data, not as format string syntax.

## Verification

All quality gates pass: typecheck, lint, format check, unit tests.
