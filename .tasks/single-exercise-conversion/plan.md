# PRD + Implementation Plan: Single Exercise Conversion (V3)

## Overview

A simplified conversion flow ("V3") that takes a single uploaded document (PDF page or image) assigned to a lesson and produces exactly **one** interactive exercise. This is a stripped-down fork of the existing V1 PDF-to-exercises pipeline, removing all multi-exercise logic (segmentation, deduplication, multi-page stitching) to create a clean, end-to-end POC.

## Motivation

The current V1 flow is designed for batch conversion of multi-page PDFs into many exercises. For the common case where an instructor has a single-exercise document, this is overkill. V3 provides a fast, simple path: **Upload → Extract → Preview → Create → Render**.

---

## How It Maps to Current Implementation

| Concern | V1 (Current) | V3 (New - What Changes) |
|---|---|---|
| **Input** | Multi-page PDF from lesson `contentFiles` | Same — single PDF/image from lesson `contentFiles` |
| **Prompt selection** | Admin picks extractor + verifier prompts | **Simplified** — admin picks extractor prompt only (no verifier needed), from `prompts` collection (`usage: extractor`) |
| **Segmentation** | PDF split into page-range segments | **Removed** — treat entire doc as one input |
| **LLM extraction** | Per-segment, expects JSON array of exercises | **Simplified** — single LLM call, expects ONE exercise object |
| **Verification pass** | Second LLM call per exercise | **Kept** — single verification call |
| **Deduplication/Idempotency** | Hash-based dedup, idempotency keys | **Removed** — simple create-or-fail |
| **Job system** | Async Payload job queue | **Simplified** — can be synchronous API call (no queue needed for single exercise) |
| **Admin UI** | `LessonConversionPanel` with V1/V2 buttons, status panels | **New button** — "Convert V3" added alongside existing buttons, minimal inline preview |
| **Output** | Multiple exercises created as drafts | **One exercise** created (draft or published) |
| **Exercise types** | All block types | Focus on `question_select` (MCQ) and `question_free_response` |

### What We Reuse As-Is
- LLM provider factory + Gemini integration (`src/infra/llm/providers/factory.ts`)
- PDF buffer fetching (`src/server/services/pdf-fetcher.ts`)
- Image optimization service (`src/infra/llm/services/image-optimizer-service.ts`)
- Exercise collection schema, types, defaults (`src/server/payload/collections/Exercises/`)
- Block ID enrichment (`enrichBlockIds` from helpers)
- Content-to-payload mapping (`toPayloadContent` from helpers)
- Existing auth patterns from queue route
- Prompt fetching + validation (`/api/prompts/for-conversion` route, `validatePromptForUsageAndTenant` helper)
- `prompts` collection (existing `usage: extractor` prompts)

### What We Fork & Simplify
- Extraction prompt — fetched from `prompts` collection (`usage: extractor`, tenant-scoped, published). Prompt should instruct "return one exercise" instead of an array
- API route — new `/api/exercises/convert/single` route (synchronous, no job queue)
- Extraction logic — single LLM call returning one exercise object (not an array)
- Parsing — expect a single JSON object, not an array

### What We Build New
- "Convert V3" button in the admin `LessonConversionPanel`
- Inline preview component showing extracted content before creation
- The single-exercise extraction service function

---

## Functional Requirements

### FR-1: Input Handling
- Accept a PDF or image file that is already attached to a lesson's `contentFiles`
- PDF: send entire document (all pages) as one input to LLM
- Image: send as-is (with optimization) to LLM
- Validate file type (PDF or image), reject unsupported formats

