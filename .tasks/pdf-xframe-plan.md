# Plan: Fix PDF Docs X-Frame-Options Blocking Issue

## Problem Statement

PDF documents fail to load in the browser with error:
```
Refused to display 'https://www.aguy.co.il/' in a frame because it set 'X-Frame-Options' to 'deny'.
```

This occurs because `PDFEmbed` (`src/ui/web/courses/PDFViewer/PDFEmbed.tsx`) loads PDFs directly in an iframe:
```tsx
<iframe src={pdfUrl} title={`PDF: ${title}`} ... />
```

When `pdfUrl` is from a domain that sets `X-Frame-Options: deny` (or `sameorigin`), the browser blocks the iframe from loading that content.

---

## Root Cause Analysis

### Two PDF Components Found:

1. **`PDFMedia`** (`src/ui/web/media/PDFMedia/index.tsx`) - Uses `/api/pdfjs-viewer` proxy
   - ✅ Already uses PDF.js viewer proxy which handles the loading properly
   - This one works fine because it proxies the PDF through the server

2. **`PDFEmbed`** (`src/ui/web/courses/PDFViewer/PDFEmbed.tsx`) - Loads URL directly in iframe
   - ❌ **Problem component** - loads `pdfUrl` directly without proxy
   - When `pdfUrl` is from a domain with `X-Frame-Options: deny`, it fails

### Why `PDFMedia` Works

The PDFMedia component uses `/api/pdfjs-viewer?file=<encoded_pdf_url>` which:
1. Validates the URL (only allows same-origin or Vercel Blob URLs)
2. Fetches the PDF.js viewer HTML
3. Serves it with proper `Access-Control-Allow-Origin: *` headers
4. The PDF.js viewer then loads the PDF via the proxy

### Why `PDFEmbed` Fails

`PDFEmbed` passes `pdfUrl` directly to the iframe `src` attribute without any proxy. If `pdfUrl` is `https://www.aguy.coil/` or any external domain that sets `X-Frame-Options: deny`, the browser blocks it.

---

## Phase 1: Reproduce in Test

### Goal
Create a test that demonstrates the X-Frame-Options blocking issue.

### Test Type
**Integration test** that validates the `PDFEmbed` behavior when loading a URL with X-Frame-Options blocking.

### Test Location
`tests/int/pdf-embed-xframe.int.spec.ts`

### Test Strategy

The test should verify that:
1. When a PDF URL from an external domain with `X-Frame-Options: deny` is provided
2. The current `PDFEmbed` component attempts to load it directly in iframe
3. The iframe cannot load the content due to browser security

Since we cannot easily mock `X-Frame-Options` headers in integration tests, we'll use an alternative approach:

**Option A: E2E Test (Recommended)**
- Create an E2E test that loads a page containing `PDFEmbed` with a real external URL
- Verify that the iframe's `load` event doesn't fire or fires with error
- Use a URL we control that sets the header, OR
- Use console error monitoring to catch the browser error

**Option B: Unit Test with Mock**
- Create a unit test that mocks `fetch` to simulate the X-Frame-Options response
- This doesn't perfectly replicate browser behavior but tests the concept

### Implementation (Phase 1)

#### Step 1.1: Create E2E Test File
```typescript
// tests/e2e/pdf-embed-xframe.e2e.spec.ts
import { test, expect } from '@playwright/test'

test.describe('PDF Embed X-Frame-Options Issue', () => {
  test('should handle PDF URL blocked by X-Frame-Options', async ({ page }) => {
    // We'll use the actual aguy.co.il URL that has the header
    const blockedUrl = 'https://www.aguy.co.il/'

    // Navigate to a test page that renders PDFEmbed with blocked URL
    await page.goto(`/test/pdf-embed?url=${encodeURIComponent(blockedUrl)}`)

    // Monitor console for the browser error
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Wait for potential iframe load
    await page.waitForTimeout(2000)

    // Check that the console error about X-Frame-Options appeared
    const xFrameError = consoleErrors.find(err =>
      err.includes('X-Frame-Options') || err.includes('Refused to display')
    )

    // This test documents the bug - it SHOULD fail after the fix
    expect(xFrameError).toBeDefined()
  })
})
```

#### Step 1.2: Create Test Page Route
We need a test route that renders `PDFEmbed` with a URL parameter.

```typescript
// src/app/(frontend)/test/pdf-embed/page.tsx
import { PDFEmbed } from '@/ui/web/courses/PDFViewer/PDFEmbed'
import { Suspense } from 'react'

export default async function TestPDFEmbedPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; title?: string }>
}) {
  const params = await searchParams
  const pdfUrl = params.url || 'https://example.com/test.pdf'
  const title = params.title || 'Test PDF'

  return (
    <div className="p-8">
      <h1>PDF Embed Test</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <PDFEmbed pdfUrl={pdfUrl} title={title} />
      </Suspense>
    </div>
  )
}
```

#### Step 1.3: Verify Test Fails (Confirms Bug Exists)
Run the test and verify it fails because of the X-Frame-Options blocking.

---

## Phase 2: Fix the Issue

### Goal
Make `PDFEmbed` work with external URLs that have `X-Frame-Options: deny` by proxying through the PDF.js viewer.

### Solution Options

#### Option A: Use PDF.js Proxy for All PDFs (Recommended)

