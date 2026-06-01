Fixed two CI failures on dev@986efb7:

1. **inspect check** — inspector.yml hardcoded `pnpm@9` in pnpm/action-setup, but package.json specifies `packageManager: pnpm@10.33.0`. Updated inspector.yml to use `version: 10.33.0`.

2. **CodeQL check** — Two console.error calls in job task files used template literals with `job.id` interpolation (`${job.id}`), triggering CodeQL's "externally-controlled format string" rule. Changed both to comma-separated args:
   - `pdf-to-exercises-task.ts:347`: `console.error('[PDF→Exercises] Job', job.id, 'failed:', error)`
   - `pdf-to-exercises-v2-task.ts:277`: `console.error('[V2] Job', job.id, 'failed:', error)`

Both fixes are minimal and targeted. Quality gates (typecheck, lint, tests) pass.
