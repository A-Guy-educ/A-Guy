# Plan: Exercise Generation from Document (V3 POC)

**Task ID**: 260301-auto-20
**Task Type**: implement_feature
**Spec**: FR-EX-001 through FR-EX-007, NFR-011 through NFR-013

## Rerun Context

Previous run was a generic rerun request with no specific issues noted. This plan is a fresh, detailed breakdown covering all spec requirements with TDD test gates. The plan follows existing codebase patterns (V1/V2 pipelines, `withApiHandler`, `ContentBlockSchema`, etc.) and reuses infrastructure already in place.

---

## Architecture Overview

**V3 is a synchronous, single-exercise conversion POC** with two API endpoints:
1. **Extract**: `POST /api/exercises/convert/single` — takes a media ID, calls LLM, returns preview JSON
2. **Create**: `POST /api/exercises/convert/single/create` — takes edited exercise data, persists to DB

**Key files to create (NEW)**:
- `src/server/payload/collections/ExtractionLogs.ts` — FR-EX-007
- `src/server/services/exercise-conversion/v3/prompt-resolver.ts` — NFR-011 (prompt selection + tenant/usage validation)
- `src/server/services/exercise-conversion/v3/transform.ts` — FR-EX-001 (LLM output → ContentBlock)
- `src/server/services/exercise-conversion/v3/extract-single.ts` — FR-EX-003 (orchestrator)
- `src/app/api/exercises/convert/single/route.ts` — FR-EX-004 (extract endpoint)
- `src/app/api/exercises/convert/single/create/route.ts` — FR-EX-005 (create endpoint)
- `src/ui/admin/exercise-conversion/ConvertV3Button/index.tsx` — FR-EX-006 (UI button)
- `src/ui/admin/exercise-conversion/V3PreviewPanel/index.tsx` — FR-EX-004 (preview/edit UI)

**Key files to modify (MODIFIED)**:
- `src/payload.config.ts` — register ExtractionLogs collection
- `src/infra/llm/services/data-extractor-service.ts` — accept prompt override + expose raw response text for logging
- `src/ui/admin/exercise-conversion/LessonConversionPanel/index.tsx` — add V3 button + panel

---

## Assumptions

1. The existing `extractFromImage()` in `src/infra/llm/services/data-extractor-service.ts` is reused for LLM extraction, with a small extension to support prompt override (from Prompts collection) and raw response logging.
2. Images for content files are fetched via Payload's Media collection (URL from `media.url`).
3. For PDF files, we convert the first page to an image using the existing image extraction infrastructure before calling `extractFromImage`.
4. The `LessonConversionPanel` already filters for PDFs only; V3 will also support image mime types (`image/png`, `image/jpeg`, `image/webp`).
5. `tenantField` auto-fills on create via its `beforeValidate` hook, but V3 endpoints still explicitly enforce lesson-tenant scoping for media + prompt resolution.
6. The admin preview/edit UI is a simple JSON form with editable fields — not a full WYSIWYG editor. This is acceptable for a POC.

---

## Step 1: Create ExtractionLogs Collection (FR-EX-007, NFR-012, NFR-013)

**Time estimate**: 15 minutes

**Files to touch**:
- `src/server/payload/collections/ExtractionLogs.ts` (NEW)
- `src/payload.config.ts` (MODIFIED — lines ~32-60 imports, ~88 collections array)

**Exact behavior**:
- Collection slug: `extraction-logs`
- Fields:
  - `tenant` (tenantField — required, auto-filled)
  - `lesson` (relationship → lessons, required, index)
  - `media` (relationship → media, required, index) — source document
  - `exercise` (relationship → exercises, optional) — populated only on creation-stage success logs
  - `prompt` (relationship → prompts, optional) — which prompt was used
  - `promptVersion` (text, optional) — immutable version marker (e.g., `${prompt.key}:${prompt.updatedAt}`)
  - `status` (select: `success` | `failed`, required)
  - `stage` (select: `extract` | `create`, required) — keeps append-only lifecycle events
  - `rawResponse` (textarea) — raw LLM response string
  - `parsedPayload` (json) — parsed JSON from LLM
  - `errorMessage` (text, optional) — error details if failed
  - `pipelineVersion` (number, default 3)
  - `processingTimeMs` (number) — extraction duration
  - `model` (text) — LLM model name used
