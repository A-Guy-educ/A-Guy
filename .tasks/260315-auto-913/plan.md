# Plan: 260315-auto-913

## Rerun Context

This is a rerun after pipeline failure. The **implementation is already complete and correct**. The previous run successfully:
1. Fixed `src/infra/pdfjs/renderer.ts` — replaced broken `window.PDFJS_GLOBAL_OPTS` with correct `webviewerloaded` + `PDFViewerApplicationOptions.set()` API
2. Added `postMessage` error reporting from iframe to parent in renderer.ts
3. Added `message` event listener in `src/ui/web/media/PDFMedia/index.tsx` for `pdf-load-error`
4. Added test files `tests/unit/pdfjs-config-api.test.ts` and `tests/unit/pdf-media-postmessage.test.ts`
5. Updated `tests/unit/pdfjs-renderer.test.ts` with correct assertions

**The only failure was a Prettier formatting error** in `tests/unit/pdf-media-postmessage.test.ts`. The verify stage caught this:
```
[warn] tests/unit/pdf-media-postmessage.test.ts
Code style issues found in the above file. Run Prettier with --write to fix.
```

**All code logic is correct**. All tests pass. TypeScript compiles. Lint passes. The only fix needed is running `prettier --write` on the test file.

## Research Findings

- `src/infra/pdfjs/renderer.ts` ✅ exists — already has correct `webviewerloaded` + `PDFViewerApplicationOptions.set()` implementation
- `src/ui/web/media/PDFMedia/index.tsx` ✅ exists — already has `postMessage` listener for `pdf-load-error`
- `tests/unit/pdfjs-config-api.test.ts` ✅ exists — 7 passing tests, formatted correctly
- `tests/unit/pdf-media-postmessage.test.ts` ✅ exists — 6 passing tests, **has Prettier formatting issue**
- `tests/unit/pdfjs-renderer.test.ts` ✅ exists — 27 passing tests, formatted correctly
- `src/infra/pdfjs/config.ts` ✅ exists — `RESPONSE_HEADERS` already has `Access-Control-Allow-Origin: *`

## Reuse Inventory

### Existing utilities reused (already implemented)
- `renderViewerHtml()` from `src/infra/pdfjs/renderer.ts` — already modified
- `logger` from `src/infra/utils/logger` — already imported
- `cn()` from `src/infra/utils/ui` — already used in PDFMedia
- `TEST_CDN_BASE`, `TEST_VIEWER_URLS` — reused in test files

### No new utilities needed

---

## Step 1: Fix Prettier formatting in pdf-media-postmessage.test.ts

**Root Cause**: The test file `tests/unit/pdf-media-postmessage.test.ts` has a Prettier formatting issue that caused the verify stage to fail. The test logic is correct — only whitespace/formatting needs to be fixed.

**Files to Touch**:
- `tests/unit/pdf-media-postmessage.test.ts` (MODIFIED — formatting only)

**Fix**: Run `prettier --write` on the file. No logic changes needed.

**Reproduction Test**: The formatting check itself is the test:
- Run `npx prettier --check tests/unit/pdf-media-postmessage.test.ts` → FAILS before fix, PASSES after

**Verification**:
- `npx prettier --check tests/unit/pdf-media-postmessage.test.ts` → passes
- `pnpm vitest run tests/unit/pdf-media-postmessage.test.ts --config vitest.config.unit.mts` → 6 tests pass
- `pnpm -s tsc --noEmit` → no errors
- `pnpm -s lint` → no errors

**Acceptance Criteria**:
- [ ] Prettier reports no formatting issues for `tests/unit/pdf-media-postmessage.test.ts`
- [ ] All 6 tests in the file still pass
- [ ] All quality gates pass (tsc, lint, format, tests)
