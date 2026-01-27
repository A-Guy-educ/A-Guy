# HLS — PDF → Exercises Conversion (Async, Two-Pass, Verifier, Manual Resume)

## 1. Goal
Enable an admin to convert a specific **PDF Media** attached to a **Lesson** into a set of **draft Exercises**.
The conversion runs asynchronously, is observable via a Job record, and supports **manual resume** without creating duplicate exercises.

## 2. Scope (v1)
- One conversion **Job per PDF Media** (per Lesson).
- Admin UI: per-PDF **Convert** action (and Resume / View Job).
- Two-pass AI pipeline:
  - **Pass 1 (Indexing):** build stable segments (max 2 pages each).
  - **Pass 2 (Extraction + Verifier):** extract exercises per segment; verifier blocks invalid output.
- Persist Exercises using the **existing Exercise schema**, with:
  - `status = draft` (never published automatically).
- Stable ordering of created exercises.
- Dedupe / idempotency to support safe resume.
- Admin-only access.

## 3. Non-Goals (v1)
- Diagram understanding or geometry extraction
- Auto-fixing invalid model output
- Auto-publish
- Background workers / queues
- Cross-lesson deduplication

## 4. Locked Decisions
- Input: **PDF only**
- Segmentation: **max 2 pages per segment**
- Pipeline: **Two-pass**
- Validation: **minimal schema + verifier model call**
- Verifier invalid: **do not save**
- Failure policy: **any failed segment → Job failed**
- Resume: **manual**
- Ordering: **page + orderWithinSegment**
- Exercise content: **existing blocks[] + new latex block**
- Exercise status: **use existing `status: draft | published`**

## 5. Data Model

### 5.1 Jobs (new collection, generic)
Purpose: track async process state and failures.

Fields:
- `jobType`: enum (includes `pdf_to_exercises`)
- `status`: `queued | running | failed | completed`
- `lesson`: relationship
- `sourceDoc`: relationship to Media (PDF)
- `jobRunId`: string (uuid)
- `progress`:
  - `segmentsTotal`
  - `segmentsDone`
  - `segmentsFailed`
  - `currentSegmentIndex`
- `counts`:
  - `exercisesCreated`
  - `exercisesDeduped` (optional)
- `errors[]` (bounded):
  - `{ stage, segmentId, pageStart, pageEnd, code, message }`
- `meta`:
  - `segments[]`
  - `promptVersion`
- `startedAt`, `endedAt`

Access:
- Admin-only read/write.

### 5.2 Exercise (existing collection — clarified usage)

**No new draft mechanism is added.**
Exercises already support `status: draft | published`.

Conversion behavior:
- Every created Exercise:
  - `status = draft`
  - never auto-published

Additions:
- **New block type** in `blocks[]`:
  - `blockType: latex`
    - `latex: string`
    - `renderMode?: block | inline`

Add conversion metadata fields:
- `origin = "conversion"`
- `sourceDoc` (Media relationship)
- `sourcePageStart`
- `sourcePageEnd`
- `sourceOrderInSegment`
- `conversionJob` (Job relationship)
- `contentHash`

## 6. Segment Definition (Pass 1 Output)

Segment schema:
- `segmentId` (stable, e.g. `p05-p06#02`)
- `pageStart`
- `pageEnd` (max 2 pages)
- `orderKey`
- `confidence?`
- `markers?`

Rules:
- Segments cover pages contiguously.
- No segment exceeds 2 pages.

## 7. Pipeline

### 7.1 Trigger (Admin)
- Lesson admin → each PDF Media row:
  - **Convert** → creates Job, starts async run
  - **Resume** → visible if last Job for same PDF failed
  - **View Job** → opens Job record

### 7.2 Pass 0 — PDF Text Extraction
- Server-side extraction using `pdfjs-dist`
- Output: `pages[] = { pageNumber, text }`
- Text kept in-memory for run only (not persisted).

### 7.3 Pass 1 — Segment Indexing
- Input: `pages[]`
- Output: `segments[]`
- Persist to `Job.meta.segments`
- Initialize:
  - `segmentsTotal`
  - `currentSegmentIndex = 0`

### 7.4 Pass 2 — Extraction + Verifier + Persist
For each segment (from `currentSegmentIndex`):

1. Build segment text from pageStart..pageEnd
2. Call Extractor model → `draftExercises[]`
3. Call Verifier model → `{ valid, issues[] }`

**If `valid=false`:**
- Do not persist anything
- Record error with `stage = VERIFY`
- Increment `segmentsFailed`
- Stop run → Job status = `failed`

**If `valid=true`:**
- For each exercise:
  - Compute `contentHash`
  - If duplicate (see §8) → skip
  - Else persist Exercise:
    - blocks include `latex`
    - status = `draft`
    - attach conversion metadata
- Increment `segmentsDone`

### 7.5 Completion
- If all segments processed with zero failures → `completed`
- Any failure → `failed`

## 8. Dedupe / Idempotency

Purpose: safe resume and reruns.

- Compute `contentHash` from normalized LaTeX
- Uniqueness key:
  - `(lessonId, sourceDocId, contentHash)`
- If exists:
  - skip creation
  - increment `exercisesDeduped`

## 9. Observability
- Job record shows:
  - stage, segment, page range, error code/message
- Runtime logs:
  - include `jobRunId` for correlation

## 10. Security
- Convert / Resume endpoints:
  - Admin-only via existing access helpers

## 11. Tests (single task, extensive)

### Unit
- Segment constraints (max 2 pages, contiguous)
- Stable `segmentId`
- Stable `contentHash`
- Dedupe logic

### Integration
- Convert creates Job
- Pass 1 writes segments
- Verifier invalid → nothing persisted
- Partial success then failure → job failed, drafts remain
- Resume continues correctly
- Ordering by `(sourcePageStart, sourceOrderInSegment)`

### Failure Observability
- Forced extractor error → Job error with `stage=EXTRACT`
- Forced persist error → `stage=PERSIST`