- Access control (NFR-012):
  - `create`: `() => false` (not creatable from admin UI; server-side creation uses controlled `overrideAccess: true`)
  - `read`: `adminOnly`
  - `update`: `() => false`
  - `delete`: `() => false`
- Admin group: `AI`
- Timestamps: true

**Tests** (test file: `tests/unit/collections/extraction-logs.test.ts`):

1. **Test: ExtractionLogs collection has correct access control**
   - Import the collection config
   - Assert `access.create` returns `false` for any user
   - Assert `access.read` returns `true` only for admin users
   - Assert `access.update` returns `false`
   - Assert `access.delete` returns `false`
   - FAILS before: collection doesn't exist
   - PASSES after: collection created with correct access

2. **Test: ExtractionLogs registered in payload config**
   - Import payload config
   - Assert `collections` array includes a collection with slug `extraction-logs`
   - FAILS before: not registered
   - PASSES after: added to config

3. **Test: ExtractionLogs schema includes append-only lifecycle fields**
   - Assert fields contain `stage` and `promptVersion`
   - Assert `exercise` is optional (for extract failures / pre-create previews)
   - FAILS before: collection doesn't exist
   - PASSES after: schema supports extract + create lifecycle without updates

**Acceptance criteria**:
- [ ] Collection file exists at `src/server/payload/collections/ExtractionLogs.ts`
- [ ] All fields match spec + lifecycle needs (tenant, lesson, media, exercise, prompt, promptVersion, status, stage, rawResponse, parsedPayload, errorMessage, pipelineVersion, processingTimeMs, model)
- [ ] Access control: create=false, read=adminOnly, update=false, delete=false
- [ ] Registered in `src/payload.config.ts` collections array
- [ ] `pnpm generate:types` run after collection schema addition
- [ ] `pnpm tsc --noEmit` passes

---

## Step 2: LLM Output → ContentBlock Transform Service (FR-EX-001)

**Time estimate**: 25 minutes

**Files to touch**:
- `src/server/services/exercise-conversion/v3/transform.ts` (NEW)

**Exact behavior**:

The transform layer is split into two explicit outputs:

1. `toPreviewDraft()` — preserves editable semantics for admin preview (including `correctAnswer: null`)
2. `toExerciseContent()` — produces strict `ContentSchema` payload for persistence

```typescript
// Input (from extractFromImage):
interface SimpleExtraction {
  question: string
  options: string[]    // empty array → free_response
  correctAnswer: number | null  // index into options, or null
  explanation?: string
}

// Output A: Preview draft (editable, allows unknown answer)
interface PreviewDraft {
  title: string
  question: string
  options: string[]
  correctAnswer: number | null
  explanation?: string
  questionType: 'free_response' | 'true_false' | 'mcq'
}

// Output B: ExerciseContent (validated against ContentSchema)
interface TransformResult {
  title: string        // derived from question (first 80 chars)
  content: { blocks: ContentBlock[] }
}
```

**Transform logic**:
- If `options.length === 0` → `question_free_response` block:
  - `id`: nanoid()
  - `type`: `question_free_response`
  - `prompt`: `{ type: 'rich_text', format: 'md-math-v1', value: question, mediaIds: [] }`
  - `answer`: `{ acceptedAnswers: ['(answer not detected)'] }` — placeholder
- If `options.length === 2` and options match true/false pattern → `question_select` with `variant: 'true_false'`:
  - Standard true/false block structure per schema
  - `answer.correctOptionId`: map `correctAnswer` index to `'true'`/`'false'`, or `undefined` if null
- If `options.length >= 2` → `question_select` with `variant: 'mcq'`:
  - `id`: nanoid()
  - `selectionMode`: `'single'`
  - `prompt`: InlineRichText from question
  - `answer.multiSelect`: false
  - `answer.options`: map each option to `{ id: nanoid(), content: InlineRichText }`
  - `answer.correctOptionIds`:
    - if `correctAnswer !== null`: map detected index
    - if `correctAnswer === null`: use deterministic fallback first option for schema validity, but preserve `correctAnswer: null` in PreviewDraft + ExtractionLog parsed payload
- If `explanation` exists → append a `rich_text` block after the question block with the explanation text
- `title`: first 80 characters of `question`, trimmed, ellipsis if truncated