### FR-2: Single-Exercise Extraction (LaTeX Output)
- Make one LLM call with the document + a single-exercise extraction prompt
- Prompt is fetched from the `prompts` collection where `usage: 'extractor'`, `status: 'published'`, and tenant matches the lesson's tenant
- The prompt template instructs the model to extract exactly one exercise and return content as LaTeX
- Admin selects which extractor prompt to use via a dropdown (same pattern as V1's `ConvertForm`)
- **Output format is LaTeX** — all extracted content (question text, answer options, explanations) uses LaTeX notation for math and formatting
- This maps naturally to existing block types:
  - `rich_text` blocks with `format: 'md-math-v1'` — markdown body with inline/display LaTeX math (`$...$` and `$$...$$`)
  - `latex` blocks with `renderMode: 'block'` — for standalone formulas or heavily formatted content
- Support two exercise shapes: `question_select` (MCQ/true-false) and `question_free_response`
- The frontend already renders LaTeX via KaTeX (`rehype-katex` + `remark-math`) — no new rendering infrastructure needed
- Enrich block IDs using existing `enrichBlockIds`

### FR-3: Optional Verification
- After extraction, run a single verification LLM call (reuse existing verifier pattern)
- If verification fails, still show the result to the user with a warning — let them decide

### FR-4: Preview Before Creation
- Show the extracted exercise content in a preview panel within the admin UI
- Allow the admin to see what was extracted before committing
- Provide a "Create Exercise" confirmation button
- On success, show a link to the created exercise

### FR-5: Exercise Creation
- Create one exercise document in the `exercises` collection
- Link it to the source lesson
- Set `origin: 'conversion'` and `pipelineVersion: 3`
- Create as draft status

### FR-6: Error Handling
- Unsupported file type → clear error message
- LLM extraction fails → show error, allow retry
- No text/question detected → inform user, suggest manual creation
- Network/timeout errors → graceful message

---

## Non-Functional Requirements

- **NFR-1**: End-to-end latency under 30 seconds for a single page
- **NFR-2**: No new dependencies — reuse existing LLM infrastructure
- **NFR-3**: Basic logging for extraction attempts and failures

---

## Architecture

```
Admin UI (LessonConversionPanel)
  └─ "Convert V3" button per PDF/image
       ├─ Admin selects extractor prompt (dropdown, from prompts collection)
       │
       ▼
  POST /api/exercises/convert/single
    ├─ Auth check (admin only)
    ├─ Validate input (lessonId, mediaId, extractorPromptId)
    ├─ Fetch + validate extractor prompt (published, correct tenant, usage=extractor)
    ├─ Fetch document buffer (PDF or image)
    ├─ Single LLM extraction call (using selected prompt template)
    ├─ Parse + validate response (Zod)
    ├─ Enrich block IDs
    ├─ Return extracted exercise JSON
       │
       ▼
  Admin UI Preview
    ├─ Show extracted content
    ├─ "Create Exercise" button
       │
       ▼
  POST /api/exercises/convert/single/create
    ├─ Auth check
    ├─ Create exercise in collection
    ├─ Return created exercise ID + link
```

---

## Implementation Steps

### Step 1: Single-Exercise Extraction Service

**Files to touch:**
- `src/server/services/exercise-conversion/single-exercise-extractor.ts` (NEW)

**Behavior:**
- Function `extractSingleExercise({ pdfBuffer, mimeType, mediaUrl, promptTemplate })` 
- Uses the provided prompt template (from `prompts` collection) as the LLM system/user prompt
- Calls LLM via provider factory with document as multimodal attachment
- Parses response as single JSON object (not array)
- Validates with Zod schema
- Returns extracted exercise data or error

**Test (integration):**
- Test with a mock LLM response: given a known JSON string, the extractor parses and validates it correctly
- Test error case: malformed LLM response returns structured error

**Acceptance criteria:**
- [ ] Function accepts PDF buffer or image buffer
- [ ] Returns a validated single exercise object with block IDs
- [ ] Handles parse errors gracefully

---

### Step 2: API Route — Extract

**Files to touch:**
- `src/app/api/exercises/convert/single/route.ts` (NEW)

**Behavior:**
- `POST /api/exercises/convert/single`
- Body: `{ lessonId, mediaId, extractorPromptId }`
- Auth: admin session required (reuse pattern from V1 queue route)
- Validates lesson exists, media is attached to lesson
- Fetches and validates extractor prompt (published, tenant match, `usage: extractor`) — same pattern as V1 queue route
- Fetches document buffer (PDF via `getPdfBufferFromBlob`, image via fetch)
- Calls `extractSingleExercise`
- Returns `{ success: true, exercise: { title, blocks, ... } }` or error

**Test (integration):**
- Auth: unauthenticated request → 401
- Valid request with mocked LLM → returns extracted exercise JSON
- Invalid mediaId → 400 with clear error code

**Acceptance criteria:**
- [ ] Admin-only access enforced
- [ ] Validates lesson-media relationship
- [ ] Returns extracted exercise data (not yet persisted)

---

### Step 3: API Route — Create Exercise

**Files to touch:**
- `src/app/api/exercises/convert/single/create/route.ts` (NEW)

**Behavior:**
- `POST /api/exercises/convert/single/create`
- Body: `{ lessonId, mediaId, exercise: { title, blocks } }`
- Auth: admin session required
- Creates exercise document via Payload Local API
- Sets `origin: 'conversion'`, `pipelineVersion: 3`, `lesson: lessonId`
- Returns `{ success: true, exerciseId, adminUrl }`

**Test (integration):**
- Valid exercise data → exercise created in collection, linked to lesson
- Missing required fields → 400 error

**Acceptance criteria:**
- [ ] Exercise persisted in `exercises` collection
- [ ] Linked to correct lesson
- [ ] Metadata fields set correctly

---

### Step 4: Admin UI — "Convert V3" Button + Preview

**Files to touch:**
- `src/ui/admin/exercise-conversion/ConvertV3Button/index.tsx` (NEW)
- `src/ui/admin/exercise-conversion/LessonConversionPanel/index.tsx` (MODIFIED — add V3 button)

**Behavior:**
- New `ConvertV3Button` component (client component)
- Shows "Convert V3" button next to each PDF/image in the conversion panel
- Includes extractor prompt dropdown (fetches options from `/api/prompts/for-conversion`, shows only extractors)
- On click: calls extract API with selected prompt, shows loading state
- On success: shows inline preview of extracted exercise (title, question text, options)
- Preview includes "Create Exercise" button
- On create: calls create API, shows success with link to exercise
- On error: shows error message with retry option

**Acceptance criteria:**
- [ ] Button visible in lesson admin for PDFs and images
- [ ] Extraction result previewed before creation
- [ ] Create button persists the exercise
- [ ] Errors shown inline

---

### Step 5: End-to-End Verification

**Test scenario (manual + automated):**
- Use lesson "בדיקת המרה"
- Upload a PDF document containing exactly one exercise
- Click "Convert V3"
- Verify: extraction preview shows the question
- Click "Create Exercise"
- Verify: exercise appears in Exercises collection linked to the lesson
- Verify: exercise renders in the interactive lesson UI

**Acceptance criteria:**
- [ ] Full flow works: Upload → Extract → Preview → Create → Render
- [ ] At least 5 sample uploads tested successfully
- [ ] Extraction failures logged with context

---

## Out of Scope (POC)

- Perfect formatting / layout preservation
- Multi-exercise detection or splitting
- Job queue (synchronous is fine for single exercise)
- Idempotency / deduplication
- Image crop pipeline (V2 approach) — we use text extraction (V1 approach)

## Future Enhancements

- Add manual correction UI before creating exercise (editable preview)
- Support more block types (table, matching, geometry)
- Queue-based async processing for larger documents
