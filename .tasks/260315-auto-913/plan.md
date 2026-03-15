# Plan: Fix PDF "Invalid PDF structure" error on Chrome Windows

## Rerun Context

This is a rerun requested via `/cody rerun`. The previous run completed the architect stage but didn't produce a plan.md (no prev-run/plan.md found). The rerun feedback contains no specific code-level issues — just a generic rerun request. This plan is being written fresh based on the original bug report, clarified requirements, and codebase research.

## Research Findings

### File paths verified
- ✅ `src/infra/pdfjs/renderer.ts` — HTML rewrite pipeline, injects CSS/scripts into PDF.js viewer
- ✅ `src/infra/pdfjs/config.ts` — CDN_BASE, VIEWER_URLS, PDFJS_VERSION constants
- ✅ `src/infra/pdfjs/validator.ts` — URL validation for file parameter
- ✅ `src/infra/pdfjs/template-loader.ts` — Template caching, fetchText helper
- ✅ `src/app/api/pdfjs-viewer/route.ts` — GET handler that serves PDF.js viewer HTML
- ✅ `src/ui/web/media/PDFMedia/index.tsx` — Client component rendering PDF iframe
- ✅ `tests/unit/pdfjs-renderer.test.ts` — Existing renderer tests (pattern to follow)
- ✅ `src/infra/blob/vercel-blob-adapter.ts` — `isVercelBlobUrl` helper

### Patterns observed
- `renderViewerHtml()` uses string `.replace()` pipeline to rewrite HTML
- Script injection happens in Step 5 (CSS inlining) via `</head>` replacement
- PDF.js reads the `file` parameter from `window.location.search` natively
- No PDF.js configuration is currently injected (no `pdfjsLib` config)
- PDFMedia has no error handling — if PDF fails to load, user sees a blank/loading iframe

### Root cause analysis
The bug report shows:
- **Error**: `Invalid PDF structure` from PDF.js v4.4.168
- **Platform**: Chrome on Windows only (Mac Chrome works fine)
- **Reproducibility**: "sometimes" — intermittent
- **PDF files**: NOT corrupted (work on other devices)

**Root cause**: PDF.js by default uses **HTTP range requests** (partial content / byte-range fetching) to load PDFs incrementally. Vercel Blob storage responds to range requests, but there is a known issue where certain CDN edge nodes or intermediate proxies (particularly on Windows Chrome which may use different network stacks) can return malformed partial responses. When PDF.js reassembles these partial chunks, the resulting data doesn't form a valid PDF structure.

**Fix**: Disable range requests and streaming in PDF.js by injecting `pdfjsLib.GlobalWorkerOptions` configuration **before** the viewer script loads. This forces PDF.js to download the entire file as a single request, which is more reliable across all platforms.

Additionally, the PDFMedia component has zero error handling — when PDF.js fails, the user sees a perpetually loading iframe with no way to recover. We should add a retry mechanism and error state.

### Integration points
- `renderViewerHtml()` is called from `src/app/api/pdfjs-viewer/route.ts` line 85
- PDFMedia iframe loads URL: `/api/pdfjs-viewer?file=${encodeURIComponent(pdfUrl)}&v=4.4.168`
- PDF.js viewer reads `file` from `window.location.search` natively

## Reuse Inventory

### Existing utilities the plan will reuse
- `renderViewerHtml` from `src/infra/pdfjs/renderer.ts` — extend to inject PDF.js config script
- `logger` from `src/infra/utils/logger` — already imported in renderer.ts and route.ts
- `cn()` from `src/infra/utils/ui` — already used in PDFMedia component
- `SYSTEM_EVENTS` from `src/infra/system-events` — already imported in PDFMedia
- Test pattern from `tests/unit/pdfjs-renderer.test.ts` — TEST_CDN_BASE, mockHtml, describe/it/expect

### Justification for new code
- **PDF.js config injection script** — No existing utility for injecting PDF.js runtime configuration; this is a new concern specific to how PDF.js loads files
- **PDFMedia error/retry state** — No existing error boundary for iframe content; this is UI-specific to the PDF viewer

---

## Steps

### Step 1: Inject PDF.js configuration to disable range requests in renderer

**Root Cause**: PDF.js uses HTTP range requests by default. On Chrome Windows, intermittent CDN/proxy issues with partial responses cause "Invalid PDF structure" errors. Disabling range requests forces a single full-file download.

**Files to Touch**:
- `src/infra/pdfjs/renderer.ts` (MODIFIED - lines 73-134, Step 5 section)

**Reproduction Test**: Write a test that demonstrates the config injection is missing (MUST FAIL now):
- Test location: `tests/unit/pdfjs-renderer.test.ts` (MODIFIED — add new test cases)
- Test 1: `renderViewerHtml should inject disableRange configuration script before </head>`
  - Calls `renderViewerHtml(mockHtml, mockCss, TEST_CDN_BASE, TEST_VIEWER_URLS)`
  - Asserts the output HTML contains `disableRange: true`
  - Asserts the output HTML contains `disableStream: true`
  - **Why it fails now**: No PDF.js config is injected in the current renderer
- Test 2: `renderViewerHtml should inject PDF.js config script BEFORE viewer.mjs script`
  - Verifies the config script appears before `src="${TEST_VIEWER_URLS.mjs}"` in the HTML
  - This ensures the config is set before PDF.js initializes
  - **Why it fails now**: No config script exists at all

