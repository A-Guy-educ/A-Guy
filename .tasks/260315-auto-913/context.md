# Codebase Context: 260315-auto-913

## Files to Modify
- `tests/unit/pdf-media-postmessage.test.ts` (formatting only) — Run Prettier to fix whitespace/formatting issues that caused verify failure

## Files to Read (reference patterns)
- `tests/unit/pdfjs-config-api.test.ts` — Already correctly formatted test file for comparison
- `tests/unit/pdfjs-renderer.test.ts` — Already correctly formatted test file for comparison

## Key Signatures
- `renderViewerHtml(html: string, css: string, cdnBase?: string, viewerUrls?: ViewerUrls): Promise<string>` from `src/infra/pdfjs/renderer.ts`
- `PDFMedia` component from `src/ui/web/media/PDFMedia/index.tsx`

## Reuse Inventory
- All implementation is already in place — no new code needed
- `renderViewerHtml` from `src/infra/pdfjs/renderer.ts` — already uses correct `webviewerloaded` + `PDFViewerApplicationOptions.set()` API
- `PDFMedia` from `src/ui/web/media/PDFMedia/index.tsx` — already has `postMessage` listener

## Integration Points
- `renderViewerHtml()` called from `src/app/api/pdfjs-viewer/route.ts` line 86
- PDFMedia iframe loads `/api/pdfjs-viewer?file=...`
- PDF.js viewer reads `file` from `window.location.search`
- `webviewerloaded` event fires before document load
- `PDFViewerApplicationOptions.set()` is the correct API
- `documenterror` event fires on PDF load failure → `postMessage` to parent

## Imports Verified
- All imports verified in previous run ✅

## Test Commands
- `npx prettier --check tests/unit/pdf-media-postmessage.test.ts` — verify formatting
- `pnpm vitest run tests/unit/pdf-media-postmessage.test.ts --config vitest.config.unit.mts` — verify tests pass
- `pnpm -s tsc --noEmit` — TypeScript check
- `pnpm -s lint` — lint check
