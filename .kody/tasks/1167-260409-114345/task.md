# Implement iterative page-by-page PDF-to-LaTeX extraction

## Description

Refactor the "Convert Context" pipeline to process PDFs **one page at a time** instead of sending the entire PDF in a single LLM call. This improves extraction quality (the refined prompt works best on focused input) and eliminates truncation/retry issues on longer PDFs.

PDFs can be up to **60+ pages**. Sequential processing would be too slow, so pages should be processed with **controlled concurrency** (e.g., 3-5 pages in parallel).

The admin UI button, the prompt (stored in DB), and the `lessonContextText` storage all stay the same — only the backend orchestration changes.

## Acceptance Criteria

- [ ] PDF is split into individual single-page PDFs using `pdf-lib`
- [ ] Each page is sent to the LLM independently using the same prompt
- [ ] Pages are processed with controlled concurrency (not one at a time, not all at once)
- [ ] Results are stitched into one valid LaTeX document **in page order** and stored in `lessonContextText`
- [ ] If one page fails extraction, it is skipped with a warning — other pages still succeed
- [ ] Works for 1-page PDFs (no regression from current behavior)
- [ ] Works for large PDFs (up to 60+ pages)
- [ ] Codebase passes typecheck, lint, and existing tests

## Implementation Plan

### Step 1: Add `pdf-lib` dependency
```
pnpm add pdf-lib
```

### Step 2: Create page splitter utility
**New file:** `src/server/utils/pdf-page-splitter.ts`

```typescript
import { PDFDocument } from 'pdf-lib'

/**
 * Split a PDF buffer into an array of single-page PDF buffers.
 */
export async function splitPdfIntoPages(buffer: Buffer): Promise<Buffer[]> {
  const pdfDoc = await PDFDocument.load(buffer)
  const pageCount = pdfDoc.getPageCount()
  const pages: Buffer[] = []

  for (let i = 0; i < pageCount; i++) {
    const singlePageDoc = await PDFDocument.create()
    const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i])
    singlePageDoc.addPage(copiedPage)
    const pdfBytes = await singlePageDoc.save()
    pages.push(Buffer.from(pdfBytes))
  }

  return pages
}
```

### Step 3: Refactor `src/server/services/lesson-context-conversion/extract-context.ts`

**Keep unchanged:** Steps 1-6 (fetch lesson, validate tenant, fetch prompt, fetch media, build prompt)

**Replace Steps 7-8** with a page iteration loop with concurrency:

1. If the media is a PDF, split into pages using `splitPdfIntoPages()`
2. Create LLM adapter and model config once (outside the loop)
3. Process pages with controlled concurrency (max 3-5 parallel calls):
   ```typescript
   const CONCURRENCY = 3
   const results: Array<{ pageIndex: number; latex: string | null; warning?: string }> = []
   
   // Process in batches of CONCURRENCY
   for (let i = 0; i < pages.length; i += CONCURRENCY) {
     const batch = pages.slice(i, i + CONCURRENCY)
     const batchResults = await Promise.allSettled(
       batch.map((pageBuffer, batchIdx) => 
         extractSinglePage(adapter, modelConfig, fullPrompt, pageBuffer, i + batchIdx)
       )
     )
     // collect results in order...
   }
   ```
4. If ALL pages failed, return error
5. Stitch successful results together in page order (see stitching logic below)
6. Store in `lessonContextText` (existing Step 9-10)

**Remove these multi-question-specific blocks:**
- Step 8a: Exercise count validation + retry (lines 227-274)
- Step 8b: Solution-pass retries for truncation (lines 285-384)
- Step 8c: Solution verification LLM call (lines 386-431)

These are unnecessary with per-page extraction — single pages don't truncate and don't need exercise counting.

**For non-PDF media (images):** Keep the existing single-call behavior — no splitting needed.

### Step 4: Single page extraction helper

Extract a helper function for extracting one page:

```typescript
async function extractSinglePage(
  adapter: GenkitUnifiedAdapter,
  modelConfig: ModelConfig,
  prompt: string,
  pageBuffer: Buffer,
  pageIndex: number,
): Promise<{ pageIndex: number; latex: string; warnings: string[] }>
```

This function:
- Converts buffer to base64
- Calls LLM with prompt + single-page PDF attachment
- Validates with `validateExtractedLatex()`
- Returns validated/sanitized LaTeX text
- Throws on failure (caught by `Promise.allSettled` in the caller)

### Step 5: Stitching logic

When combining page results into one LaTeX document:
- Keep the preamble (`\documentclass` through `\begin{document}`) from the **first successful page's output only**
- From subsequent pages, strip: `\documentclass`, `\usepackage`, `\begin{document}`, `\end{document}`, and any outline comment blocks
- Join the exercise content from all pages in page order
- Ensure there's one `\end{document}` at the very end
- The result should be one valid, compilable LaTeX document

### Step 6: Update response with per-page info

Add per-page status to warnings array:
- `"Page 1/60: extracted successfully (2,450 chars)"`
- `"Page 3/60: extraction failed — AI returned empty response. Skipped."`
- `"Page 5/60: LaTeX validation warning — unbalanced braces"`
- Summary: `"Successfully extracted 57/60 pages. 3 pages skipped."`

## Files to Modify

| File | Action |
|------|--------|
| `package.json` | Add `pdf-lib` dependency |
| `src/server/utils/pdf-page-splitter.ts` | **NEW** — page splitting utility |
| `src/server/services/lesson-context-conversion/extract-context.ts` | Refactor: add page loop with concurrency, remove retry/solution/verification logic |

## Files NOT to Change

- `src/server/services/lesson-context-conversion/validate-latex.ts` — still used per page, no changes
- `src/ui/admin/exercise-conversion/ConvertContextButton/` — no UI changes
- `src/ui/admin/exercise-conversion/ConvertContextModal/` — no UI changes
- `src/app/api/lessons/convert-context/route.ts` — API signature unchanged
- Prompt in database — works as-is for single pages
- V1/V2/V3 exercise extraction pipelines — unrelated

## Error Handling

- Per-page failures are **non-fatal** — skip with warning, continue to next page
- If ALL pages fail → return `{ success: false, error: 'All pages failed extraction' }`
- Use `Promise.allSettled` so one page failure doesn't abort the batch
- Rate limiting: if Gemini rate-limits mid-loop, the adapter's built-in retry with exponential backoff handles it. The concurrency limit (3-5) also helps avoid rate limits.
- Timeout: keep existing per-call timeout from the adapter (30s default)

## Performance Considerations

- 60-page PDF with concurrency=3 → ~20 batches → ~10 minutes at 30s per call
- Consider making concurrency configurable or adaptive
- The `lessonContextText` field has a 100K char limit — 60 pages of LaTeX may approach this. Add a warning if the combined result exceeds 80K chars.
- Each page buffer is small (single-page PDF) — memory usage is fine even for 60 pages

## Testing / Verification

1. `pnpm typecheck` — no broken imports
2. `pnpm lint` — clean
3. Manual test: upload 1-page PDF → same behavior as before
4. Manual test: upload multi-page PDF → concurrent LLM calls, one stitched LaTeX result
5. Manual test: upload PDF with blank pages → blank pages skipped, others extracted
6. `pnpm test:int` — existing tests pass

---

## Discussion (2 comments)

**@yaeliavni** (2026-04-09):
@kody

**@aguyaharonyair** (2026-04-09):
🚀 Kody pipeline started: `1167-260409-114345` ([logs](https://github.com/A-Guy-educ/A-Guy/actions/runs/24188344437))

To rerun: `@kody rerun 1167-260409-114345 --from <stage>`

