# Codebase Context: 260315-auto-913

## Files to Modify
- `src/infra/pdfjs/renderer.ts` (lines 73-134) — Inject PDF.js config script to disable range requests and streaming
- `src/ui/web/media/PDFMedia/index.tsx` (lines 1-48) — Add error handling, retry UI, and cache-busting for failed PDF loads
- `src/app/api/pdfjs-viewer/route.ts` (lines 94-110) — Add X-PDF-Source header and observability logging
- `tests/unit/pdfjs-renderer.test.ts` (MODIFIED) — Add new test cases for config injection

## Files to Create
- `tests/unit/pdf-media-error-handling.test.tsx` (NEW) — Unit tests for PDFMedia error handling and retry
- `tests/unit/pdfjs-viewer-route.test.ts` (NEW) — Unit tests for pdfjs-viewer route X-PDF-Source header

## Files to Read (reference patterns)
- `tests/unit/pdfjs-renderer.test.ts` — Test pattern: vitest describe/it/expect, mock vercel-blob-adapter, TEST_CDN_BASE/TEST_VIEWER_URLS constants, mockHtml template
- `src/infra/pdfjs/config.ts` — Config pattern: CDN_BASE, VIEWER_URLS, PDFJS_VERSION, RESPONSE_HEADERS
- `src/infra/pdfjs/validator.ts` — Validation pattern: ValidationResult type, validateFileUrl with same-origin/blob checks
- `src/infra/pdfjs/template-loader.ts` — Template caching pattern: Map-based cache, fetchText helper
- `tests/unit/pdf-fetcher-blob-handling.test.ts` — Pattern for testing isVercelBlobUrl usage

## Key Signatures
- `renderViewerHtml(html: string, css: string, cdnBase?: string, viewerUrls?: ViewerUrls): Promise<string>` from `src/infra/pdfjs/renderer.ts`
- `validateRewrittenHtml(html: string, cdnBase?: string, viewerUrls?: ViewerUrls): Promise<{ valid: boolean; issues: string[] }>` from `src/infra/pdfjs/renderer.ts`
- `rewriteCss(css: string, cdnBase?: string): string` from `src/infra/pdfjs/renderer.ts`
- `validateFileUrl(fileParam: string | null, requestOrigin: string): ValidationResult` from `src/infra/pdfjs/validator.ts`
- `redactUrl(url: string): string` from `src/infra/pdfjs/validator.ts`
- `isVercelBlobUrl(url: string): boolean` from `src/infra/blob/vercel-blob-adapter.ts`
- `loadViewerTemplate(viewerUrls?: ViewerUrls): Promise<...>` from `src/infra/pdfjs/template-loader.ts`
- `loadViewerCss(viewerUrls?: ViewerUrls): Promise<...>` from `src/infra/pdfjs/template-loader.ts`
- `RESPONSE_HEADERS` from `src/infra/pdfjs/config.ts` — `{ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': '...', 'Content-Disposition': 'inline' }`
- `systemEventBus.emit(SYSTEM_EVENTS.PDF_VIEWED, {...})` from `src/ui/web/media/PDFMedia/index.tsx`

## Reuse Inventory
- `renderViewerHtml` from `src/infra/pdfjs/renderer.ts` — extend to inject PDF.js config (disableRange/disableStream)
- `logger` from `src/infra/utils/logger` — already imported in renderer.ts and route.ts
- `redactUrl` from `src/infra/pdfjs/validator.ts` — reuse for logging in route.ts
- `isVercelBlobUrl` from `src/infra/blob/vercel-blob-adapter.ts` — reuse to detect PDF source type for X-PDF-Source header
- `cn()` from `src/infra/utils/ui` — already used in PDFMedia component for className merging
- `SYSTEM_EVENTS` from `src/infra/system-events` — already imported in PDFMedia for analytics
- `RESPONSE_HEADERS` from `src/infra/pdfjs/config.ts` — spread and extend with X-PDF-Source header

## Integration Points
- `renderViewerHtml()` is called from `src/app/api/pdfjs-viewer/route.ts` line 85
- PDFMedia iframe loads URL: `/api/pdfjs-viewer?file=${encodeURIComponent(pdfUrl)}&v=4.4.168`
- PDF.js viewer reads `file` from `window.location.search` natively
- PDF.js `webviewerloaded` event fires after viewer init, before document load — correct timing for config injection
- `PDFViewerApplicationOptions.set()` is the PDF.js API for runtime config changes
- Vercel Blob URLs: `https://<id>.public.blob.vercel-storage.com/media/<file>`
- Proxy URLs: `/api/media/file/<filename>` (Payload static handler)

## Imports Verified
- `@/infra/pdfjs/renderer` → exports renderViewerHtml, rewriteCss, validateRewrittenHtml ✅
- `@/infra/pdfjs/config` → exports CDN_BASE, VIEWER_URLS, RESPONSE_HEADERS, PDFJS_VERSION, ViewerUrls ✅
- `@/infra/pdfjs/validator` → exports validateFileUrl, redactUrl, ValidationResult ✅
- `@/infra/pdfjs/template-loader` → exports loadViewerTemplate, loadViewerCss, clearTemplateCache ✅
- `@/infra/blob/vercel-blob-adapter` → exports isVercelBlobUrl ✅
- `@/infra/utils/logger` → exports logger ✅
- `@/infra/utils/ui` → exports cn ✅
- `@/infra/system-events` → exports systemEventBus, SYSTEM_EVENTS ✅

## Test Commands
- `pnpm vitest run tests/unit/pdfjs-renderer.test.ts`
- `pnpm vitest run tests/unit/pdf-media-error-handling.test.tsx`
- `pnpm vitest run tests/unit/pdfjs-viewer-route.test.ts`
- `pnpm -s tsc --noEmit`
- `pnpm -s lint`