**Validation**: `toExerciseContent()` output MUST pass `ContentSchema.parse()` or throw.

**Tests** (test file: `tests/unit/server/services/exercise-conversion/v3-transform.test.ts`):

1. **Test: transforms MCQ extraction to question_select mcq block**
   - Input: `{ question: "What is 2+2?", options: ["3", "4", "5", "6"], correctAnswer: 1 }`
   - Assert output has 1 block of type `question_select` with variant `mcq`
   - Assert `answer.correctOptionIds` contains the ID of the option with content value "4"
   - Assert `answer.options` has 4 items
   - Assert `ContentSchema.parse(output.content)` succeeds
   - FAILS before: transform function doesn't exist
   - PASSES after: transform correctly builds MCQ block

2. **Test: transforms extraction with no options to question_free_response block**
   - Input: `{ question: "Solve: x + 3 = 7", options: [], correctAnswer: null }`
   - Assert output has 1 block of type `question_free_response`
   - Assert `answer.acceptedAnswers` is `['(answer not detected)']`
   - Assert `ContentSchema.parse(output.content)` succeeds
   - FAILS before: transform function doesn't exist
   - PASSES after: correctly builds free response block

3. **Test: transforms extraction with explanation to include rich_text block**
   - Input: `{ question: "Q?", options: ["A", "B"], correctAnswer: 0, explanation: "Because..." }`
   - Assert output has 2 blocks: first `question_select`, second `rich_text` with value containing "Because..."
   - FAILS before: no transform function
   - PASSES after: explanation appended as rich_text block

4. **Test: transforms true/false pattern to question_select true_false variant**
   - Input: `{ question: "The sky is blue", options: ["True", "False"], correctAnswer: 0 }`
   - Assert output block has `variant: 'true_false'`
   - Assert `answer.correctOptionId` is `'true'`
   - FAILS before: no transform
   - PASSES after: correct true/false detection

