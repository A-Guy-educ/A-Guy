# Fix CodeQL format string vulnerability (task 2242)

Fixed 11 instances of user-controlled format string in `console.error` calls across 8 files. CodeQL flags template literals with variable interpolation (e.g., `` console.error(`msg ${val}`) ``) as format string vulnerabilities. Fix pattern: convert to `` console.error('msg', val, ':', error) ``.

## Files changed
- src/app/(frontend)/exercises/[id]/page.tsx
- src/infra/analytics/system-events-subscriber.ts
- src/infra/blob/vercel-blob-adapter.ts
- src/infra/qa/fixtures/loader.ts
- src/infra/qa/prototype/loader.ts
- src/infra/system-events/bus.ts
- src/server/payload/jobs/pdf-to-exercises-task.ts
- src/server/payload/jobs/pdf-to-exercises-v2-task.ts

## Verification
All quality gates pass (typecheck, lint, tests).