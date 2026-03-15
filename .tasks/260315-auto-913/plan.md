# Plan: 260315-auto-913

## Rerun Context

This is a rerun. The previous run added `window.PDFJS_GLOBAL_OPTS` injection to `renderer.ts` to disable range requests and streaming, but this approach is **ineffective** because PDF.js does NOT read from `window.PDFJS_GLOBAL_OPTS`. That is a made-up global variable. The tests pass because they only check that the injected script text contains the string `disableRange`, not that PDF.js actually uses it.

**What changed**: The fix approach is revised to use the correct PDF.js API — the `webviewerloaded` event + `PDFViewerApplicationOptions.set()` — which is the documented method for configuring the pre-built PDF.js viewer before document load.

**Root cause confirmed**: The "Invalid PDF structure" error on Chrome Windows is caused by failed HTTP range requests (206 Partial Content). Payload's proxy or Vercel Blob intermittently returns corrupted partial content on certain platforms. Disabling range requests forces PDF.js to download the entire file as a single GET request, which is reliable.

## Research Findings

- `src/infra/pdfjs/renderer.ts` ✅ exists — contains `renderViewerHtml()` with the broken `PDFJS_GLOBAL_OPTS` injection at Step 1.5 (lines 58-73)
- `src/infra/pdfjs/config.ts` ✅ exists — `RESPONSE_HEADERS` already has `Access-Control-Allow-Origin: *`
- `src/ui/web/media/PDFMedia/index.tsx` ✅ exists — already has retry/error UI (no changes needed)
- `src/app/api/pdfjs-viewer/route.ts` ✅ exists — already has `X-PDF-Source` header (no changes needed)
- `tests/unit/pdfjs-renderer.test.ts` ✅ exists — has tests for config injection (lines 251-302)
- **Pattern observed**: The pre-built PDF.js viewer (v4.4.168) exposes `PDFViewerApplicationOptions` as a global and fires a `webviewerloaded` event on `document` before opening the PDF. The correct API to disable range requests is `PDFViewerApplicationOptions.set("disableRange", true)` called inside a `webviewerloaded` event listener.
- **Integration point**: `renderViewerHtml()` is the only place where we inject scripts into the viewer HTML. The injected script must execute BEFORE the viewer module script runs its initialization.

## Reuse Inventory

### Existing utilities the plan will reuse
- `renderViewerHtml()` from `src/infra/pdfjs/renderer.ts` — modify the Step 1.5 injection script
- `logger` from `src/infra/utils/logger` — already imported in renderer.ts
- `TEST_CDN_BASE`, `TEST_VIEWER_URLS` from `tests/unit/pdfjs-renderer.test.ts` — reuse test constants
- `cn()` from `src/infra/utils/ui` — already used in PDFMedia (no changes needed)

### Justification for NO new utilities
- The fix modifies an existing injection script in `renderer.ts`. No new files or utilities needed.

---

## Step 1: Fix PDF.js config injection to use correct API

**Root Cause**: The `renderViewerHtml()` function in `renderer.ts` injects a `<script>` that sets `window.PDFJS_GLOBAL_OPTS.disableRange = true`, but PDF.js v4.4.168 does NOT read from `window.PDFJS_GLOBAL_OPTS`. This is a made-up global variable. As a result, range requests are NOT actually disabled, and Chrome Windows users experience "Invalid PDF structure" errors due to intermittent 206 Partial Content failures.

**Files to Touch**:
- `src/infra/pdfjs/renderer.ts` (MODIFIED — lines 58-73, Step 1.5 script injection)

**Reproduction Test**: Update existing tests to verify the correct PDF.js API is used:
- Test location: `tests/unit/pdfjs-renderer.test.ts`
- What it tests: That the injected script uses `PDFViewerApplicationOptions.set("disableRange", true)` instead of `window.PDFJS_GLOBAL_OPTS`
- Why it fails: Currently the script sets `window.PDFJS_GLOBAL_OPTS` which PDF.js ignores

**Tests** (modify existing in `tests/unit/pdfjs-renderer.test.ts`, "PDF.js configuration injection" describe block):

1. **Test: "should inject webviewerloaded event listener to set disableRange via PDFViewerApplicationOptions"**
   - Render HTML via `renderViewerHtml()`
   - Assert result contains `PDFViewerApplicationOptions.set` 
   - Assert result contains `disableRange`
   - Assert result contains `disableStream`
   - Assert result does NOT contain `PDFJS_GLOBAL_OPTS` (the broken approach)
   - FAILS before fix (contains `PDFJS_GLOBAL_OPTS`), PASSES after

2. **Test: "should inject webviewerloaded event listener before viewer.mjs loads"**
   - Render HTML via `renderViewerHtml()`
   - Assert the `webviewerloaded` listener script appears BEFORE the viewer.mjs `<script>` tag
   - PASSES (already passes since Step 1.5 injects into `<head>` before Step 2)