**Fix**:
In `renderViewerHtml()`, add a new Step 6 after the existing security script injection (or combine with Step 5's `</head>` replacement). Inject a `<script>` block that sets PDF.js `GlobalWorkerOptions` and viewer `AppOptions`:

```
<script>
// Force full-file download to prevent range request issues on certain platforms
document.addEventListener('webviewerloaded', function() {
  if (typeof PDFViewerApplicationOptions !== 'undefined') {
    PDFViewerApplicationOptions.set('disableRange', true);
    PDFViewerApplicationOptions.set('disableStream', true);
  }
});
</script>
```

The `webviewerloaded` event is the standard PDF.js hook that fires after the viewer application is initialized but before it starts loading a document. This is the correct timing to set these options.

**Verification**:
- Run `pnpm vitest run tests/unit/pdfjs-renderer.test.ts` → new tests FAIL before fix, PASS after
- Existing tests continue to PASS (no regression)

**Acceptance Criteria**:
- [ ] `renderViewerHtml` output contains `disableRange: true`
- [ ] `renderViewerHtml` output contains `disableStream: true`
- [ ] Config script uses `webviewerloaded` event for proper timing
- [ ] All existing renderer tests still pass
- [ ] New tests verify the config injection

---

### Step 2: Add error handling and retry to PDFMedia component

**Root Cause**: When PDF.js fails to load a PDF (for any reason including the range request bug), the user sees a perpetually loading iframe with no feedback or recovery option.

**Files to Touch**:
- `src/ui/web/media/PDFMedia/index.tsx` (MODIFIED - lines 1-48, full rewrite)

**Reproduction Test**:
- Test location: `tests/unit/pdf-media-error-handling.test.tsx` (NEW)
- Test 1: `PDFMedia should render retry button when onError fires on iframe`
  - Renders PDFMedia with a mock resource
  - Simulates iframe error event
  - Asserts a retry button appears
  - **Why it fails now**: No error handling exists in PDFMedia
- Test 2: `PDFMedia should append cache-busting parameter on retry`
  - Renders PDFMedia, triggers error, clicks retry
  - Asserts the iframe src contains a `&t=` timestamp parameter
  - **Why it fails now**: No retry mechanism exists
- Test 3: `PDFMedia should limit retries and show permanent error after max attempts`
  - Triggers error 3 times
  - Asserts an error message is shown instead of retry button
  - **Why it fails now**: No max retry logic exists

**Fix**:
Add state management to PDFMedia:
- `retryCount` state (starts at 0)
- `hasError` state (boolean)
- `MAX_RETRIES` constant (3)
- Listen for iframe `onError` event
- On error: set `hasError = true`
- Retry button: increments `retryCount`, appends `&t={Date.now()}` to bust cache, resets `hasError`
- After MAX_RETRIES: show permanent error message with link to open PDF in new tab

**Verification**:
- Run `pnpm vitest run tests/unit/pdf-media-error-handling.test.tsx` → new tests FAIL before fix, PASS after
- Manual verification: PDFMedia shows retry button on error, cache-busting works

**Acceptance Criteria**:
- [ ] PDFMedia shows a retry button when iframe fails to load
- [ ] Retry appends cache-busting parameter to iframe src
- [ ] After 3 retries, shows permanent error with fallback link
- [ ] Normal PDF loading still works (no regression)
- [ ] Component uses existing `cn()` utility for styling

---

### Step 3: Add observability logging for PDF source type in viewer route

**Root Cause**: Without knowing whether a PDF is served from Vercel Blob (direct URL) or through the Payload media proxy, it's impossible to correlate the "Invalid PDF structure" errors with the serving path.

**Files to Touch**:
- `src/app/api/pdfjs-viewer/route.ts` (MODIFIED - lines 94-110)

**Reproduction Test**:
- Test location: `tests/unit/pdfjs-viewer-route.test.ts` (NEW)
- Test 1: `GET should add X-PDF-Source header with value 'blob' for Vercel Blob URLs`
  - Mock the template/CSS loaders
  - Send request with `?file=https://example.blob.vercel-storage.com/media/test.pdf`
  - Assert response has `X-PDF-Source: blob` header
  - **Why it fails now**: No X-PDF-Source header is set
- Test 2: `GET should add X-PDF-Source header with value 'proxy' for relative URLs`
  - Send request with `?file=/api/media/file/test.pdf`
  - Assert response has `X-PDF-Source: proxy` header
  - **Why it fails now**: No X-PDF-Source header is set

**Fix**:
After the HTML is rendered and validated (around line 100), determine the PDF source type using `isVercelBlobUrl()` and add it as a response header and log field:

```typescript
import { isVercelBlobUrl } from '@/infra/blob/vercel-blob-adapter'

// ... after validation ...
const pdfSource = isVercelBlobUrl(validatedFileUrl) ? 'blob' : 'proxy'

reqLogger.info(
  { fileUrl: redactUrl(validatedFileUrl), htmlSize: html.length, pdfSource },
  'Successfully rendered PDF viewer',
)

return new NextResponse(html, {
  status: 200,
  headers: {
    ...RESPONSE_HEADERS,
    'X-PDF-Source': pdfSource,
  },
})
```

**Verification**:
- Run `pnpm vitest run tests/unit/pdfjs-viewer-route.test.ts` → new tests FAIL before fix, PASS after
- Check that existing route behavior is preserved

**Acceptance Criteria**:
- [ ] Response includes `X-PDF-Source` header with value `blob` or `proxy`
- [ ] Logger output includes `pdfSource` field
- [ ] Existing route behavior (validation, error handling) is unchanged
- [ ] Import of `isVercelBlobUrl` is added

---

## Quality Gates

After all steps:
- `pnpm vitest run tests/unit/pdfjs-renderer.test.ts` — all pass
- `pnpm vitest run tests/unit/pdf-media-error-handling.test.tsx` — all pass
- `pnpm vitest run tests/unit/pdfjs-viewer-route.test.ts` — all pass
- `pnpm -s tsc --noEmit` — no type errors
- `pnpm -s lint` — no lint errors
