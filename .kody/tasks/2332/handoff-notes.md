Issue #2332 — docs-drift for exercise-import (PR #2275)

Verdict: doc-irrelevant — no doc update needed.

PR #2275 changed only two `console.error` calls in `pdf-to-exercises-task.ts` (line 347) and `pdf-to-exercises-v2-task.ts` (line 277), passing `job.id` as a separate argument instead of interpolating it into the format string (CodeQL js/tainted-format-string / log injection prevention). Both lines now read: `console.error('[PDF→Exercises] Job failed:', job.id, error)` and `console.error('[V2] Job failed:', job.id, error)`.

The doc `docs/exercise-import/README.md` describes pipeline architecture, endpoints, validation stages, and usage. None of those were affected by this internal security fix — it is a one-line change in the error logging path with no user-facing behavior change.
