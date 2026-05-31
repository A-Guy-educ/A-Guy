## Task 2240: Fix CodeQL failures

**Problem:** CodeQL flagged `console.error` calls using template literals with user-controlled data as format string injection vulnerabilities.

**Fix:** Convert all template literal console.error calls to use separate arguments.

**Files changed (8):**
- `src/app/(frontend)/exercises/[id]/page.tsx` — `console.error('Error fetching exercise', id, ':', error)`
- `src/infra/analytics/system-events-subscriber.ts` — `console.error('[Analytics] Error handling', event, ':', error)`
- `src/infra/qa/fixtures/loader.ts` — `console.error('Failed to load fixture', name, ':', error)`
- `src/infra/qa/prototype/loader.ts` — `console.error('Failed to load prototype', name, ':', error)`
- `src/infra/blob/vercel-blob-adapter.ts` — `console.error('[VercelBlob] Failed to delete blob:', url, error)`
- `src/infra/system-events/bus.ts` — `console.error('[SystemEvents] Handler error for', envelope.name, ':', error)`
- `src/server/payload/jobs/pdf-to-exercises-v2-task.ts` — 3 occurrences fixed
- `src/server/payload/jobs/pdf-to-exercises-task.ts` — 2 occurrences fixed

**Verification:** `pnpm ci:local` passes (typecheck, lint, format, tests).