5. **Test: handles null correctAnswer gracefully**
   - Input: `{ question: "Q?", options: ["A", "B", "C"], correctAnswer: null }`
   - Assert preview draft keeps `correctAnswer: null`
   - Assert content output is valid (doesn't throw) using deterministic fallback for `correctOptionIds`
   - Assert `ContentSchema.parse(output.content)` succeeds
   - FAILS before: no transform
   - PASSES after: graceful fallback

**Acceptance criteria**:
- [ ] `toPreviewDraft(input)` preserves editable extracted data including `correctAnswer: null`
- [ ] `toExerciseContent(input)` returns `{ title, content }` that passes `ContentSchema.parse()`
- [ ] MCQ, free response, and true/false variants all produce valid blocks
- [ ] Null correctAnswer doesn't block creation
- [ ] All 5 tests pass
- [ ] `pnpm tsc --noEmit` passes

---

## Step 3: Single Exercise Extraction Orchestrator (FR-EX-003, FR-EX-005, NFR-011)

**Time estimate**: 25 minutes

**Files to touch**:
- `src/server/services/exercise-conversion/v3/extract-single.ts` (NEW)
- `src/server/services/exercise-conversion/v3/prompt-resolver.ts` (NEW)
- `src/infra/llm/services/data-extractor-service.ts` (MODIFIED)

**Exact behavior**:

```typescript
interface ExtractSingleInput {
  lessonId: string
  mediaId: string
  promptId?: string  // optional override, defaults to tenant-scoped published extractor prompt
}

interface ExtractSingleResult {
  success: boolean
  preview?: {
    title: string
    draft: PreviewDraft
    content: { blocks: ContentBlock[] }
    metadata: { model: string; processingTimeMs: number; promptId?: string; promptVersion?: string }
  }
  extractionLogId: string
  error?: string
}
```

**Orchestration steps**:
1. Fetch lesson (`lessons`) and resolve `lessonTenantId`.
2. Fetch media document from Payload and validate media ID is attached to lesson `contentFiles` (FR-EX-002 + tenant-safe association).
3. Resolve extractor prompt via `prompt-resolver.ts`:
   - If `promptId` provided: enforce `usage='extractor'`, `status='published'`, tenant match.
   - Else: find latest published extractor prompt for lesson tenant.
4. Download media buffer (via `media.url`).
5. If PDF: render first page using existing V2 PDF renderer (`loadAndRenderAllPages` / first page image). If image mime type (`image/png|jpeg|webp`): use directly.
6. Call `extractFromImage({ imageBuffer, mimeType, promptOverride }, payload)`.
7. If extractor returns multiple candidate questions (array), silently take first (FR-EX-003).
8. Build preview draft + content via Step 2 transforms.
9. Create ExtractionLog (stage=`extract`) with status success/failed, raw response text, parsed payload, prompt reference/version, tenant/lesson/media.
10. Return preview payload with `extractionLogId`.

**The orchestrator does NOT create the exercise** — it only extracts and returns a preview.

**Tests** (test file: `tests/unit/server/services/exercise-conversion/v3-extract-single.test.ts`):

1. **Test: extractSingle returns preview with valid content blocks**
   - Mock `extractFromImage` to return `{ success: true, data: { question: "Q?", options: ["A","B"], correctAnswer: 0 }, metadata: {...} }`
   - Mock `payload.findByID` for media doc
   - Mock `payload.create` for extraction log
   - Mock fetch for media URL (return image buffer)
   - Assert result has `success: true`, `preview.content` passes `ContentSchema.parse()`
   - Assert result includes prompt metadata (`promptId`, `promptVersion`)
   - Assert `payload.create` was called for `extraction-logs` collection with `overrideAccess: true`
   - FAILS before: service doesn't exist
   - PASSES after: orchestrator works

2. **Test: extractSingle creates ExtractionLog on failure**
   - Mock `extractFromImage` to return `{ success: false, error: "LLM timeout" }`
   - Assert result has `success: false`, `error` message
   - Assert ExtractionLog created with `status: 'failed'`, `errorMessage: "LLM timeout"`
   - FAILS before: service doesn't exist
   - PASSES after: failure path logs correctly

3. **Test: extractSingle enforces prompt tenant + usage**
   - Provide prompt with wrong usage or tenant mismatch
   - Assert extraction fails with validation-style error
   - Assert failed ExtractionLog recorded with `stage: 'extract'`

**Acceptance criteria**:
- [ ] `extractSingle()` orchestrates: fetch media → extract → transform → log → return preview
- [ ] ExtractionLog created with `overrideAccess: true` (bypasses `create: () => false`)
- [ ] Prompt selection is tenant-scoped and uses `usage='extractor'` published prompts
- [ ] Both success and failure paths create ExtractionLogs
- [ ] `pnpm tsc --noEmit` passes

---

## Step 4: Extract API Endpoint (FR-EX-004)

**Time estimate**: 20 minutes

**Files to touch**:
- `src/app/api/exercises/convert/single/route.ts` (NEW)

**Exact behavior**:
- **Method**: POST
- **Auth**: `admin` (uses `withApiHandler`)
- **Body schema** (Zod):
  ```typescript
  z.object({
    lessonId: z.string().min(1),
    mediaId: z.string().min(1),
    promptId: z.string().optional(),
  })
  ```
- **Response (200)**:
  ```json
  {
    "success": true,
    "data": {
      "title": "Exercise title",
      "content": { "blocks": [...] },
      "metadata": { "model": "...", "processingTimeMs": 1234 },
      "extractionLogId": "abc123"
    }
  }
  ```
- **Response (400)**: Validation errors
- **Response (401)**: Unauthorized
- **Response (404)**: Media or lesson not found
- **Response (500)**: LLM extraction failure (returns error details)

**Implementation**: Calls `extractSingle()` from Step 3, wraps with `withApiHandler`.

**Tests** (test file: `tests/unit/server/services/exercise-conversion/v3-extract-api.test.ts`):

1. **Test: POST /api/exercises/convert/single returns preview on success**
   - Mock the `extractSingle` service
   - Assert response shape matches `{ success: true, data: { title, content, metadata, extractionLogId } }`
   - Assert response status is 200
   - FAILS before: route doesn't exist
   - PASSES after: endpoint wired correctly

2. **Test: POST /api/exercises/convert/single returns 400 for missing lessonId**
   - Send body without `lessonId`
   - Assert 400 response with validation error
   - FAILS before: route doesn't exist
   - PASSES after: Zod validation rejects

**Acceptance criteria**:
- [ ] Route exists at `src/app/api/exercises/convert/single/route.ts`
- [ ] Uses `withApiHandler` with `auth: 'admin'`
- [ ] Validates body with Zod schema
- [ ] Returns standardized API response format
- [ ] `pnpm tsc --noEmit` passes

---

## Step 5: Create Exercise API Endpoint (FR-EX-005)

**Time estimate**: 20 minutes

**Files to touch**:
- `src/app/api/exercises/convert/single/create/route.ts` (NEW)

**Exact behavior**:
- **Method**: POST
- **Auth**: `admin`
- **Body schema**:
  ```typescript
  z.object({
    lessonId: z.string().min(1),
    mediaId: z.string().min(1),
    title: z.string().min(1),
    content: z.object({ blocks: z.array(z.unknown()).min(1) }),  // validated more deeply server-side
    extractionLogId: z.string().min(1),
  })
  ```
- **Logic**:
  1. Validate `content` against `ContentSchema.parse()` — reject if invalid
  2. Fetch lesson to get tenant ID (for tenant scoping)
  3. Fetch ExtractionLog by `extractionLogId` and enforce preview gate:
     - must exist
     - must be `stage: 'extract'` and `status: 'success'`
     - must match same `lesson` + `media`
     - if already consumed (creation log already exists for this extraction log) reject duplicate create
  4. Create exercise via `payload.create({ collection: 'exercises', data: { ... } })`:
      - `title`: from body
      - `content`: from body (admin-edited)
      - `lesson`: lessonId
      - `origin`: `'conversion'`
      - `sourceDoc`: mediaId
      - `pipelineVersion`: 3
      - `order`: 0 (default, admin can reorder later)
      - `tenant`: from lesson's tenant
  5. Create a **new** ExtractionLog (append-only) with `stage: 'create'`, `status: 'success'`, `exercise: newExercise.id`, and `parsedPayload` snapshot of final content
  6. Return created exercise

- **Published behavior note (FR-EX-005)**:
  - Exercises collection currently has no drafts/status field.
  - Creating an exercise document makes it immediately available under existing read access (treated as "published" in this project).

- **Response (201)**:
  ```json
  {
    "success": true,
    "data": { "exerciseId": "...", "adminUrl": "/admin/collections/exercises/..." }
  }
  ```
- **Response (400)**: Content validation failure
- **Response (401)**: Unauthorized

**Tests** (test file: `tests/unit/server/services/exercise-conversion/v3-create-api.test.ts`):

1. **Test: POST .../single/create creates exercise with conversion metadata**
   - Mock `payload.create` and `payload.findByID/find`
   - Send valid body with title, content, lessonId, mediaId, extractionLogId
   - Assert `payload.create` called with `origin: 'conversion'`, `pipelineVersion: 3`, `sourceDoc: mediaId`
   - Assert a new create-stage ExtractionLog is written with exercise relationship (no updates)
   - Assert response status 201
   - FAILS before: route doesn't exist
   - PASSES after: exercise created correctly

2. **Test: POST .../single/create rejects invalid content blocks**
   - Send body with `content: { blocks: [{ type: "invalid_type" }] }`
   - Assert 400 response with validation error about content
   - FAILS before: route doesn't exist
   - PASSES after: ContentSchema validation rejects

3. **Test: POST .../single/create rejects calls without valid extraction preview**
   - Use missing/failed/mismatched extractionLogId
   - Assert 400/404 error and no exercise created
   - FAILS before: route doesn't exist
   - PASSES after: preview/edit gate enforced server-side

**Acceptance criteria**:
- [ ] Exercise created with `origin: 'conversion'`, `pipelineVersion: 3`, `sourceDoc` linked
- [ ] Content validated against `ContentSchema` before creation
- [ ] No ExtractionLog updates (append-only); create-stage log links exercise
- [ ] Create endpoint enforces prior successful extraction preview (`extractionLogId` gate)
- [ ] Tenant scoped via lesson's tenant
- [ ] `pnpm tsc --noEmit` passes

---

## Step 6: Admin UI — ConvertV3Button + V3PreviewPanel (FR-EX-004, FR-EX-006)

**Time estimate**: 30 minutes

**Files to touch**:
- `src/ui/admin/exercise-conversion/ConvertV3Button/index.tsx` (NEW)
- `src/ui/admin/exercise-conversion/V3PreviewPanel/index.tsx` (NEW)
- `src/ui/admin/exercise-conversion/LessonConversionPanel/index.tsx` (MODIFIED — lines 1-9 imports, ~69 filter logic, ~185-208 button area)

**Exact behavior**:

### ConvertV3Button
- Props: `{ lessonId: string; mediaId: string; onPreview: (data: PreviewData) => void }`
- Renders a button labeled "Convert V3"
- On click: `POST /api/exercises/convert/single` with `{ lessonId, mediaId }`
- Shows loading state during extraction
- On success: calls `onPreview()` with the preview data
- On error: shows error message inline

### V3PreviewPanel
- Props: `{ preview: PreviewData; lessonId: string; mediaId: string; onClose: () => void; onCreated: (exerciseId: string) => void }`
- Displays:
  - Editable title (text input)
  - Question prompt text (textarea, editable)
  - Answer options (if MCQ — list of editable text inputs)
  - Correct answer selector (dropdown for MCQ, text input for free response)
  - Raw JSON view (collapsible, read-only)
- "Create Exercise" button:
  - Rebuilds content blocks from edited values
  - `POST /api/exercises/convert/single/create` with edited data
  - On success: shows success message with link to exercise admin page
- "Cancel" button: closes panel

### LessonConversionPanel changes
- Expand file filter to include image files (`image/png`, `image/jpeg`, `image/webp`) in addition to PDFs
- Add `ConvertV3Button` next to existing V1/V2 buttons (line ~185-208)
- Add state for V3 preview (`v3Preview`, `v3MediaId`)
- Render `V3PreviewPanel` when preview is active (below the media item)

**Tests** (test file: `tests/unit/ui/convert-v3-button.test.tsx`):

1. **Test: ConvertV3Button calls API and returns preview on click**
   - Render `ConvertV3Button` with mock props
   - Mock `fetch` to return success response with preview data
   - Simulate button click
   - Assert `fetch` called with correct URL and body
   - Assert `onPreview` callback called with the response data
   - FAILS before: component doesn't exist
   - PASSES after: button wired correctly

2. **Test: LessonConversionPanel shows V3 button for PDF and image files**
   - Render `LessonConversionPanel` with mock `useDocumentInfo` and `useFormFields`
   - Provide media items with both PDF and image mimeTypes
   - Assert "Convert V3" button appears for each media item
   - Assert non-PDF/image files don't get V3 button
   - FAILS before: V3 button not in panel
   - PASSES after: button added to panel

**Acceptance criteria**:
- [ ] "Convert V3" button visible next to V1/V2 buttons in LessonConversionPanel
- [ ] Clicking button triggers extraction API call
- [ ] Preview panel shows with editable fields for title, question, options, correct answer
- [ ] "Create Exercise" button submits to creation endpoint
- [ ] Both PDF and image files supported
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm generate:importmap` runs without errors

---

## Step 7: Integration Test — End-to-End V3 Flow + Solvability Smoke

**Time estimate**: 20 minutes

**Files to touch**:
- `tests/int/v3-single-exercise-conversion.int.spec.ts` (NEW)

**Exact behavior**:

Integration tests that validate the full V3 flow through the API layer (without real LLM calls), plus acceptance-criteria smoke checks for rendering/solvability compatibility.

**Tests**:

1. **Test: Full V3 extraction + creation flow**
   - Setup: Create test tenant, lesson, media document
   - Mock `extractFromImage` at the service level to return a known MCQ result
   - Call `POST /api/exercises/convert/single` with `{ lessonId, mediaId }`
   - Assert response contains valid preview with `content.blocks` passing `ContentSchema`
   - Take response data, call `POST /api/exercises/convert/single/create` with the preview data
   - Assert exercise created in DB with `origin: 'conversion'`, `pipelineVersion: 3`
   - Assert ExtractionLogs exist for both stages (`extract` and `create`) and create-stage log links exercise
   - FAILS before: endpoints don't exist
   - PASSES after: full flow works

2. **Test: V3 extraction creates failed ExtractionLog on LLM error**
   - Mock `extractFromImage` to return `{ success: false, error: "timeout" }`
   - Call `POST /api/exercises/convert/single`
   - Assert response indicates failure
   - Assert ExtractionLog created with `status: 'failed'`
   - FAILS before: endpoints don't exist
   - PASSES after: failure logging works

3. **Test: V3 create endpoint rejects unauthorized users**
   - Call without admin auth
   - Assert 401 response
   - FAILS before: endpoint doesn't exist
   - PASSES after: auth enforced

4. **Test: created V3 content is compatible with lesson exercise query + renderer contract**
   - After create, call `queryExercisesByLesson({ lessonId })`
   - Assert created exercise is returned and content validates against `ContentSchema`
   - Optionally render the block payload with ExerciseRenderer test harness to ensure no runtime type mismatch
   - FAILS before: V3 content path missing
   - PASSES after: created exercises flow into standard lesson path

5. **Test: answer validation contract works for V3 generated question blocks**
   - Build validation payload from created question block (`acceptedAnswers` for free-response OR selected correct option text for mcq)
   - Call validation layer (endpoint handler or helper with authenticated mock user)
   - Assert correct submission evaluates true
   - FAILS before: V3 flow absent
   - PASSES after: V3 output remains solvable/gradable

**Acceptance criteria**:
- [ ] Full flow: extract → preview → edit → create → exercise in DB
- [ ] ExtractionLogs created for both success and failure cases
- [ ] Exercise has correct conversion metadata
- [ ] Auth enforced on both endpoints
- [ ] Created exercise content passes ContentSchema validation
- [ ] Lesson-query/render compatibility smoke passes
- [ ] Validation logic smoke passes for V3-generated question
- [ ] `pnpm test:int -- --grep "v3"` passes

---

## Dependency Graph

```
Step 1 (ExtractionLogs collection) ──┐
                                     │
Step 2 (Transform service) ──────────┤
                                     ├──→ Step 3 (Extract orchestrator)
                                     │           │
                                     │           ├──→ Step 4 (Extract API)
                                     │           │
                                     │           └──→ Step 5 (Create API)
                                     │                       │
                                     └───────────────────────┼──→ Step 6 (Admin UI)
                                                             │
                                                             └──→ Step 7 (Integration test)
```

Steps 1 and 2 can be done in parallel. Steps 4 and 5 depend on Step 3. Step 6 depends on Steps 4+5. Step 7 validates everything.

---

## Quality Gates

After all steps:
1. `pnpm generate:types` — required after adding `ExtractionLogs` collection
2. `pnpm tsc --noEmit` — zero TypeScript errors
3. `pnpm lint` — zero lint errors
4. `pnpm generate:importmap` — succeeds (required after adding admin UI components)
5. All unit tests pass: `pnpm test -- --grep "v3"`
6. All integration tests pass: `pnpm test:int -- --grep "v3"`
7. ContentSchema validation passes for all generated exercise formats

---

## Files Summary

| File | Status | Step |
|------|--------|------|
| `src/server/payload/collections/ExtractionLogs.ts` | NEW | 1 |
| `src/payload.config.ts` | MODIFIED | 1 |
| `src/server/services/exercise-conversion/v3/prompt-resolver.ts` | NEW | 3 |
| `src/server/services/exercise-conversion/v3/transform.ts` | NEW | 2 |
| `src/server/services/exercise-conversion/v3/extract-single.ts` | NEW | 3 |
| `src/infra/llm/services/data-extractor-service.ts` | MODIFIED | 3 |
| `src/app/api/exercises/convert/single/route.ts` | NEW | 4 |
| `src/app/api/exercises/convert/single/create/route.ts` | NEW | 5 |
| `src/ui/admin/exercise-conversion/ConvertV3Button/index.tsx` | NEW | 6 |
| `src/ui/admin/exercise-conversion/V3PreviewPanel/index.tsx` | NEW | 6 |
| `src/ui/admin/exercise-conversion/LessonConversionPanel/index.tsx` | MODIFIED | 6 |
| `tests/unit/collections/extraction-logs.test.ts` | NEW | 1 |
| `tests/unit/server/services/exercise-conversion/v3-transform.test.ts` | NEW | 2 |
| `tests/unit/server/services/exercise-conversion/v3-extract-single.test.ts` | NEW | 3 |
| `tests/unit/server/services/exercise-conversion/v3-extract-api.test.ts` | NEW | 4 |
| `tests/unit/server/services/exercise-conversion/v3-create-api.test.ts` | NEW | 5 |
| `tests/unit/ui/convert-v3-button.test.tsx` | NEW | 6 |
| `tests/int/v3-single-exercise-conversion.int.spec.ts` | NEW | 7 |
