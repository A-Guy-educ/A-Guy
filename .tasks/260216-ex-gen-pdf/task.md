# Task

Addendum: V2 Lesson Conversion UX + Payload Integration

Goal

Expose V2 conversion in the Lesson “Exercise Conversion” panel as an additional action next to the existing Convert (V1) button. V2 uses the same job orchestration concept as V1, but executes the Vision + PDF.js cropping pipeline.

UI Requirements

Lesson Conversion Panel

When a PDF is uploaded to a Lesson:

Show existing button: Convert (V1)

Add new button: Convert (V2 Images)

Buttons are displayed side-by-side.

V2 button triggers a new job flow (see below).

Panel shows V2 job status:

queued | running | completed | failed

progress (pages processed, exercises created, errors)

V2 Job Trigger Contract

Trigger Action

User clicks Convert (V2 Images).

System creates a new job record:

pipelineVersion = 2

conversionMode = v2_crops

lessonId, pdfDocumentId, tenantId = "AGuy"

Output Mapping to Existing Domain Model

Exercise Creation Rules (V2)

For every cropped exercise image segment produced by V2:

Create a new Exercise under the current Lesson.

Assign:

lesson = current lesson

tenant = AGuy (selected explicitly, not inferred)

title = auto-generated (see Title Rules)

Insert exercise content as blocks:

Add a rich_text block

Attach the generated image as an attached image to that rich_text block (the block remains mostly empty text-wise; the image is the source-of-truth)

Note: Each image segment = one Exercise (no stitching, no multi-page merge).

Title Rules

Default: Exercise {N} where N is the next sequential number within the lesson for this conversion run.

Optional (if available from model): if the model returns a detected exercise number/label, use:
Exercise {label}

Must be deterministic within a single run.

Storage & Attachment Requirements

Each cropped PNG is persisted as a standard Payload-uploaded media asset.

The created Exercise references the media asset via the rich_text block attachment mechanism.

Store traceability metadata on the Exercise (or in a dedicated internal field):

sourcePdfDocumentId

sourcePageIndex

sourceBboxNormalized (0..1)

pipelineVersion = 2

jobId

V2 Job Flow Alignment with V1

V2 must reuse the same operational patterns as V1:

job creation → queued → runner claims → progress updates → completion

retry behavior consistent with existing runner conventions

logs/errors stored on the job for admin review

Guardrails Specific to UI + Data

If an image crop fails or is rejected by guardrails:

Do not create an Exercise

Log failure under the job with pageIndex + bbox + reason

If V2 produces zero valid segments:

job completes with completed but includes warnings[] explaining why (e.g., model returned no bboxes)

Out of Scope

Replacing V1

Automatic exercise boundary detection without model

Stitching multi-page exercises into one image

OCR / text extraction