3. **Test: "should use document.addEventListener webviewerloaded pattern"**
   - Render HTML via `renderViewerHtml()`
   - Assert result contains `addEventListener` and `webviewerloaded`
   - FAILS before fix, PASSES after

**Fix**: Replace the Step 1.5 script injection in `renderer.ts` (lines 63-73) to use the correct PDF.js API:

```javascript
// OLD (broken — PDF.js ignores this):
window.PDFJS_GLOBAL_OPTS = window.PDFJS_GLOBAL_OPTS || {};
window.PDFJS_GLOBAL_OPTS.disableRange = true;
window.PDFJS_GLOBAL_OPTS.disableStream = true;

// NEW (correct — uses PDF.js webviewerloaded API):
document.addEventListener("webviewerloaded", function() {
  PDFViewerApplicationOptions.set("disableRange", true);
  PDFViewerApplicationOptions.set("disableStream", true);
});
```

The `webviewerloaded` event is dispatched by the PDF.js viewer after it initializes `PDFViewerApplicationOptions` but BEFORE it opens the PDF document. This is the documented way to configure the pre-built viewer.

**Verification**:
- Run `pnpm vitest run tests/unit/pdfjs-renderer.test.ts --config vitest.config.unit.mts` → all tests pass
- Run `pnpm -s tsc --noEmit` → no type errors

**Acceptance Criteria**:
- [ ] Renderer injects `document.addEventListener("webviewerloaded", ...)` script
- [ ] Script calls `PDFViewerApplicationOptions.set("disableRange", true)`
- [ ] Script calls `PDFViewerApplicationOptions.set("disableStream", true)`
- [ ] No references to `window.PDFJS_GLOBAL_OPTS` remain in the codebase
- [ ] Config injection script appears before the viewer.mjs script tag in HTML
- [ ] Existing tests updated to verify the correct API
- [ ] All unit tests pass
- [ ] TypeScript compiles without errors
- [ ] Lint passes

---

## Step 2: Add PDF loading error detection via postMessage in PDFMedia iframe

**Root Cause**: The `iframe.onError` handler only fires for network-level errors (like 404), NOT for PDF.js-internal errors (like "Invalid PDF structure"). This means the existing retry UI never activates for the actual bug. The user sees PDF.js's raw error message inside the iframe instead of the retry UI.

**Files to Touch**:
- `src/ui/web/media/PDFMedia/index.tsx` (MODIFIED — lines 119-128, iframe section)
- `src/infra/pdfjs/renderer.ts` (MODIFIED — add postMessage error reporting in the injected script)

**Reproduction Test**:
- Test location: `tests/unit/pdfjs-renderer.test.ts`
- What it tests: That the injected script includes error detection that posts a message to the parent window when PDF loading fails
- Why it fails: Currently no postMessage error reporting exists

**Tests** (add to `tests/unit/pdfjs-renderer.test.ts`):

1. **Test: "should inject error reporting via postMessage when PDF load fails"**
   - Render HTML via `renderViewerHtml()`
   - Assert result contains `postMessage`
   - Assert result contains `pdf-load-error` (the message type)
   - FAILS before fix, PASSES after

2. **Test: "PDFMedia should listen for postMessage pdf-load-error"** (in new test file `tests/unit/pdf-media.test.tsx`)
   - This is a conceptual test — we verify the component code includes `addEventListener("message", ...)` with `pdf-load-error` handling
   - Since this is a React component with iframe, unit testing is limited; verify via code review

**Fix**:

A. In `renderer.ts`, extend the `webviewerloaded` handler to also add error reporting:
```javascript
document.addEventListener("webviewerloaded", function() {
  PDFViewerApplicationOptions.set("disableRange", true);
  PDFViewerApplicationOptions.set("disableStream", true);
  PDFViewerApplicationOptions.set("disablePreferences", true);
  
  // Report load errors to parent frame for retry UI
  PDFViewerApplication.initializedPromise.then(function() {
    PDFViewerApplication.eventBus.on("documenterror", function() {
      if (window.parent !== window) {
        window.parent.postMessage({ type: "pdf-load-error" }, "*");
      }
    });
  });
});
```

B. In `PDFMedia/index.tsx`, add a `message` event listener to detect `pdf-load-error`:
```typescript
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'pdf-load-error') {
      setHasError(true)
    }
  }
  window.addEventListener('message', handleMessage)
  return () => window.removeEventListener('message', handleMessage)
}, [])
```

**Verification**:
- Run `pnpm vitest run tests/unit/pdfjs-renderer.test.ts --config vitest.config.unit.mts` → passes
- Run `pnpm -s tsc --noEmit` → no type errors
- Run `pnpm -s lint` → passes

**Acceptance Criteria**:
- [ ] Renderer injects `documenterror` event listener that sends `postMessage`
- [ ] PDFMedia component listens for `pdf-load-error` postMessage
- [ ] When PDF.js reports an error, the retry UI is shown instead of raw error
- [ ] Error handling doesn't trigger on valid PDFs
- [ ] TypeScript compiles without errors
- [ ] All tests pass
