Fixed 2 CodeQL "externally-controlled format string" security alerts on commit 09bd3835b.

Both `pdf-to-exercises-task.ts` and `pdf-to-exercises-v2-task.ts` had `job.id` (user-provided value) interpolated into template literals passed as the first argument to `console.error`. CodeQL treats this as a format string injection risk.

Fix: converted each `console.error(\`[Prefix] Job ${job.id} failed:\`, error)` into `console.error('[Prefix] Job', job.id, 'failed:', error)`, passing `job.id` as a separate argument.

No test files exist for these job modules; the fix is a pure code change with no behavioral change to production logic. Quality gates (typecheck, lint, tests) all pass.
