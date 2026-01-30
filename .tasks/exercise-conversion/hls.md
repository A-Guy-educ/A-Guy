# HLS — PDF → Exercises Conversion (Admin UI + Tenant Prompts + Multimodal Attachments + Draft Review)

**Version:** v1.0 (Unified, updated to LLP v4.4 + product/UI requirements)
**Date:** 2026-01-29
**Status:** Ready for implementation

---

## 1. Goal

Enable an admin to convert a specific **PDF Media attached to a Lesson** into a set of **draft Exercises** that require manual approval.
Conversion runs asynchronously via **Payload Jobs** and is executed by a **GitHub Actions runner** calling a secured server endpoint.

Key upgrades in this HLS:

- Model call uses **multimodal media attachments** (same pipeline as Chat Media Upload).
- Admin selects **real extractorPromptId + verifierPromptId** from the `prompts` collection.
- Prompts and conversions are **tenant-scoped**.
- Exercises persist output into a **new Latex block** + conversion metadata, always `status=draft`.

---

## 2. Scope (v1)

### Included

- Admin UI: Convert action **per PDF** on Lesson edit screen (media row action).
- Modal to select:
  - extractorPromptId (published, tenant-scoped)
  - verifierPromptId (published, tenant-scoped)
  - maxSegmentPages (default 2, locked upper bound)
- Queue endpoint: validates auth + tenant + queue policy, then queues Payload Job.
- Runner endpoint: claims exactly 1 job atomically, runs it, heartbeat lock.
- Job task: Pass0 extract → Pass1 segment → Pass2 extract+verify+persist.
- Exercise creation:
  - `status=draft`
  - `origin='conversion'`
  - dedupe/idempotency
  - stable ordering metadata
  - **Latex block** (new)
- Review UI: Show created draft exercises and approve/publish manually (existing status mechanism).

### Out of Scope (v1)

- Auto-publish
- Auto-correcting invalid model output
- Cross-lesson dedupe
- Geometry/diagram understanding
- Non-PDF sources

---

## 3. Locked Decisions

- Storage: local filesystem (v1)
- Segmentation: max 2 pages/segment
- Pipeline: Two-pass + verifier (invalid => fail job, persist nothing for that segment)
- Runner: GitHub Actions runs 1 job per run (cron every 5 min)
- Exercises: created as draft, require approval
- Dedupe key: (lessonId, sourceDocId, contentHash)
- Prompt immutability: store promptSnapshot + hashes in job input at queue time

---

## 4. User Experience (End-to-End Flow)

### 4.1 Lesson Edit Screen (Admin)

1. Admin opens Lesson edit screen.
2. In Lesson Media section, each PDF row shows action: **Convert → Exercises**.
3. Admin clicks Convert.

### 4.2 Convert Modal

Admin selects:

- Extractor Prompt (dropdown)
- Verifier Prompt (dropdown)
- (Optional) maxSegmentPages shown but locked to 2 unless you decide otherwise

Buttons:

- **Queue Conversion**
- Cancel

### 4.3 Post-Queue Status

Lesson screen displays a “Conversion Status” panel:

- Latest job status for this (lessonId, sourceDocId)
- progress summary (segmentsDone/Total, created/deduped)
- error summary if failed
- actions:
  - View Job (Payload job doc)
  - Resume (queues a new job using same PDF + prompt selection)

### 4.4 Review & Approve

After completion:

- Show list of newly created draft exercises for this PDF
- Admin reviews and sets `status=published` (existing workflow)

---

## 5. Data Model Changes

### 5.1 Prompts (CRITICAL: tenant scoping)

Add fields to `prompts`:

- `tenant: relationship -> tenants` (required)
- indexes:
  - `{ tenant: 1, status: 1, updatedAt: -1 }`
  - keep existing unique `key`

Runtime rule:

- Only `published` prompts are selectable/usable.
- Prompt selection UI filters by `tenant` derived from the Lesson’s course tenant.

### 5.2 Exercises (Latex block + conversion metadata)

Add a **new block type** to exercise content blocks:

- `blockType: 'latex'`
  - `latex: string` (required)
  - `renderMode: 'block' | 'inline'` (optional, default 'block')

Add conversion metadata fields (if not already present):

- `origin: 'conversion' | ...`
- `tenant: relationship -> tenants` (required for tenant scoping)
- `lesson: relationship -> lessons`
- `sourceDoc: relationship -> media` (PDF)
- `conversionJobId: string` (Payload job id string)
- `sourcePageStart: number`
- `sourcePageEnd: number`
- `sourceOrderInSegment: number`
- `contentHash: string` (sha256)

Indexes:

- Unique partial index for dedupe:
  - (lesson, sourceDoc, contentHash) unique where origin='conversion'

### 5.3 Payload Jobs (existing collection)

Use Payload’s built-in jobs collection for:

- input: ctx + promptRefs + promptSnapshot + hashes + maxSegmentPages
- output: progress + errors + counts + segments metadata

---

## 6. Prompt Selection Rules (Tenant + Published)

Prompt dropdown query:

- `tenant == lesson.course.tenant`
- `status == 'published'`
- (Optional UX) group/filter by `type` if you want (system/context)

Queue-time validation:

- Both prompts exist
- Both are `published`
- Both belong to the same tenant as the lesson/course tenant
- Store:
  - promptRefs: { extractorPromptId, verifierPromptId }
  - promptSnapshot: { extractor: template, verifier: template }
  - promptSnapshotHash: sha256(template)

