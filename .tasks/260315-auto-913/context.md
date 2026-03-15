# Codebase Context: 260315-auto-913

## Files to Modify
- `src/infra/pdfjs/renderer.ts` (lines 73-134) — Inject PDF.js configuration script to disable range requests and streaming
- `src/ui/web/media/PDFMedia/index.tsx` (lines 1-48) — Add error handling, retry UI, and cache-busting for failed PDF loads
- `src/app/api/pdfjs-viewer/route.ts` (lines 94-110) — Add observability logging for PDF source type

## Files to Create
- `tests/unit/pdf-media-error-handling.test.tsx` (NEW) — Unit tests for PDFMedia error handling
- `tests/unit/pdfjs-viewer-route.test.ts` (NEW) — Unit tests for pdfjs-viewer route observability

## Files to Read (reference patterns)
- `tests/unit/pdfjs-renderer.test.ts` — Test pattern: vitest describe/it/expect, mock vercel-blob-adapter, TEST_CDN_BASE/TEST_VIEWER_URLS constants, mockHtml template
- `src/infra/pdfjs/config.ts` — Config pattern: CDN_BASE, VIEWER_URLS, PDFJS_VERSION, RESPONSE_HEADERS
- `src/infra/pdfjs/validator.ts` — Validation pattern: ValidationResult type, validateFileUrl with same-origin/blob checks
- `src/infra/pdfjs/template-loader.ts` — Template caching pattern: Map-based cache, fetchText helper
- `src/server/payload/plugins/index.ts` — Plugin config: vercelBlobStorage in proxy mode (clientUploads: false)

## Key Signatures
- `renderViewerHtml(html: string, css: string, cdnBase?: string, viewerUrls?: ViewerUrls): Promise<string>` from `src/infra/pdfjs/renderer.ts`
- `validateRewrittenHtml(html: string, cdnBase?: string, viewerUrls?: ViewerUrls): Promise<{ valid: boolean; issues: string[] }>` from `src/infra/pdfjs/renderer.ts`
- `rewriteCss(css: string, cdnBase?: string): string` from `src/infra/pdfjs/renderer.ts`
- `validateFileUrl(fileParam: string | null, requestOrigin: string): ValidationResult` from `src/infra/pdfjs/validator.ts`
- `redactUrl(url: string): string` from `src/infra/pdfjs/validator.ts`
- `isVercelBlobUrl(url: string): boolean` from `src/infra/blob/vercel-blob-adapter.ts`
- `RESPONSE_HEADERS` from `src/infra/pdfjs/config.ts` — `{ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600...', 'Content-Disposition': 'inline' }`
- `systemEventBus.emit(SYSTEM_EVENTS.PDF_VIEWED, {...})` from `src/ui/web/media/PDFMedia/index.tsx`

## Reuse Inventory
- `renderViewerHtml` from `src/infra/pdfjs/renderer.ts` — extend to inject PDF.js config
- `logger` from `src/infra/utils/logger` — already imported in renderer.ts and route.ts
- `redactUrl` from `src/infra/pdfjs/validator.ts` — reuse for X-PDF-Source header
- `isVercelBlobUrl` from `src/infra/blob/vercel-blob-adapter.ts` — reuse to detect source type
- `cn()` from `src/infra/utils/ui` — already used in PDFMedia component
- `SYSTEM_EVENTS` from `src/infra/system-events` — already imported in PDFMedia

## Integration Points
- `renderViewerHtml()` is called from `src/app/api/pdfjs-viewer/route.ts` line 85
- PDFMedia iframe loads URL: `/api/pdfjs-viewer?file=${encodeURIComponent(pdfUrl)}&v=4.4.168`
- PDF.js viewer reads `file` from `window.location.search` natively
- Media URLs in proxy mode: `/api/media/file/<filename>` (Payload static handler)
- Vercel Blob URLs: `https://<id>.public.blob.vercel-storage.com/media/<file>`
- Both URL types are validated by `validateFileUrl()` (same-origin or blob origin)

## Imports Verified
- `@/infra/pdfjs/renderer` → exports renderViewerHtml, rewriteCss, validateRewrittenHtml ✅
- `@/infra/pdfjs/config` → exports CDN_BASE, VIEWER_URLS, RESPONSE_HEADERS, PDFJS_VERSION ✅
- `@/infra/pdfjs/validator` → exports validateFileUrl, redactUrl, ValidationResult ✅
- `@/infra/blob/vercel-blob-adapter` → exports isVercelBlobUrl ✅
- `@/infra/utils/logger` → exports logger ✅
- `@/infra/utils/ui` → exports cn ✅
- `@/infra/system-events` → exports systemEventBus, SYSTEM_EVENTS ✅
