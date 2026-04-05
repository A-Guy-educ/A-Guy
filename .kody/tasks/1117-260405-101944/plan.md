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
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch(url, { signal: controller.signal })

    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } finally {
    clearTimeout(timeoutId)
  }
}
```

**Why:** Vercel Blob URLs can hang indefinitely on large files or slow connections. Adding a 30s timeout matches the existing `fetchBuffer` utility and prevents serverless function timeouts.

**Verify:** `pnpm typecheck` passes

---

### Step 2: Add timeout to `readMediaFile` blob-only fetch in media-reader.ts

**File:** `src/infra/llm/providers/shared/media-reader.ts`  
**Change:** Lines 59–62 — add `AbortController` with 30s timeout to the direct blob URL fetch

**Why:** Same issue — blob-only media parts (line 41 `isBlobOnly`) fetch without timeout.

**Verify:** `pnpm typecheck` passes

---

### Step 3: Add timeout to `readMediaFile` Payload API fetch in media-reader.ts

**File:** `src/infra/llm/providers/shared/media-reader.ts`  
**Change:** Lines 129 — add `AbortController` with 30s timeout to the Payload API fallback fetch

**Why:** Same pattern, same fix needed.

**Verify:** `pnpm typecheck` passes

---

### Step 4: Add timeout to `fetchText` in template-loader.ts

**File:** `src/infra/pdfjs/template-loader.ts`  
**Change:** Lines 7–34 — add `AbortController` with 10s timeout (HTML/CSS templates are small, 10s is generous)

**Why:** CDN fetches for viewer templates can hang and block serverless execution.

**Verify:** `pnpm typecheck` passes

---

## Questions

None — all three files need the same fix pattern (`AbortController` + `setTimeout`) already established in `src/infra/utils/http.ts`. This is a straightforward, low-risk fix applying an existing proven pattern to unguarded `fetch` calls.
