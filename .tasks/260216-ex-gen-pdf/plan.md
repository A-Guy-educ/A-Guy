# Plan: 260216-ex-gen-pdf (Rerun)

## Rerun Context

**Previous run** completed the initial V2 pipeline implementation (vision-detection-service, image-crop-service, V2 runner, UI panel). The `canvas` → `@napi-rs/canvas` migration was done.

**Rerun feedback** reports two issues:

1. **Primary bug**: All 7 PDF pages fail with `"Please provide binary data as <Uint8Array>, rather than <Buffer>"`. Root cause: `pdfjs-dist` v4.x explicitly rejects Node.js `Buffer` instances in `getDocument({ data })`. The fix is a one-line change: wrap `pdfBuffer` in `new Uint8Array(...)`.
2. **Secondary UX issue**: Conversion errors are not visible in the V2 status panel. The panel shows error _count_ but never renders the individual error _messages_ (the `reason` field from each error object). Users cannot see what went wrong.

**Plan approach**: Keep the existing plan/architecture intact. Add fix guidance for both issues as two small, targeted steps.

---

## Step 1: Fix pdfjs-dist Buffer rejection in vision-detection-service

**~10 minutes**

### Files to touch

| File                                                                     | Lines | Action   |
| ------------------------------------------------------------------------ | ----- | -------- |
| `src/server/services/exercise-conversion/v2/vision-detection-service.ts` | 108   | MODIFIED |

### Exact behavior

- **Current (broken)**: Line 108 passes `data: pdfBuffer` (a Node.js `Buffer`) to `pdfjsLib.getDocument()`. pdfjs-dist v4.x has an explicit guard in `getDataProp()` that throws: `"Please provide binary data as Uint8Array, rather than Buffer"`.
- **Fix**: Change line 108 from `data: pdfBuffer` to `data: new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength)`.
- **Why full Uint8Array constructor**: `new Uint8Array(pdfBuffer)` works for most cases, but if the Buffer's underlying ArrayBuffer is larger than the view (common with pooled Buffers), you'd get extra bytes. The 3-arg form is safest. However, `new Uint8Array(pdfBuffer)` also works here because it copies, which is also safe. Either form is acceptable; prefer `new Uint8Array(pdfBuffer)` for simplicity.
- **Precedent**: `src/server/utils/pdf-metadata.ts` line 20 does the same conversion: `new Uint8Array(pdfBuffer)` before passing to `pdf-lib`.

### Spec requirements addressed

- **FR-005**: Cropping Pipeline Integration — the pipeline currently cannot render any pages
- **FR-004**: V2 Runner Execution Model — runner must successfully process pages
- **FR-006**: Exercise Creation from Cropped Segments — blocked by this bug

### Tests (integration)

**Test 1: renderPdfPageToImage returns valid PNG buffer**

```
File: tests/int/v2-vision-detection.int.spec.ts (NEW or extend existing)
- Setup: Create a minimal 1-page PDF buffer (using pdf-lib to generate a test PDF in memory)
- Call: renderPdfPageToImage(pdfBuffer, 0)
- Assert: Returns { pageImageBuffer, pageWidth, pageHeight }
  - pageImageBuffer is a Buffer
  - pageImageBuffer starts with PNG magic bytes (0x89504E47)
  - pageWidth > 0, pageHeight > 0
- FAILS BEFORE fix (throws "Please provide binary data as <Uint8Array>")
- PASSES AFTER fix
```

**Test 2: detectExerciseBboxes does not throw Buffer rejection error**

```
File: tests/int/v2-vision-detection.int.spec.ts
- Setup: Create a minimal PDF buffer, mock the LLM provider to return a dummy bbox response
- Call: detectExerciseBboxes(pdfBuffer, 0, mockPayload)
- Assert: Does NOT throw "Please provide binary data"
  - Returns an array (possibly empty if mock returns no bboxes)
- FAILS BEFORE fix (throws Buffer rejection)
- PASSES AFTER fix
```

### Acceptance criteria

- [ ] `renderPdfPageToImage` successfully renders any valid PDF page without throwing
- [ ] `pdfBuffer` is converted to `Uint8Array` before being passed to `pdfjsLib.getDocument()`
- [ ] V2 conversion no longer fails with "Please provide binary data" errors on any page
- [ ] No changes to the function signature or return type

---

## Step 2: Display error details in V2StatusPanel

**~15 minutes**

### Files to touch

| File                                                       | Lines   | Action   |
| ---------------------------------------------------------- | ------- | -------- |
| `src/ui/admin/exercise-conversion/V2StatusPanel/index.tsx` | 255-260 | MODIFIED |

### Exact behavior

