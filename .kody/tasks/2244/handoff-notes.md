## Task 2244: dev CI CodeQL fix

### What was done
Fixed CodeQL format-string vulnerability alerts (7 occurrences) across 8 files. User-controlled data was being interpolated into `console.error` template literals, which CodeQL flags as a format-string injection risk.

Pattern applied (matching the prior #2242 fix):
```
// Before (flagged)
console.error(`Error fetching exercise ${id}:`, error)

// After (safe)
console.error('Error fetching exercise', id, ':', error)
```

### Files changed
- `src/app/(frontend)/exercises/[id]/page.tsx` — `id` from URL params
- `src/infra/analytics/system-events-subscriber.ts` — `event` name
- `src/infra/blob/vercel-blob-adapter.ts` — `url` parameter
- `src/infra/qa/fixtures/loader.ts` — `name` fixture parameter
- `src/infra/qa/prototype/loader.ts` — `name` parameter
- `src/infra/system-events/bus.ts` — `envelope.name` field
- `src/server/payload/jobs/pdf-to-exercises-task.ts` — `job.id` field
- `src/server/payload/jobs/pdf-to-exercises-v2-task.ts` — `job.id` and loop counter `i`

### Why this fixes the issue
CodeQL's java/codeql-action scans for printf-style format-string vulnerabilities. When user-controlled values appear inside template literals passed to `console.error`, the scanner treats the literal as a format string. Passing values as separate arguments avoids this interpretation.

### Not fixed (no user data interpolated, safe)
- `bus.ts:128` `[SystemEvents] AnyHandler error:` — no dynamic data
- `pdf-to-exercises-v2-task.ts:405` `[V2] Failed to update job status:` — no dynamic data
- `pdf-to-exercises-task.ts:393` `[PDF→Exercises] Failed to update job status:` — no dynamic data

### Follow-ups
1. **Disable orphaned CodeQL Security Scan workflow (221673461)** — GitHub UI action needed; workflow file was deleted but GitHub still shows it active
2. **Close PR #2243** — superseded by this PR; same fix on older commit
