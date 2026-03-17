# Build Agent Report: 260315-auto-913

## Summary

Fixed PDF viewer bug causing "Invalid or corrupted PDF file" errors on Chrome Windows. Root cause was HTTP range requests (206 Partial Content) intermittently failing when Payload proxy or Vercel Blob serves partial content. Previous fix using `window.PDFJS_GLOBAL_OPTS` was ineffective (PDF.js ignores this non-existent variable). Applied correct fix using PDF.js documented API.

## Changes

### Core Implementation

1. **`src/infra/pdfjs/renderer.ts`** - Fixed PDF.js configuration injection:
   - Changed from ineffective `window.PDFJS_GLOBAL_OPTS.disableRange = true` to correct API:
     - `document.addEventListener("webviewerloaded", ...)` 
     - `PDFViewerApplicationOptions.set("disableRange", true)`
   - Added postMessage bridge from iframe error events to parent component for retry UI
   - Added detailed comments explaining why this API is correct and the previous approach was a no-op

2. **`src/ui/web/media/PDFMedia/index.tsx`** - Added error handling:
   - Added `postMessage` listener for `pdf-load-error` events from iframe
   - Shows retry UI when PDF fails to load due to range request issues

### Tests Created/Updated

1. **`tests/unit/pdfjs-config-api.test.ts`** (NEW) - 7 tests verifying:
   - `webviewerloaded` event listener is present in rendered HTML
   - `PDFViewerApplicationOptions.set` calls are present
   - Configuration is injected before viewer scripts

2. **`tests/unit/pdf-media-postmessage.test.ts`** (NEW) - 6 tests verifying:
   - postMessage listener is registered for error handling
   - Error messages from iframe are properly handled

3. **`tests/unit/pdfjs-renderer.test.ts`** (UPDATED) - 27 tests now verify:
   - Correct API (`webviewerloaded` + `PDFViewerApplicationOptions.set`) is used
   - `disableRange`, `disableStream`, `disablePreferences` are set
   - Error handling postMessage is injected

### Test Results

All 132 PDF-related tests pass:
- `tests/unit/pdfjs-renderer.test.ts` - 27 tests ✅
- `tests/unit/pdfjs-validator.spec.ts` - 26 tests ✅
- `tests/unit/components/PDFMedia.test.tsx` - 6 tests ✅
- `tests/unit/pdf-fetcher-blob-handling.test.ts` - 14 tests ✅
- `tests/unit/pdfjs-security.test.ts` - 10 tests ✅
- `tests/unit/pdfjs-config-api.test.ts` - 7 tests ✅
- `tests/unit/pdf-media-postmessage.test.ts` - 6 tests ✅
- Plus 36 additional PDF-related tests ✅

## Quality

- TypeScript: PASS (`pnpm -s tsc --noEmit`)
- Lint: PASS (`pnpm -s lint`)
- Prettier: PASS (fixed formatting in test file)

## Deviations

None — plan followed exactly. Previous implementation used incorrect API which has been replaced with the correct documented API.

## Root Cause Analysis

The "Invalid PDF structure" error occurred because:
1. PDF.js uses HTTP range requests (206 Partial Content) to efficiently download large PDFs
2. When Vercel Blob or Payload proxy serves partial content, sometimes the response is corrupted/malformed
3. PDF.js then fails to parse the PDF with "Invalid PDF structure" error
4. The previous fix used `window.PDFJS_GLOBAL_OPTS` which PDF.js ignores — it's not a real API
5. The correct fix uses `PDFViewerApplicationOptions.set("disableRange", true)` which forces single-request download

## Fix Applied

- `disableRange: true` — Disables HTTP range requests, forces full file download
- `disableStream: true` — Disables streaming mode for simpler request handling  
- `disablePreferences: true` — Prevents user preference overrides
