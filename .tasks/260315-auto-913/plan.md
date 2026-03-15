# Plan: Fix PDF viewer "Invalid PDF structure" error on Chrome/Windows

## Rerun Context

This is a rerun via `/cody rerun`. The previous run did not produce a plan (architect stage was never completed). No previous code changes were made. This is effectively the first plan for this task.

**Bug Summary**: PDF.js viewer shows "Invalid PDF structure" error in certain lessons. Occurs on Chrome/Windows only (not Chrome/Mac). Affects most but not all lessons. The PDF loads (viewer appears) but content fails to render.

**Root Cause Analysis**: PDF.js v4.4.168 by default uses **HTTP range requests** to stream PDF content incrementally. The PDF files are served through Payload's proxy (`/api/media/file/...`) which proxies to Vercel Blob storage. The combination of:
1. Payload's static file handler not forwarding `Range` request headers to Vercel Blob
2. Vercel Blob returning `Content-Disposition: attachment` headers
3. Chrome/Windows handling range request failures differently than Chrome/Mac

...results in PDF.js receiving incomplete or improperly formatted response data, which it interprets as "Invalid PDF structure." Chrome on Mac falls back gracefully to full-document fetch, while Chrome on Windows does not.

**Fix Strategy**: Configure PDF.js to disable range requests and streaming, forcing it to download the full PDF file before rendering. This is the recommended approach from the PDF.js documentation for environments where range requests are unreliable. Additionally, add a configuration script that sets `disableAutoFetch: false` to ensure the full document is fetched upfront.

## Research Findings

- `src/infra/pdfjs/renderer.ts` ✅ exists — HTML rewrite pipeline with `renderViewerHtml()` function. Already injects `<script>` blocks before `</head>`. Lines 105-133 inject print-disabling scripts.
- `src/infra/pdfjs/config.ts` ✅ exists — CDN config, version, response headers
- `src/infra/pdfjs/validator.ts` ✅ exists — File URL validation
- `src/infra/pdfjs/template-loader.ts` ✅ exists — Viewer HTML/CSS fetching and caching
- `src/app/api/pdfjs-viewer/route.ts` ✅ exists — API route that serves the viewer HTML
- `src/ui/web/media/PDFMedia/index.tsx` ✅ exists — PDF viewer iframe component
- `tests/unit/pdfjs-renderer.test.ts` ✅ exists — 248-line test file for renderer with complete patterns
- `src/server/payload/plugins/index.ts` ✅ exists — Vercel Blob plugin config (proxy mode)

**Patterns observed**:
- The renderer uses a pipeline: rewrite CSS → render HTML → validate HTML
- Scripts are injected between `</style>` and `</head>` in the `renderViewerHtml()` function
- Tests use `describe/it/expect` from vitest, mock `vercel-blob-adapter`
- The renderer accepts optional `cdnBase` and `viewerUrls` params for testability
- PDF.js viewer reads the `file` query parameter from `window.location.search` natively

## Reuse Inventory

| Existing utility | Import path | Usage |
|---|---|---|
| `renderViewerHtml()` | `@/infra/pdfjs/renderer` | Will modify to inject PDF.js config script |
| `logger` | `@/infra/utils/logger` | Already imported in renderer |
| `cn()` | `@/infra/utils/ui` | Already used in PDFMedia |
| Test patterns | `tests/unit/pdfjs-renderer.test.ts` | Follow existing mock/describe/it pattern |

**No new utilities needed** — all changes are modifications to existing files.

---

## Step 1: Inject PDF.js configuration to disable range requests and streaming

### Root Cause
PDF.js uses HTTP range requests by default, which fail through the Payload proxy to Vercel Blob on Chrome/Windows. When range requests return unexpected responses (HTML error pages or malformed partial content), PDF.js interprets the data as "Invalid PDF structure."

### Files to Touch
- `src/infra/pdfjs/renderer.ts` (MODIFIED — lines 105-134, inject additional script block)

### Exact Behavior
Add a new `<script>` block in the `renderViewerHtml()` function that configures PDF.js to disable range requests and streaming before the viewer initializes. The script:

1. Intercepts PDF.js initialization via `PDFViewerApplicationOptions.set()` 
2. Sets `disableRange: true` — prevents HTTP Range header requests
3. Sets `disableStream: true` — prevents ReadableStream-based loading  
4. Sets `disableAutoFetch: false` — ensures the full document is fetched upfront
5. Sets `isEvalSupported: false` — security hardening (prevents eval in PDF.js)

The script should be injected **before** the existing print-disabling script, so it runs before viewer initialization. The script uses `document.addEventListener('webviewerloaded', ...)` which is PDF.js's official hook point for pre-configuration.

### Reproduction Test
- Test location: `tests/unit/pdfjs-renderer.test.ts` (add new test cases)
- Test: `renderViewerHtml should inject disableRange configuration script`
- What it tests: The rendered HTML must contain `disableRange` and `disableStream` configuration
- Why it fails before fix: The renderer currently does not inject any PDF.js loading configuration

### Acceptance Criteria
- [ ] `renderViewerHtml()` output contains `disableRange` set to `true`
- [ ] `renderViewerHtml()` output contains `disableStream` set to `true`  
- [ ] `renderViewerHtml()` output contains `disableAutoFetch` set to `false`
- [ ] Existing tests continue to pass (structure preserved, all asset replacements work)
- [ ] Validation still passes (`validateRewrittenHtml` should not flag new script)