---

## 7. Media Attachments to the Model (Using “Chat Media Upload” pipeline)

### 7.1 Required behavior

The conversion job must attach the PDF as a **multimodal media part**, not just plain text extraction.

### 7.2 Implementation approach (alignment with your system)

Reuse the same internal approach used in chat:

- Resolve media to local file path (`absoluteFilePath`) via the Media collection / upload directory resolver.
- Convert to model-specific parts (Gemini parts) using your existing multimodal mapper.
- Build model input:
  - Text prompt (extractor/verifier templates + any system framing)
  - Attached PDF part

Notes:

- Keep Pass0 text extraction if you still need it for segmentation; but the model call must include the PDF attachment.

---

## 8. Processing Pipeline

### Pass 0 — Load/Validate PDF

- Validate Media doc:
  - exists
  - mimeType=application/pdf
  - filesize <= 10MB
- Resolve file path and validate PDF magic bytes

### Pass 1 — Segment Indexing

- Extract text via pdfjs for segmentation only
- Build segments of max 2 pages
- Persist segments to job output/meta (for observability + resume)

### Pass 2 — Extract + Verify + Persist

For each segment:

1. Call Extractor (multimodal: prompt + PDF attachment + segment page range context)
2. Parse response to structured exercises (schema-validated)
3. Call Verifier (multimodal: prompt + PDF attachment + extracted JSON)
4. If invalid:
   - record error
   - fail job immediately
   - persist nothing for that segment
5. If valid:
   - compute contentHash per exercise
   - dedupe (lesson+sourceDoc+hash)
   - create Exercise as draft with latex block + metadata

Completion:

- All segments done with zero failures => job completed

---

## 9. API Surface

### 9.1 Queue Conversion

`POST /api/exercises/convert/queue`

- Auth: Admin session
- Test-only bypass: TEST_ADMIN_SECRET (only NODE_ENV=test)
- Body: { lessonId, mediaId, extractorPromptId, verifierPromptId }
- Validations:
  - admin
  - tenant matching
  - prompts published
  - queue policy: block if running lock valid
- Output: { jobId }

### 9.2 Runner

`POST /api/exercises/convert/runner`

- Auth: Bearer CRON_SECRET
- Behavior:
  - atomic claim one job (queued or stale running with expired lock)
  - heartbeat extends lock
  - payload.jobs.run({ jobId })
  - return processed true/false

### 9.3 Optional: Internal media proxy

Keep only if required by your runtime constraints.
If the job runs server-side and can read from filesystem safely, prefer direct local file path resolution for the model parts.

---

## 10. Tenant Rules (Hard Guardrails)

- Lesson → Course → Tenant is the source of truth.
- Prompts must match that tenant.
- Exercises created must be stamped with the same tenant.
- Admin UI prompt dropdown must be filtered by tenant.

---

## 11. Security

- Queue endpoint: admin-only (plus test bypass in tests)
- Runner endpoint: CRON_SECRET only
- Media access: server-side only; do not expose file paths
- Prompt fetch: admin-only collection; runtime prompt reads may use overrideAccess server-side if needed

---

## 12. Observability

- Job output includes:
  - segmentsTotal, segmentsDone, segmentsFailed
  - currentSegmentIndex
  - exercisesCreated, exercisesDeduped
  - errors[] with stage + page range + code + message
- Correlation:
  - log jobId + lessonId + sourceDocId

---

## 13. Tests

### Integration (must-have)

- Queue requires admin / test secret
- Prompt tenant mismatch rejected
- Prompt not published rejected
- Queue policy returns 409 for running lock
- Runner processes exactly 1 job
- Stale reclaim works only with lockExpiresAt exists + expired
- Media attachment path resolution works (PDF part created)
- Verifier invalid => no exercises persisted for that segment; job fails
- Completed job => exercises created as draft with latex block
- Dedupe prevents duplicates on resume/rerun
- Indexes exist: claim + queue policy + dedupe

---

## 14. Rollout Plan (Safe)

- Behind admin-only UI action first
- Ship indexes + schema changes first (Prompts tenant, Exercises latex block)
- Enable queue+runner+job task
- Add UI status panel + approve flow

---

## 15. Acceptance Criteria

- Admin can select PDF in Lesson and queue conversion with real prompts.
- Job runs via GitHub Actions and attaches PDF as a multimodal part.
- Exercises created are draft, tenant-scoped, deduped, and include latex block.
- Admin can review and publish exercises manually.
- Errors are visible and stable via job output.

### Agent Note — Add Unit Tests (Required)

Add a **unit-test suite** (no DB/FS/network) covering the pure logic introduced by this feature:

- **Env parsing (`readIntEnv`)**
  - missing/empty → returns default
  - non-integer → throws
  - `< min` / `> max` → throws
  - valid value → returns parsed number

- **PDF validation helpers (extract pure functions from route/fetcher)**
  - `isPdfMime(mime)` accepts only `application/pdf`
  - `hasPdfMagicBytes(buf)` validates `%PDF`
  - `isPdfSizeAllowed(size, PDF_MAX_BYTES)` enforces limit
  - `PROXY_TO_STAGE` mapping: each proxy error code maps to the correct stage code

- **Deterministic hashing**
  - `canonicalStringify` is stable across key order
  - `normalizeForHash` collapses whitespace and preserves block order
  - swapped block order → different hash; identical normalized input → same hash
