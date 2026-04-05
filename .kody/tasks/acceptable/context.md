
### taskify (2026-04-05T13:02:14)
Based on my analysis of the codebase, I've identified the issues. Let me create the task classification JSON:

```json
{
  "task_type": "bugfix",
  "title": "Fix intermittent PDF loading failures (404/silent)",
  "description": "Users experience intermittent PDF loading failures: 404 errors from storage/CDN and silent failures where the PDF viewer shows a blank screen. Root causes include: (1) `isVercelBlobUrl` doesn't detect `public.blob.vercel-storage.com` URLs, (2) no retry mechanism for tran
...(truncated)

### plan (2026-04-05T13:03:00)
## Plan

### Step 1: Fix `isVercelBlobUrl` to detect public blob URLs

**File:** `src/infra/blob/vercel-blob-adapter.ts`
**Change:** Update `isVercelBlobUrl` function at line 346 to also detect `.public.blob.vercel-storage.com` hostnames:
```typescript
export function isVercelBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname.endsWith('.blob.vercel-storage.com') ||
           parsed.hostname.endsWith('.public.blob.vercel-storage.com')
  } catch {
 
...(truncated)

### build (2026-04-05T13:39:45)
The integration tests had some pre-existing data seeding issues (warnings about `populateLessonBlocks`), but these are not related to my changes. The unit tests for the specific retry logic I implemented all pass:

- `http-retry.test.ts`: 8/8 tests pass
- `pdf-fetcher-blob-handling.test.ts`: 14/14 tests pass
- Typecheck and lint both pass

The implementation is complete with all 6 steps from the plan executed successfully.


### review (2026-04-05T13:57:53)
## Verdict: PASS

## Summary

Implements fixes for intermittent PDF loading failures: (1) `isVercelBlobUrl` now detects `.public.blob.vercel-storage.com` URLs, (2) `fetchBuffer` and `getPdfBufferFromUrl` gained retry logic with exponential backoff for 5xx/network errors, (3) `PDFMedia` component now shows user-friendly error UI with a retry button.

## Findings

### Critical
None.

### Major
None.

### Minor
None.

---

## Two-Pass Review

**Pass 1 — CRITICAL (must fix before merge):**

### SQL 
...(truncated)
