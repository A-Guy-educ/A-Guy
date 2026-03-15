# Codebase Context: 260315-auto-913

## Files to Modify
- `src/infra/pdfjs/renderer.ts` (lines 58-73) — Replace broken `window.PDFJS_GLOBAL_OPTS` script injection with correct `webviewerloaded` event + `PDFViewerApplicationOptions.set()` API; add `documenterror` postMessage reporting
- `src/ui/web/media/PDFMedia/index.tsx` (lines 29-37, 119-128) — Add `message` event listener for `pdf-load-error` postMessage from iframe to trigger retry UI
- `tests/unit/pdfjs-renderer.test.ts` (lines 251-302) — Update "PDF.js configuration injection" tests to verify correct API usage

## Files to Read (reference patterns)
- `tests/unit/pdfjs-renderer.test.ts` — Test pattern: vitest describe/it/expect, mock vercel-blob-adapter, TEST_CDN_BASE/TEST_VIEWER_URLS constants, mockHtml template
- `src/infra/pdfjs/config.ts` — Config pattern: CDN_BASE, VIEWER_URLS, PDFJS_VERSION, RESPONSE_HEADERS (already has `Access-Control-Allow-Origin: *`)
- `src/infra/pdfjs/validator.ts` — Validation pattern: validateFileUrl with same-origin/blob checks
- `src/server/payload/plugins/index.ts` (lines 48-60) — Vercel Blob plugin config: proxy mode, no prefix

## Key Signatures
- `renderViewerHtml(html: string, css: string, cdnBase?: string, viewerUrls?: ViewerUrls): Promise<string>` from `src/infra/pdfjs/renderer.ts`
- `validateRewrittenHtml(html: string, cdnBase?: string, viewerUrls?: ViewerUrls): Promise<{ valid: boolean; issues: string[] }>` from `src/infra/pdfjs/renderer.ts`
- `rewriteCss(css: string, cdnBase?: string): string` from `src/infra/pdfjs/renderer.ts`
- `RESPONSE_HEADERS` from `src/infra/pdfjs/config.ts` — includes `Access-Control-Allow-Origin: *`
- `isVercelBlobUrl(url: string): boolean` from `src/infra/blob/vercel-blob-adapter.ts`

## Reuse Inventory
- `renderViewerHtml` from `src/infra/pdfjs/renderer.ts` — modify Step 1.5 injection script (no new functions)
- `logger` from `src/infra/utils/logger` — already imported in renderer.ts
- `cn()` from `src/infra/utils/ui` — already used in PDFMedia component
- `SYSTEM_EVENTS` from `src/infra/system-events` — already imported in PDFMedia for analytics
- `TEST_CDN_BASE`, `TEST_VIEWER_URLS` from `tests/unit/pdfjs-renderer.test.ts` — reuse test constants

## Integration Points
- `renderViewerHtml()` is called from `src/app/api/pdfjs-viewer/route.ts` line 86
- PDFMedia iframe loads URL: `/api/pdfjs-viewer?file=${encodeURIComponent(pdfUrl)}&v=4.4.168&t=${timestamp}`
- PDF.js viewer reads `file` from `window.location.search` natively
- PDF.js pre-built viewer fires `webviewerloaded` event on `document` after `PDFViewerApplicationOptions` is initialized but BEFORE document load
- `PDFViewerApplicationOptions.set(name, value)` is the correct API for setting viewer options
- `PDFViewerApplication.eventBus.on("documenterror", ...)` fires when PDF loading fails
- Vercel Blob plugin uses proxy mode — URLs are `/api/media/file/...` (same-origin)

## Imports Verified
- `@/infra/pdfjs/renderer` → exports renderViewerHtml, rewriteCss, validateRewrittenHtml ✅
- `@/infra/pdfjs/config` → exports CDN_BASE, VIEWER_URLS, RESPONSE_HEADERS, PDFJS_VERSION, ViewerUrls ✅
- `@/infra/utils/logger` → exports logger ✅
- `@/infra/utils/ui` → exports cn ✅
- `@/infra/system-events` → exports systemEventBus, SYSTEM_EVENTS ✅

## PDF.js API Notes (Critical for Build Agent)
- **WRONG**: `window.PDFJS_GLOBAL_OPTS` — This is a made-up global, PDF.js does NOT read it
- **CORRECT**: `PDFViewerApplicationOptions.set("disableRange", true)` — The documented API
- **TIMING**: Must be called inside `document.addEventListener("webviewerloaded", ...)` handler
- **ERROR EVENTS**: `PDFViewerApplication.eventBus.on("documenterror", ...)` fires when PDF fails to load
- **INIT PROMISE**: `PDFViewerApplication.initializedPromise` resolves when the app is fully ready

## Test Commands
- `pnpm vitest run tests/unit/pdfjs-renderer.test.ts --config vitest.config.unit.mts`
- `pnpm -s tsc --noEmit`
- `pnpm -s lint`