Instead of loading `pdfUrl` directly in iframe, route it through `/api/pdfjs-viewer` which:
1. Serves the PDF.js viewer HTML with CORS headers
2. PDF.js viewer fetches the PDF via the same proxy
3. No direct iframe to external domain

**Implementation:**
Modify `PDFEmbed` to use `/api/pdfjs-viewer?file=<encoded_url>` instead of direct URL.

```tsx
// PDFEmbed.tsx - modified
export function PDFEmbed({ pdfUrl, title }: PDFEmbedProps) {
  const handleError = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    const target = e.currentTarget
    target.style.display = 'none'
  }

  // Route through PDF.js viewer proxy to avoid X-Frame-Options blocking
  const viewerUrl = `/api/pdfjs-viewer?file=${encodeURIComponent(pdfUrl)}&v=4.4.168`

  return (
    <div className="border rounded-lg overflow-hidden bg-gray-50 relative">
      <iframe
        src={viewerUrl}
        title={`PDF: ${title}`}
        className="w-full relative"
        style={{ height: '841px', marginTop: '-41px' }}
        loading="lazy"
        onError={handleError}
      />
    </div>
  )
}
```

**Pros:**
- Reuses existing infrastructure
- Consistent with `PDFMedia` approach
- Handles CORS issues automatically

**Cons:**
- Requires PDF.js viewer files (already cached via CDN)
- Adds small latency for proxy

#### Option B: Add Fallback Detection

If iframe fails to load, show a download link instead.

```tsx
export function PDFEmbed({ pdfUrl, title }: PDFEmbedProps) {
  const [loadFailed, setLoadFailed] = useState(false)

  const handleError = () => {
    setLoadFailed(true)
  }

  const handleLoad = () => {
    // If iframe loads but shows X-Frame-Options error page, detect it
    // This is tricky because the iframe content is opaque to JS
  }

  if (loadFailed) {
    return (
      <div className="border rounded-lg overflow-hidden bg-gray-50 p-4">
        <p className="text-muted-foreground">PDF cannot be displayed inline.</p>
        <a href={pdfUrl} download className="text-primary underline">
          Download PDF
        </a>
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-gray-50 relative">
      <iframe
        src={pdfUrl}
        title={`PDF: ${title}`}
        className="w-full relative"
        style={{ height: '841px', marginTop: '-41px' }}
        loading="lazy"
        onError={handleError}
        onLoad={handleLoad}
      />
    </div>
  )
}
```

**Pros:**
- Simple change
- Graceful degradation

**Cons:**
- Doesn't actually solve the issue - just hides it
- User loses inline PDF viewing

#### Option C: Use Blob Download Instead

For blocked URLs, offer download instead of inline viewing.

**Pros:**
- User can still access the PDF
- No proxy needed

**Cons:**
- Breaks inline viewing for all PDFs
- Not ideal user experience

### Recommended Fix: Option A

Modify `PDFEmbed` to use the PDF.js viewer proxy, consistent with `PDFMedia`.

### Implementation Steps (Phase 2)

#### Step 2.1: Modify PDFEmbed Component

Update `src/ui/web/courses/PDFViewer/PDFEmbed.tsx` to use the proxy.

#### Step 2.2: Update API Route (if needed)

Ensure `/api/pdfjs-viewer` can handle PDF URLs from external domains. Currently it only allows same-origin and Vercel Blob URLs. We may need to add `aguy.co.il` as an allowed origin, or implement a more flexible proxy.

Check `src/infra/pdfjs/validator.ts`:
```typescript
// Current validation - only allows same-origin or Vercel Blob
const allowedOrigins = [
  new URL(requestOrigin).origin,
  '.blob.vercel-storage.com',
]
```

For `aguy.co.il` PDFs, we might need to either:
1. Add `aguy.co.il` to allowed origins
2. Create a special case for certain domains
3. Use a generic proxy approach that doesn't validate origins

#### Step 2.3: Run Tests

- Run the reproduction test again
- It should now PASS (PDF loads correctly)
- Run full test suite to ensure no regressions

#### Step 2.4: Verify Manually

Load the test page with the blocked URL and verify PDF displays inline.

---

## Implementation Order

1. **Phase 1:** Create E2E reproduction test (verifies bug exists)
2. **Phase 2:** Implement fix in `PDFEmbed`
3. **Verify:** Test passes after fix

---

## Files to Modify

### Phase 1 (Test Creation)
1. `tests/e2e/pdf-embed-xframe.e2e.spec.ts` - New E2E test
2. `src/app/(frontend)/test/pdf-embed/page.tsx` - New test route

### Phase 2 (Fix)
1. `src/ui/web/courses/PDFViewer/PDFEmbed.tsx` - Route through proxy
2. `src/infra/pdfjs/validator.ts` - May need to allow aguy.co.il domain
3. `src/infra/pdfjs/config.ts` - May need to add domain to allowed list

---

## Success Criteria

### Phase 1 Success
- [ ] E2E test created that reproduces the X-Frame-Options error
- [ ] Test FAILS when run against current code (proves bug exists)

### Phase 2 Success
- [ ] `PDFEmbed` routes through `/api/pdfjs-viewer` proxy
- [ ] Test PASSES after fix
- [ ] No regressions in existing PDF functionality
- [ ] Manual verification: PDF from aguy.co.il loads inline