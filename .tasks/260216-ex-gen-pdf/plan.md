# Plan: 260216-ex-gen-pdf (Rerun)

## Rerun Context

### What happened in previous run

The V2 PDF-to-exercises feature was fully implemented (commit `ddbbbec7`) and the canvas dependency was fixed (commit `7db6a6e1`). However, runtime testing revealed TWO issues:

1. **Buffer rejection by pdfjs-dist** — Every page failed with: `"Please provide binary data as Uint8Array, rather than Buffer"`. Root cause: `pdfjs-dist` v4.x explicitly checks `instanceof Buffer` and rejects it. The `getDocument()` call was passing a raw Node.js `Buffer` instead of `new Uint8Array(pdfBuffer)`.
2. **V2 errors not visible in conversion panel** — The V2StatusPanel only showed an error count badge but no error details (page index + reason), making it impossible for users to see what went wrong.

### What was already fixed (commit `9cf2c227`)

Both issues were fixed in commit `9cf2c227`:

- `vision-detection-service.ts:109`: Changed `data: pdfBuffer` → `data: new Uint8Array(pdfBuffer)`
- `V2StatusPanel/index.tsx:265-281`: Added error detail rendering with page index and reason per error

### What the build agent should do now

The fixes are already committed. The build agent should:

1. **Verify the fixes compile** — Run `tsc --noEmit` and `pnpm lint`
2. **Do NOT modify the existing fix code** — The changes are correct
3. **Confirm no regressions** — Ensure the full feature still passes type checking

---

## Step 0: Verify Existing Fixes Compile (5 min)

**Purpose**: Confirm that commit `9cf2c227` (the fix) passes all quality gates without any additional changes needed.

**Files to verify (READ ONLY, do not modify)**:

- `src/server/services/exercise-conversion/v2/vision-detection-service.ts:109` — MODIFIED — Confirm `new Uint8Array(pdfBuffer)` is present
- `src/ui/admin/exercise-conversion/V2StatusPanel/index.tsx:265-281` — MODIFIED — Confirm error detail rendering block is present

**Actions**:

1. Run `pnpm -s tsc --noEmit` — must pass (pre-existing test file type errors are acceptable)
2. Run `pnpm -s lint` — must pass (warnings acceptable, no errors)

**Test gate**:

- TypeScript compilation succeeds
- ESLint passes with no errors

**Acceptance criteria**:

- [ ] `tsc --noEmit` exits 0 (or only has pre-existing test file type errors)
- [ ] `pnpm lint` exits 0 (warnings OK)

**Spec refs**: FR-005 (cropping pipeline), FR-003 (status display), FR-010 (guardrails error logging)

---

## Step 1: Verify V2 Vision Detection Fix (10 min)

**Purpose**: Confirm the pdfjs-dist Buffer→Uint8Array fix resolves the "Please provide binary data" error.

**Files**:

- `src/server/services/exercise-conversion/v2/vision-detection-service.ts:106-112` — READ ONLY

**Exact behavior verified**:

- `renderPdfPageToImage()` wraps `pdfBuffer` in `new Uint8Array()` before passing to `pdfjsLib.getDocument()`
- `pdfjs-dist` v4.x `getDataProp()` validator accepts `Uint8Array` instances
- The function returns `{ pageImageBuffer: Buffer, pageWidth, pageHeight }` correctly
- The `pageImageBuffer` is then passed to `detectBboxesWithVision()` which converts to base64 string — this path is unaffected

**Integration test** (manual verification via admin panel):

1. Navigate to a Lesson with an uploaded PDF
2. Click "Convert (V2 Images)"
3. Job should progress past page rendering without "Please provide binary data" errors
4. Job status should show `pagesProcessed > 0`

**Acceptance criteria**:

- [ ] `vision-detection-service.ts:109` reads `data: new Uint8Array(pdfBuffer)`
- [ ] No other code changes needed in this file

**Spec refs**: FR-005 (cropping pipeline integration)

---

## Step 2: Verify V2StatusPanel Error Display Fix (10 min)

**Purpose**: Confirm the error detail rendering shows per-page error information in the admin panel.

**Files**:

- `src/ui/admin/exercise-conversion/V2StatusPanel/index.tsx:265-281` — READ ONLY

**Exact behavior verified**:

- When `status.output?.errors` has entries, a styled error detail section renders
- Each error shows: `❌ Page {error.pageIndex + 1}: {error.reason}`
- Error section has `backgroundColor: 'var(--theme-error-100)'` and `color: 'var(--theme-error)'`
- Error count badge (lines 255-259) still shows total count
- Warning display (lines 284-300) for zero-segment case still works

**Data flow verification**:

- V2 task handler stores errors in `output.errors[]` → `updateJobStatus()` writes to `jobOutput` field
- `JobService.findByContext()` maps `(doc).jobOutput || (doc).output` → `output` property
- Status API returns `output.errors[]` array to the panel
- V2StatusPanel reads `status.output.errors` and renders each entry

**Integration test** (manual verification):

1. Trigger a V2 conversion on a lesson with a PDF
2. If any page fails, errors should display with page number and reason text
3. If all pages succeed, no error section should appear

**Acceptance criteria**:

- [ ] Error details render with page index (1-based) and reason string
- [ ] Error section only appears when `errors.length > 0`
- [ ] Warnings section still renders for zero-segment completions (FR-011)

**Spec refs**: FR-003 (status + progress display), FR-010 (guardrails error logging), FR-011 (zero-segment warnings)

---

## Step 3: End-to-End Verification Checklist (15 min)

**Purpose**: Confirm the complete V2 feature works against all spec acceptance criteria after the fixes.

**No code changes expected** — this is a verification-only step.

**Acceptance criteria from spec (all must hold)**:

- [ ] `Convert (V1)` and `Convert (V2 Images)` appear side-by-side when a PDF is present (FR-001)
- [ ] Clicking `Convert (V2 Images)` creates a job with `pipelineVersion=2`, `conversionMode=v2_crops`, correct `lessonId`, `pdfDocumentId`, `tenantId="AGuy"` (FR-002)
- [ ] Panel shows V2 job status (`queued|running|completed|failed`) and progress (pages processed, exercises created, errors) (FR-003)
- [ ] V2 runner claims queued V2 jobs and updates progress during execution (FR-004)
- [ ] For each valid crop segment, exactly one Exercise is created with `tenant="AGuy"` and a rich_text block containing the attached crop image (FR-006)
- [ ] Cropped PNGs are stored as Payload Media assets (FR-008)
- [ ] Each Exercise includes traceability metadata: `sourcePdfDocumentId`, `sourcePageIndex`, `sourceBboxNormalized`, `pipelineVersion=2`, `jobId` (FR-009)
- [ ] Failed/rejected segments do not create Exercises and are logged on the job (FR-010)
- [ ] Zero valid segments → job ends `completed` with `warnings[]` (FR-011)
- [ ] V1 conversion behavior is unchanged

---

## Summary for Build Agent

**This is a verification-only rerun.** Both issues from the rerun feedback have already been fixed in commit `9cf2c227`. The build agent should:

1. **Run quality gates** (`tsc --noEmit`, `pnpm lint`) to confirm the fixes compile cleanly
2. **Do NOT modify any files** unless quality gates fail
3. **Report verification results** for each step above

If quality gates fail with NEW errors (not pre-existing), investigate and fix only those specific issues. Do not refactor or restructure existing code.
