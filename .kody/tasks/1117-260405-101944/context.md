
### taskify (2026-04-05T10:30:30)
{
  "task_type": "bugfix",
  "title": "Fix missing timeouts on fetch calls causing media timeouts",
  "description": "The `getPdfBufferFromUrl` function in `src/infra/blob/vercel-blob-adapter.ts` (line 403) and `readMediaFile` in `src/infra/llm/providers/shared/media-reader.ts` (lines 59, 129) use `fetch()` without timeout configuration. Large video/audio files cause serverless functions to hang indefinitely, resulting in 504 Gateway Timeout errors. Also `fetchText` in `src/infra/pdfjs/template-
...(truncated)

### plan (2026-04-05T10:31:01)
## Plan

### Step 1: Add timeout to `getPdfBufferFromUrl` in vercel-blob-adapter.ts

**File:** `src/infra/blob/vercel-blob-adapter.ts`  
**Change:** Lines 397–411 — wrap the fetch call in `AbortController` with 30s timeout, matching the existing `fetchBuffer` pattern

```typescript
export async function getPdfBufferFromUrl(url: string): Promise<Buffer> {
  if (!isVercelBlobUrl(url)) {
    throw new Error(`Invalid Vercel Blob URL: ${url}`)
  }

  const controller = new AbortController()
  const t
...(truncated)

### build (2026-04-05T10:38:25)
**Done.** All three fetch calls now have timeout protection:

| File | Function | Timeout |
|------|----------|---------|
| `src/infra/blob/vercel-blob-adapter.ts` | `getPdfBufferFromUrl` | 30s |
| `src/infra/llm/providers/shared/media-reader.ts` | blob-only fetch (line 59) | 30s |
| `src/infra/llm/providers/shared/media-reader.ts` | Payload API fetch (line 135) | 30s |
| `src/infra/pdfjs/template-loader.ts` | `fetchText` | 10s |

All use `AbortController` with `setTimeout` — matching the existi
...(truncated)

### review (2026-04-05T10:41:31)
## Verdict: FAIL

## Summary

The `getPdfBufferFromUrl` fix in `vercel-blob-adapter.ts` and the `fetchText` fix in `template-loader.ts` both use `try/finally` correctly. However, the two `fetch()` calls in `media-reader.ts` (lines 59–75 and 135–146) use inline `clearTimeout()` after the `await` instead of inside a `finally` block — inconsistent with the established `fetchBuffer` pattern and the two other fixed functions.

## Findings

### Major

- `src/infra/llm/providers/shared/media-reader.ts:
...(truncated)

### review-fix (2026-04-05T10:42:08)
Fixed. Both `fetch()` calls in `media-reader.ts` now use `try/finally` — the `clearTimeout` is in the `finally` block, ensuring the timeout is always cleared even if an exception is thrown after the fetch but before the status check.

**Summary of all timeout fixes:**

| File | Function | Pattern |
|------|----------|---------|
| `src/infra/blob/vercel-blob-adapter.ts` | `getPdfBufferFromUrl` | try/finally |
| `src/infra/llm/providers/shared/media-reader.ts` | blob-only fetch | try/finally |
| `
...(truncated)

### review (2026-04-05T10:42:51)
## Verdict: PASS

## Summary

Add `AbortController` + `setTimeout` timeout protection to four previously unguarded `fetch()` calls across three files, matching the established `fetchBuffer` pattern. Fixes serverless function hangs on large media files and slow CDN/template fetches.

## Findings

### Critical

None.

### Major

None.

### Minor

None.

---

## Two-Pass Review

**Pass 1 — CRITICAL:**

### SQL & Data Safety
Not applicable — no SQL or database writes in these files.

### Race Condit
...(truncated)
