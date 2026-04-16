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
    return false
  }
}
```
**Why:** Vercel Blob uses both `*.blob.vercel-storage.com` and `*.public.blob.vercel-storage.com`. The current function misses the public variant.
**Verify:** `pnpm test:unit -- --run tests/unit/pdf-fetcher-blob-handling.test.ts`

---

### Step 2: Add retry mechanism to `fetchBuffer`

**File:** `src/infra/utils/http.ts`
**Change:** Add retry logic with exponential backoff for transient failures (5xx, network errors):
```typescript
export async function fetchBuffer(
  url: string,
  timeoutMs = 30000,
  headers?: Record<string, string>,
): Promise<Buffer> {
  const MAX_RETRIES = 3
  const BASE_DELAY_MS = 500

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers,
      })

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer()
        return Buffer.from(arrayBuffer)
      }

      // Only retry on 5xx errors, not 4xx
      if (response.status >= 500 && attempt < MAX_RETRIES) {
        lastError = new Error(`HTTP ${response.status} ${response.statusText}`)
        await new Promise(r => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)))
        continue
      }

      throw new Error(`HTTP ${response.status} ${response.statusText}`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)))
        continue
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  throw lastError || new Error('Failed to fetch after retries')
}
```
**Why:** Transient server errors (5xx) and network failures should be retried automatically rather than failing immediately.
**Verify:** `pnpm typecheck`

---

### Step 3: Add retry mechanism to `getPdfBufferFromUrl`

**File:** `src/infra/blob/vercel-blob-adapter.ts`
**Change:** Add retry logic to `getPdfBufferFromUrl` (around line 397):
```typescript
export async function getPdfBufferFromUrl(url: string): Promise<Buffer> {
  if (!isVercelBlobUrl(url)) {
    throw new Error(`Invalid Vercel Blob URL: ${url}`)
  }

  const MAX_RETRIES = 3
  const BASE_DELAY_MS = 500
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const response = await fetch(url, { signal: controller.signal })

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer()
        return Buffer.from(arrayBuffer)
      }

      if (!response.ok && attempt < MAX_RETRIES) {
        lastError = new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`)
        await new Promise(r => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)))
        continue
      }

      throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)))
        continue
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  throw lastError || new Error('Failed to fetch PDF after retries')
}
```
**Why:** PDF fetching from blob storage needs the same retry capability.
**Verify:** `pnpm typecheck`

---

### Step 4: Add error UI state to PDFMedia component

**File:** `src/ui/web/media/PDFMedia/index.tsx`
**Change:** Add error state tracking and user-friendly error display:
- Add `errorState` useState for tracking load failures
- Add retry button that re-fetches the viewer URL
- Show error message with reload option when load fails

**Why:** Currently errors are only logged to analytics with no user feedback. Users see a blank/blank screen with no indication of what went wrong.
**Verify:** `pnpm typecheck && pnpm lint`

---

### Step 5: Write unit tests for retry logic

**File:** `tests/unit/blob-retry.test.ts`
**Why:** TDD ordering requires tests before implementation for new functionality.
**Verify:** Tests should fail initially, then pass after implementing retry logic.

---

### Step 6: Run full verification

**Verify:** `pnpm ci:local` (typecheck, lint, tests)

---

## Questions

- **Should retry logic be configurable via environment variables?** Currently hardcoded to 3 retries with exponential backoff. Could add `PDF_FETCH_MAX_RETRIES` env var if needed.
- **For the error UI, should we attempt to re-fetch the PDF URL from Payload API before showing error?** This would handle cases where the stored URL was stale, by re-fetching the media document's current URL.