### Test Details

```
Test file: tests/unit/pdfjs-renderer.test.ts
Run command: pnpm vitest run tests/unit/pdfjs-renderer.test.ts

New test cases to add:
1. "should inject PDF.js disableRange configuration" — verify rendered HTML contains disableRange: true
2. "should inject PDF.js disableStream configuration" — verify rendered HTML contains disableStream: true  
3. "should inject disableAutoFetch false for full document fetch" — verify disableAutoFetch: false
4. "should inject webviewerloaded event listener" — verify the official PDF.js hook is used
5. "should place PDF config script before print-disable script" — verify correct ordering
```

---

## Step 2: Add PDF load error handling in PDFMedia component

### Root Cause
When PDF.js fails to load a PDF, the iframe shows a generic PDF.js error message that is not user-friendly and provides no way to retry.

### Files to Touch
- `src/ui/web/media/PDFMedia/index.tsx` (MODIFIED — add error handling and retry UI)

### Exact Behavior
Enhance the PDFMedia component to:

1. Add an `onLoad` and `onError` handler to the iframe
2. Listen for `message` events from the PDF.js iframe (PDF.js posts error events via `postMessage`)  
3. When a PDF load error is detected, show a user-friendly error overlay with a "Retry" button
4. The retry button reconstructs the iframe URL with a cache-busting `&t=` timestamp parameter
5. Limit retries to 2 attempts to prevent infinite loops

This is a UX improvement that helps users recover from transient failures, even after the range-request fix in Step 1.

### Reproduction Test
- Test location: `tests/unit/pdf-media-error-handling.test.tsx` (NEW)
- Test: `PDFMedia should render retry button when error message is received`
- Why it fails before fix: PDFMedia currently has no error state or retry logic

### Acceptance Criteria
- [ ] PDFMedia renders iframe with `onError` handler
- [ ] Error state shows user-friendly message in Hebrew/English (i18n-ready)
- [ ] Retry button is present when error occurs
- [ ] Retry regenerates iframe URL with cache-busting parameter
- [ ] Maximum 2 retries before showing permanent error
- [ ] TypeScript compiles without errors (`pnpm tsc --noEmit`)

### Test Details

```
Test file: tests/unit/pdf-media-error-handling.test.tsx (NEW)
Run command: pnpm vitest run tests/unit/pdf-media-error-handling.test.tsx

New test cases:
1. "should render iframe with viewerUrl" — verify base rendering works
2. "should show error overlay after receiving error message" — mock postMessage
3. "should allow retry with cache-busting parameter" — verify URL changes on retry
4. "should limit retries to MAX_RETRIES" — verify max retries honored
5. "should not show error overlay in normal state" — verify no false positives
```

---

## Step 3: Add `Content-Type` enforcement in pdfjs-viewer API route

### Root Cause
The API route returns the viewer HTML but doesn't set any headers that tell PDF.js how to handle the PDF file fetch. Additionally, there's no logging when PDF file URLs are Vercel Blob URLs vs proxy URLs, making debugging harder.

### Files to Touch
- `src/app/api/pdfjs-viewer/route.ts` (MODIFIED — lines 94-110, add debug logging for file URL type)

### Exact Behavior
1. Add a log entry that identifies whether the validated file URL is a Vercel Blob URL or a proxy URL — this helps debug future issues
2. Add `X-PDF-Source` response header (debug only, redacted URL) to help identify the PDF source in DevTools

This is a minimal change for observability. The main fix is in Step 1 (disabling range requests).

### Reproduction Test
- Test location: `tests/unit/pdfjs-viewer-route.test.ts` (NEW)  
- Test: `GET /api/pdfjs-viewer should log file URL type`
- Why it fails before fix: No source-type logging exists

### Acceptance Criteria
- [ ] API route logs whether file URL is "blob" or "proxy" type
- [ ] Response includes `X-PDF-Source` header with redacted URL type
- [ ] Existing behavior is not changed (same HTML response)
- [ ] TypeScript compiles without errors

### Test Details

```
Test file: tests/unit/pdfjs-viewer-route.test.ts (NEW)
Run command: pnpm vitest run tests/unit/pdfjs-viewer-route.test.ts

New test cases:
1. "should include X-PDF-Source header in response" — verify header presence
2. "should identify blob URLs as source type 'blob'" — test with blob URL
3. "should identify proxy URLs as source type 'proxy'" — test with relative URL
```

---

## Verification Plan

After all steps are complete:

1. **Unit tests pass**: `pnpm vitest run tests/unit/pdfjs-renderer.test.ts tests/unit/pdf-media-error-handling.test.tsx`
2. **TypeScript compiles**: `pnpm tsc --noEmit`
3. **Lint passes**: `pnpm lint`
4. **No regressions**: All existing pdfjs tests continue to pass

### Manual Verification (for reviewer)
- Open the reproduction URL in Chrome on Windows: `https://www.aguy.co.il/courses/----4----471/chapters/471/lessons/471-2025-winter`
- PDF should load without "Invalid PDF structure" error
- If PDF still fails on first load, retry button should appear
- Verify PDF loads on Chrome/Mac (no regression)
