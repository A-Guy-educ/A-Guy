# Issue #2139: Rename "PDF view" to "Scroll view" and align content per locale

## What was done

### Translation changes
- `en.json` / `he.json`: `pdfView` key renamed to `scrollView` with values "Scroll View" / "תצוגת גלילה". `lessonViewModePdf` changed from "PDF" to "Scroll view" / "תצוגת גלילה".

### UI label changes
- `ViewToggle.tsx`: `t('pdfView')` → `t('scrollView')` (student toggle label).
- `Lessons.ts` admin collection: renderer-options dropdown `value: 'pdf'` label changed from "PDF (worksheet view)" → "Scroll view". DB value `pdf` kept unchanged (no migration risk).

### Visual redesign (BlocksDocumentLessonView)
- Removed `<table>` structure, header strip with `—`, footer strip with `· · ·`, gradient gutter.
- Clean card: `rounded-xl border border-border bg-card shadow-elevation-1`.
- Title aligned RTL for Hebrew (`text-right`) / LTR for English (`text-left`) via `dir={dir}`.
- `SolutionsSection` receives `dir` prop for correct list alignment.

### Diagram cards (LatexDocumentViewer)
- `DiagramRenderer` output wrapped in `<div className="my-6 rounded-xl border bg-card p-4">`.
- Title alignment: `dir === 'rtl' ? 'text-right' : 'text-left'` instead of `text-center`.

### Reproduction test
- `tests/unit/i18n/scroll-view-translations.test.ts` — 6 tests verifying `scrollView` key exists with correct values, `pdfView` is gone, `lessonViewModePdf` has new label.

## Key notes
- DB payload renderer value `pdf` unchanged — only human-facing labels changed.
- `ConsolidatedLatexLessonView` is dead code (never imported) — see followups.
- `PdfLessonPager` still handles legacy non-blocks path (PDF files attached to lessons) — outside this issue scope.