- **Current (broken UX)**: Lines 255-259 show `Errors: {count}` but never render the individual error messages. The `status.output.errors` array contains objects with `{ pageIndex, bbox?, reason }` (per `PdfToExercisesV2Output` type in `src/server/payload/jobs/types.ts` lines 88-92), but `reason` is never displayed.
- **Fix**: After the error count display (line 259), add an expandable/collapsible error detail section that renders each error's `reason` and `pageIndex`. Minimal implementation: render errors in a styled list below the count, similar to how warnings are rendered at lines 265-280.
- **Implementation pattern** (follow warnings pattern at lines 265-280):
  ```tsx
  {
    status.output.errors && status.output.errors.length > 0 && (
      <div
        style={{
          marginTop: 8,
          padding: 6,
          backgroundColor: 'var(--theme-error-100)',
          borderRadius: 3,
          fontSize: 10,
          color: 'var(--theme-error)',
        }}
      >
        {status.output.errors.map((error, i) => (
          <div key={i}>
            ❌ Page {error.pageIndex + 1}: {error.reason}
          </div>
        ))}
      </div>
    )
  }
  ```
- Keep the existing error count display; add the detail section below it.

### Spec requirements addressed

- **FR-003**: V2 Status + Progress Display — "Progress must include: ... error counts (and/or a list of errors)"
- **FR-010**: Guardrails for Failed/Rejected Segments — errors must be visible for admin review
- **NFR-003**: Observability — "enough structured logs/errors to debug failures by segment (page index + bbox + reason)"

### Tests (integration or visual inspection)

**Test 1: V2StatusPanel renders error reasons**

```
File: tests/unit/V2StatusPanel.test.tsx (NEW or extend existing)
- Setup: Render V2StatusPanel with mock status containing errors:
  {
    status: 'completed',
    output: {
      pagesTotal: 3, pagesProcessed: 3, exercisesCreated: 0,
      errors: [
        { pageIndex: 0, reason: 'Model returned no bboxes' },
        { pageIndex: 2, reason: 'Image crop below minimum size' }
      ],
      warnings: []
    }
  }
- Assert:
  - "Errors" label and count "2" are rendered
  - "Page 1: Model returned no bboxes" text is visible in the document
  - "Page 3: Image crop below minimum size" text is visible in the document
- FAILS BEFORE fix (error reasons not rendered)
- PASSES AFTER fix
```

**Test 2: V2StatusPanel renders no error section when errors array is empty**

```
File: tests/unit/V2StatusPanel.test.tsx
- Setup: Render V2StatusPanel with mock status containing no errors:
  { status: 'completed', output: { pagesTotal: 3, pagesProcessed: 3, exercisesCreated: 5, errors: [], warnings: [] } }
- Assert: No error detail section rendered, no "❌" characters in document
- PASSES before and after fix (regression guard)
```

### Acceptance criteria

- [ ] Each error in `status.output.errors[]` has its `reason` and `pageIndex` displayed in the panel
- [ ] Error details are styled distinctly (red/error theme, similar to warnings pattern)
- [ ] When errors array is empty, no error detail section is shown
- [ ] Error count display is preserved (not replaced)
- [ ] Existing warning display is unchanged

---

## Step 3: Manual verification (build agent checklist)

**~10 minutes**

### Verification commands

```bash
# 1. TypeScript compilation
pnpm tsc --noEmit

# 2. Lint
pnpm lint

# 3. Run any existing V2 tests
pnpm test -- --grep "v2" --passWithNoTests

# 4. Generate import map (if component paths changed)
pnpm generate:importmap
```

### Acceptance criteria (overall task — maps to spec)

- [ ] `Convert (V1)` and `Convert (V2 Images)` appear side-by-side when a PDF is present (FR-001) — **already done, unchanged**
- [ ] Clicking `Convert (V2 Images)` creates a job with correct fields (FR-002) — **already done, unchanged**
- [ ] Panel shows V2 job status and progress including error details (FR-003) — **Step 2 fixes**
- [ ] V2 runner successfully processes PDF pages without Buffer errors (FR-004, FR-005) — **Step 1 fixes**
- [ ] Exercises are created for valid crop segments (FR-006) — **unblocked by Step 1**
- [ ] Cropped PNGs stored as Media assets (FR-008) — **unblocked by Step 1**
- [ ] Traceability metadata on exercises (FR-009) — **already implemented, unblocked by Step 1**
- [ ] Failed segments logged with pageIndex + bbox + reason (FR-010) — **already implemented, visible via Step 2**
- [ ] Zero-segment completion includes warnings (FR-011) — **already implemented**
- [ ] V1 behavior unchanged — **no V1 files modified**

---

## Assumptions

1. `renderPdfPageToImage` is not exported (it's a module-private function). For testing, either export it or test indirectly via `detectExerciseBboxes`. The build agent should prefer the indirect integration test approach.
2. The V2StatusPanel is a client component (`'use client'`). Unit tests should use `@testing-library/react` if available; otherwise visual verification via the browser is acceptable.
3. No other callers of `pdfjsLib.getDocument` exist in the codebase beyond this one location.
4. The `@napi-rs/canvas` encode behavior is correct and does not need changes.
