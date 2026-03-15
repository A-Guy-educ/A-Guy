# Build Agent Report: 260315-auto-913

## Changes

### 1. Fixed PDF.js config injection in renderer.ts
**File**: `src/infra/pdfjs/renderer.ts` (lines 58-96)

**What was changed**: 
- Replaced the broken `window.PDFJS_GLOBAL_OPTS` injection with the correct PDF.js API: `document.addEventListener("webviewerloaded", ...)` + `PDFViewerApplicationOptions.set()`
- Added error reporting via `postMessage` so the parent frame knows when PDF.js fails to load

**Why**: The previous implementation used `window.PDFJS_GLOBAL_OPTS` which PDF.js does NOT read — it's a made-up global variable. The correct API is using the `webviewerloaded` event which fires after PDF.js initializes but BEFORE it opens the PDF document, allowing us to configure `disableRange: true` and `disableStream: true` to prevent the "Invalid PDF structure" errors on Chrome Windows caused by intermittent HTTP range request failures.

### 2. Added postMessage error listener in PDFMedia component
**File**: `src/ui/web/media/PDFMedia/index.tsx` (lines 29-49)

**What was changed**: 
- Added a `useEffect` that listens for `message` events from the iframe
- When the iframe posts a `pdf-load-error` message, triggers the retry UI

**Why**: The `iframe.onError` handler only fires for network-level errors (404), not for PDF.js-internal errors like "Invalid PDF structure". This ensures users see the retry UI when PDF.js fails to load the document.

### 3. Updated tests to verify correct API usage
**File**: `tests/unit/pdfjs-renderer.test.ts` (lines 251-302)

**What was changed**: 
- Updated tests to verify `PDFViewerApplicationOptions.set()` is used (not the broken `window.PDFJS_GLOBAL_OPTS`)
- Added tests for the `webviewerloaded` event listener pattern
- Added tests for `postMessage` error reporting

## Tests Written

- `tests/unit/pdfjs-renderer.test.ts` - Updated 4 existing tests + added 1 new test to verify:
  - `PDFViewerApplicationOptions.set` is used
  - `addEventListener("webviewerloaded")` pattern is used
  - `postMessage` with `pdf-load-error` type is sent
  - Config script appears before viewer.mjs

## Deviations

None — plan followed exactly.

## Quality

- TypeScript: PASS (`pnpm -s tsc --noEmit`)
- Lint: PASS (`pnpm -s lint`)
- Unit Tests: PASS (235 test files, 3700 tests passed)

## Acceptance Criteria Met

- [x] Renderer injects `document.addEventListener("webviewerloaded", ...)` script
- [x] Script calls `PDFViewerApplicationOptions.set("disableRange", true)`
- [x] Script calls `PDFViewerApplicationOptions.set("disableStream", true)`
- [x] No references to `window.PDFJS_GLOBAL_OPTS` remain in the codebase
- [x] Config injection script appears before the viewer.mjs script tag in HTML
- [x] Existing tests updated to verify the correct API
- [x] All unit tests pass
- [x] TypeScript compiles without errors
- [x] Lint passes
- [x] Renderer injects `documenterror` event listener that sends `postMessage`
- [x] PDFMedia component listens for `pdf-load-error` postMessage
- [x] When PDF.js reports an error, the retry UI is shown instead of raw error
