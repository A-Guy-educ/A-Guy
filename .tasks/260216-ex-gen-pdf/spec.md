# Spec: 260216-ex-gen-pdf

## Overview

Add a V2 PDF-to-exercises conversion action to the Lesson admin "Exercise Conversion" panel. V2 reuses the existing job orchestration model (create job -> queued -> runner claims -> progress -> complete/fail) but executes the Vision + PDF.js cropping pipeline and creates one Exercise per valid cropped image segment.

## Requirements

### FR-001: Lesson Conversion Panel - V2 Action

**Priority**: MUST
**Description**: When a PDF is uploaded to a Lesson, the admin "Exercise Conversion" panel must show two side-by-side actions: existing `Convert (V1)` and new `Convert (V2 Images)`.

### FR-002: V2 Job Trigger

**Priority**: MUST
**Description**: Clicking `Convert (V2 Images)` must create a new conversion job record with:

- `pipelineVersion = 2`
- `conversionMode = v2_crops`
- `lessonId = <current lesson id>`
- `pdfDocumentId = <lesson's uploaded PDF document id>`
- `tenantId = "AGuy"` (explicitly set, not inferred)

### FR-003: V2 Status + Progress Display

**Priority**: MUST
**Description**: The Lesson conversion panel must display the V2 job status and progress for the most relevant V2 job for the lesson.

- Status enum: `queued | running | completed | failed`
- Progress must include: pages processed, exercises created, and error counts (and/or a list of errors)

### FR-004: V2 Runner Execution Model

**Priority**: MUST
**Description**: V2 conversion must execute via the same operational patterns as V1:

- job creation -> queued -> runner claims -> progress updates -> completion
- retry behavior consistent with existing runner conventions
- logs/errors persisted on the job for admin review

### FR-005: Cropping Pipeline Integration

**Priority**: MUST
**Description**: The V2 runner must invoke the existing Vision + PDF.js cropping pipeline to produce cropped exercise image segments, including source `pageIndex` and normalized bounding boxes (0..1) per segment.

### FR-006: Exercise Creation from Cropped Segments

**Priority**: MUST
**Description**: For each valid cropped image segment produced by V2, create exactly one Exercise under the current Lesson.

- Each segment -> one Exercise (no stitching, no multi-page merge)
- Exercise fields:
  - `lesson = current lesson`
  - `tenant = "AGuy"` (explicit)
  - `title` set per FR-007
  - `content` (or equivalent) includes a `rich_text` block with the segment image attached via the existing rich_text attachment mechanism; text content may be empty/minimal (image is source-of-truth)

### FR-007: Title Rules (Deterministic)

**Priority**: MUST
**Description**: Titles must be deterministic within a single V2 run.

- Default: `Exercise {N}` where `N` is the next sequential number within the lesson for this conversion run
- Optional: if the model provides a detected exercise number/label for a segment, use `Exercise {label}`

### FR-008: Media Storage of Cropped PNGs

**Priority**: MUST
**Description**: Each cropped PNG must be persisted as a standard Payload-uploaded Media asset, and the created Exercise must reference that Media asset through the rich_text block attachment mechanism.

### FR-009: Traceability Metadata

**Priority**: MUST
**Description**: Store traceability metadata per created Exercise (either on the Exercise itself or in a dedicated internal field), at minimum:

- `sourcePdfDocumentId`
- `sourcePageIndex`
- `sourceBboxNormalized` (0..1)
- `pipelineVersion = 2`
- `jobId`

### FR-010: Guardrails for Failed/Rejected Segments

**Priority**: MUST
**Description**: If an image crop fails or is rejected by guardrails:

- Do not create an Exercise for that segment
- Persist a job log/error record containing `pageIndex`, `bbox`, and the failure reason

### FR-011: Zero-Segment Completion Behavior

**Priority**: MUST
**Description**: If V2 produces zero valid segments, the job must complete with status `completed` and include `warnings[]` explaining why (e.g., "model returned no bboxes").

### NFR-001: Consistent Job Semantics

**Priority**: MUST
**Description**: V2 must not introduce a new orchestration paradigm; it must align with the existing V1 job lifecycle semantics, state transitions, and persistence patterns.

### NFR-002: Tenant Explicitness

**Priority**: MUST
**Description**: V2 must explicitly set `tenantId/tenant` to `"AGuy"` for both jobs and created Exercises; do not rely on inference from request context.

### NFR-003: Observability

**Priority**: SHOULD
**Description**: Job records should contain enough structured logs/errors to debug failures by segment (page index + bbox + reason) and understand progress over time.

## Acceptance Criteria

- [ ] In the Lesson admin "Exercise Conversion" panel, `Convert (V1)` and `Convert (V2 Images)` appear side-by-side when a PDF is present.
- [ ] Clicking `Convert (V2 Images)` creates a job with `pipelineVersion=2`, `conversionMode=v2_crops`, correct `lessonId`, `pdfDocumentId`, and `tenantId="AGuy"`.
- [ ] The panel shows V2 job status (`queued|running|completed|failed`) and progress (pages processed, exercises created, errors).
- [ ] The V2 runner claims queued V2 jobs and updates progress during execution.
- [ ] For each valid crop segment, exactly one Exercise is created under the lesson, with `tenant="AGuy"` and a rich_text block containing the attached crop image.
- [ ] Cropped PNGs are stored as Payload Media assets and referenced from Exercises via the existing attachment mechanism.
- [ ] Each created Exercise includes traceability metadata: `sourcePdfDocumentId`, `sourcePageIndex`, `sourceBboxNormalized`, `pipelineVersion=2`, `jobId`.
- [ ] Failed/rejected segments do not create Exercises and are logged on the job with pageIndex + bbox + reason.
- [ ] If zero valid segments are produced, the job ends `completed` and includes `warnings[]` describing why.
- [ ] V1 conversion behavior is unchanged.

## Guardrails

- Do not replace or remove V1 conversion.
- Do not change existing V1 job lifecycle semantics; reuse existing job collection/runner conventions.
- Do not create stitched or multi-page Exercises; one crop segment must map to one Exercise.
- Do not add OCR/text extraction as part of V2.
- Do not implement automatic exercise boundary detection without the model.

## Out of Scope

- Replacing or deprecating V1 conversion.
- Boundary detection without the model.
- Stitching multi-page exercises into a single image/exercise.
- OCR / text extraction.
