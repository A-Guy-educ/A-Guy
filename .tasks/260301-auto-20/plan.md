# Plan: Exercise Generation from Document (V3 POC)

**Task ID**: 260301-auto-20
**Task Type**: implement_feature
**Spec**: FR-EX-001 through FR-EX-007, NFR-011 through NFR-013

## Rerun Context

This is a rerun with minimal feedback (`/cody rerun`). The previous plan was not found (fresh start). This plan addresses all spec requirements from scratch with a properly sequenced, TDD-gated approach.

## Assumptions

1. **No clarified.md exists** — working from spec.md alone.
2. **Synchronous API** — V3 is NOT a job queue pipeline. It uses synchronous HTTP request/response for LLM extraction (POC acceptable latency).
3. **Images AND PDFs** — The spec says "PDF page or image". We support image mimeTypes (jpeg/png/webp) and PDF (first page rendered as image). For POC, we focus on images first; PDF-to-image rendering is out of scope (admin uploads the relevant page as an image).
4. **Existing `extractFromImage`** — We reuse `src/infra/llm/services/data-extractor-service.ts` for LLM extraction, which already returns `{question, options, correctAnswer, explanation}`.
5. **Tenant auto-resolution** — The existing `tenantField` hook auto-assigns tenant on create. We pass it explicitly where needed.
6. **LessonConversionPanel** already renders per-PDF. We add a V3 button alongside existing V1/V2 buttons.
7. **The `content.blocks` format** uses the existing Zod schemas in `src/server/payload/collections/Exercises/schemas.ts`.

## Architecture Overview

```
[Admin UI: LessonConversionPanel]
    │
    ├── "Convert V3" button (per PDF/image)
    │
    ▼
[POST /api/exercises/convert/extract-v3]  ← Step 3
    │  Input: { lessonId, mediaId }
    │  1. Fetch media file buffer
    │  2. Call extractFromImage()
    │  3. Transform result → Exercise content blocks
    │  4. Return preview JSON (NOT saved yet)
    │
    ▼
[Admin UI: V3PreviewPanel]  ← Step 5
    │  Shows extracted exercise preview
    │  Admin edits question/options/answer
    │  Clicks "Create Exercise"
    │
    ▼
[POST /api/exercises/convert/create-v3]  ← Step 4
    │  Input: { lessonId, mediaId, content, title }
    │  1. Validate content against ContentSchema
    │  2. Create Exercise doc (origin: 'conversion', pipelineVersion: 3)
    │  3. Create ExtractionLog entry
    │  4. Return created exercise
    │
    ▼
[ExtractionLogs collection]  ← Step 1
```

---

## Step 1: Create ExtractionLogs Collection

**Time estimate**: 15-20 minutes
**Spec refs**: FR-EX-007, NFR-012, NFR-013

### Files to Touch

- `src/server/payload/collections/ExtractionLogs.ts` (NEW)
- `src/payload.config.ts` (MODIFIED — line ~142, add to collections array)

### Exact Behavior

Create a new Payload CMS collection `extraction-logs` with these fields:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| tenant | relationship→tenants | yes | Via `tenantField` |
| lesson | relationship→lessons | yes | Source lesson |
| media | relationship→media | yes | Source document |
| exercise | relationship→exercises | no | Created exercise (linked after creation) |
| prompt | relationship→prompts | no | Prompt used for extraction |
| pipelineVersion | number | yes | Always `3` for V3 |
| status | select | yes | `success` / `failed` |
| rawResponse | textarea | no | Raw LLM response string |
| parsedJson | json | no | Parsed extraction result |
| errorMessage | text | no | Error message if failed |
| processingTimeMs | number | no | Time taken |

**Access Control** (NFR-012):
- `create`: Server-only — use a custom function that always returns `false` (creation via hooks/Local API with `overrideAccess: true`)
- `read`: `adminOnly`
- `update`: Always `false` (append-only)
- `delete`: Always `false` (immutable)

### Tests (FAIL before, PASS after)

**Test file**: `tests/unit/collections/extraction-logs-schema.spec.ts` (NEW)

1. **Test: ExtractionLogs collection config has correct access control**
   - Import the collection config
   - Assert `access.create` returns `false` for any user
   - Assert `access.read` returns `true` for admin user, `false` for non-admin
   - Assert `access.update` returns `false` for any user
   - Assert `access.delete` returns `false` for any user

2. **Test: ExtractionLogs collection has required fields**
   - Import the collection config
   - Assert fields include: `tenant`, `lesson`, `media`, `exercise`, `prompt`, `pipelineVersion`, `status`, `rawResponse`, `parsedJson`, `errorMessage`, `processingTimeMs`
   - Assert `status` options are `['success', 'failed']`

### Acceptance Criteria

- [ ] Collection registered in `payload.config.ts`
- [ ] `tenantField` included for multi-tenancy (NFR-013)
- [ ] Access control: create=false, read=adminOnly, update=false, delete=false
- [ ] All fields from spec present with correct types
- [ ] Unit tests pass

---

## Step 2: Create LLM Result → Exercise Content Transformer

**Time estimate**: 20-30 minutes
**Spec refs**: FR-EX-001

### Files to Touch

- `src/infra/llm/services/exercise-transformer.ts` (NEW)

### Exact Behavior

Pure function that transforms `ImageToExerciseResult` → `ExerciseContent` (Zod-validated):

```typescript
interface TransformInput {
  question: string
  options: string[]
  correctAnswer: number | null
  explanation?: string
}

interface TransformOutput {
  content: { blocks: ContentBlock[] }
  title: string // First 80 chars of question
}
```

**Logic**:
1. If `options` array has ≥2 items → generate `question_select` block (variant: `mcq`)
   - Each option gets a unique ID (`opt-0`, `opt-1`, etc.)
   - Options wrapped in McqOption format with InlineRichText
   - `correctOptionIds`: `[options[correctAnswer].id]` if correctAnswer is not null, else `[options[0].id]` (fallback)
   - `selectionMode`: `'single'`
2. If `options` is empty/missing → generate `question_free_response` block
   - `acceptedAnswers`: `[String(correctAnswer)]` if correctAnswer exists, else `['']`
3. Prompt text → `InlineRichText` with `format: 'md-math-v1'`, `value: question`
4. If explanation exists → add as `hint` InlineRichText on the question block
5. Generate title: first 80 chars of question text (strip markdown)
6. All blocks get unique IDs via `generateId()`
7. Validate output against `ContentSchema` — throw if invalid

### Tests (FAIL before, PASS after)

**Test file**: `tests/unit/services/exercise-transformer.spec.ts` (NEW)

1. **Test: transforms MCQ extraction to question_select block**
   - Input: `{ question: "What is 2+2?", options: ["3", "4", "5", "6"], correctAnswer: 1 }`
   - Assert: output has `content.blocks[0].type === 'question_select'`
   - Assert: `blocks[0].variant === 'mcq'`
   - Assert: `blocks[0].answer.options` has 4 items with correct InlineRichText
   - Assert: `blocks[0].answer.correctOptionIds` contains the ID of option at index 1
   - Assert: output validates against `ContentSchema`

2. **Test: transforms free response extraction to question_free_response block**
   - Input: `{ question: "Solve for x: 2x = 10", options: [], correctAnswer: 5 }`
   - Assert: output has `content.blocks[0].type === 'question_free_response'`
   - Assert: `blocks[0].answer.acceptedAnswers` includes `"5"`
   - Assert: output validates against `ContentSchema`

3. **Test: handles null correctAnswer gracefully**
   - Input: `{ question: "What color is the sky?", options: ["Blue", "Red"], correctAnswer: null }`
   - Assert: output still validates against `ContentSchema`
   - Assert: `blocks[0].answer.correctOptionIds` defaults to first option ID

4. **Test: includes explanation as hint when present**
   - Input: `{ question: "Q?", options: ["A", "B"], correctAnswer: 0, explanation: "Because A is correct" }`
   - Assert: `blocks[0].hint.value === "Because A is correct"`

5. **Test: generates valid title from question text**
   - Input: question with 200 characters
   - Assert: title is ≤80 characters

### Acceptance Criteria

- [ ] MCQ input produces valid `question_select` (variant `mcq`) block
- [ ] Free-response input produces valid `question_free_response` block
- [ ] `null` correctAnswer doesn't crash — falls back gracefully
- [ ] Explanation maps to `hint` field
- [ ] All outputs validate against `ContentSchema.safeParse()`
- [ ] Unit tests pass

---

## Step 3: Create Extract V3 API Endpoint

**Time estimate**: 20-30 minutes
**Spec refs**: FR-EX-002, FR-EX-003, FR-EX-004 (extraction part)

### Files to Touch

- `src/app/api/exercises/convert/extract-v3/route.ts` (NEW)

### Exact Behavior

**`POST /api/exercises/convert/extract-v3`**

**Request body** (Zod validated):
```json
{
  "lessonId": "string",
  "mediaId": "string"
}
```

**Auth**: Admin session OR test secret (reuse `requireAdminOrTestSecret`)

**Flow**:
1. Validate request body with Zod
2. Auth check → 401 if fails
3. Fetch lesson → 404 if not found
4. Verify `mediaId` is in `lesson.contentFiles` → 400 if not
5. Fetch media document to get URL/buffer
6. Download the image/file buffer (from media URL)
7. Call `extractFromImage({ imageBuffer, mimeType }, payload)`
8. If extraction fails → return `{ success: false, error: "..." }` with 422
9. Transform result using `transformExtractionToContent()` from Step 2
10. Return preview JSON:
```json
{
  "success": true,
  "preview": {
    "title": "Generated title",
    "content": { "blocks": [...] },
    "rawExtraction": { "question": "...", "options": [...], "correctAnswer": 0 }
  },
  "metadata": {
    "model": "...",
    "processingTimeMs": 123
  }
}
```

**Status codes**: 200 (success), 400 (validation), 401 (auth), 404 (lesson not found), 422 (extraction failed), 500 (internal)

### Tests (FAIL before, PASS after)

**Test file**: `tests/int/v3-extract-api.int.spec.ts` (NEW)

1. **Test: returns 401 when no auth provided**
   - POST to `/api/exercises/convert/extract-v3` with no auth header
   - Assert: response status 401

2. **Test: returns 400 for invalid request body**
   - POST with auth but empty body
   - Assert: response status 400, error code `VALIDATION_ERROR`

3. **Test: returns 404 for non-existent lesson**
   - POST with auth, `{ lessonId: "nonexistent", mediaId: "some-id" }`
   - Assert: response status 404

**Note**: Full extraction test requires mocked LLM — covered in unit test for transformer (Step 2). Integration test focuses on HTTP contract.

### Acceptance Criteria

- [ ] Endpoint exists at `/api/exercises/convert/extract-v3`
- [ ] Returns 401 for unauthenticated requests
- [ ] Returns 400 for invalid input
- [ ] Returns 404 for missing lesson
- [ ] Returns 400 if media not attached to lesson
- [ ] Returns preview JSON on success (not saved to DB yet)
- [ ] Integration tests pass

---

## Step 4: Create Exercise V3 API Endpoint (Create + Log)

**Time estimate**: 20-30 minutes
**Spec refs**: FR-EX-004 (creation part), FR-EX-005, FR-EX-007

### Files to Touch

- `src/app/api/exercises/convert/create-v3/route.ts` (NEW)

### Exact Behavior

**`POST /api/exercises/convert/create-v3`**

**Request body** (Zod validated):
```json
{
  "lessonId": "string",
  "mediaId": "string",
  "title": "string",
  "content": { "blocks": [...] },
  "rawExtraction": { ... },
  "metadata": { "model": "...", "processingTimeMs": 123 }
}
```

**Auth**: Admin session OR test secret

**Flow**:
1. Validate request body (content validated against `ContentSchema`)
2. Auth check → 401
3. Fetch lesson → get tenant ID
4. Create Exercise via `payload.create`:
   - `collection: 'exercises'`
   - `data.title`: from request
   - `data.lesson`: lessonId
   - `data.content`: from request (already validated)
   - `data.origin`: `'conversion'`
   - `data.pipelineVersion`: `3`
   - `data.sourceDoc`: mediaId
   - `data.tenant`: lesson's tenant ID
5. Create ExtractionLog via `payload.create`:
   - `collection: 'extraction-logs'`
   - `data.lesson`: lessonId
   - `data.media`: mediaId
   - `data.exercise`: created exercise ID
   - `data.pipelineVersion`: `3`
   - `data.status`: `'success'`
   - `data.rawResponse`: JSON.stringify(rawExtraction)
   - `data.parsedJson`: content
   - `data.processingTimeMs`: from metadata
   - `data.tenant`: lesson's tenant ID
   - Uses `overrideAccess: true` (since access.create = false)
6. Return:
```json
{
  "success": true,
  "exerciseId": "...",
  "exerciseSlug": "...",
  "logId": "..."
}
```

**Status codes**: 200, 400, 401, 404, 500

### Tests (FAIL before, PASS after)

**Test file**: `tests/int/v3-create-api.int.spec.ts` (NEW)

1. **Test: returns 401 when no auth provided**
   - POST to `/api/exercises/convert/create-v3` with no auth
   - Assert: status 401

2. **Test: returns 400 for invalid content schema**
   - POST with auth but `content: { blocks: [] }` (empty blocks array fails Zod min(1))
   - Assert: status 400

3. **Test: creates exercise with correct metadata fields**
   - (Requires running Payload instance with DB)
   - POST with valid content, lessonId, mediaId
   - Assert: created exercise has `origin: 'conversion'`, `pipelineVersion: 3`, `sourceDoc: mediaId`
   - Assert: ExtractionLog created with `status: 'success'`

### Acceptance Criteria

- [ ] Endpoint exists at `/api/exercises/convert/create-v3`
- [ ] Exercise created with `origin: 'conversion'`, `pipelineVersion: 3`
- [ ] Exercise linked to source media via `sourceDoc`
- [ ] ExtractionLog created with raw response and parsed content
- [ ] ExtractionLog links to created exercise
- [ ] Tenant ID propagated from lesson to exercise and log
- [ ] Integration tests pass

---

## Step 5: Create V3 Admin UI Components

**Time estimate**: 25-30 minutes
**Spec refs**: FR-EX-004, FR-EX-006

### Files to Touch

- `src/ui/admin/exercise-conversion/ConvertV3Button/index.tsx` (NEW)
- `src/ui/admin/exercise-conversion/V3PreviewPanel/index.tsx` (NEW)
- `src/ui/admin/exercise-conversion/LessonConversionPanel/index.tsx` (MODIFIED — add V3 button ~line 207)

### Exact Behavior

#### ConvertV3Button
- Client component (`'use client'`)
- Props: `{ lessonId: string, mediaId: string }`
- On click: calls `POST /api/exercises/convert/extract-v3` with `{ lessonId, mediaId }`
- Shows loading spinner while waiting
- On success: renders `V3PreviewPanel` with the returned preview data
- On error: shows error message

#### V3PreviewPanel
- Client component (`'use client'`)
- Props: `{ preview, metadata, lessonId, mediaId, onClose, onSuccess }`
- Displays:
  - Question text (editable textarea)
  - Options list (editable, add/remove)
  - Correct answer selector (radio/checkbox)
  - Explanation/hint (editable textarea)
  - Raw JSON accordion (collapsed by default)
- "Create Exercise" button → calls `POST /api/exercises/convert/create-v3`
- On success: shows success message, calls `onSuccess`
- Validates content locally before sending (ContentSchema)

#### LessonConversionPanel Modification
- Add `<ConvertV3Button>` alongside existing V1/V2 buttons (~line 207)
- Also support **image** files (not just PDFs) — filter for `application/pdf`, `image/jpeg`, `image/png`, `image/webp`

### Tests (FAIL before, PASS after)

**Test file**: `tests/unit/ui/convert-v3-button.spec.ts` (NEW) — basic render test

1. **Test: ConvertV3Button renders without crashing**
   - Render component with valid props
   - Assert: button with text "Convert (V3)" exists

2. **Test: LessonConversionPanel includes V3 button for image files**
   - (This is harder to test without full Payload context — verify at integration level)
   - Alternatively: verify the component file imports `ConvertV3Button`

### Acceptance Criteria

- [ ] "Convert (V3)" button appears in LessonConversionPanel for each PDF/image
- [ ] Clicking button triggers extraction API call
- [ ] Preview panel shows extracted exercise data
- [ ] Admin can edit question, options, correct answer in preview
- [ ] "Create Exercise" button creates the exercise via API
- [ ] No exercise created without preview/edit step (FR-EX-004 rule)
- [ ] Success/error states displayed correctly

---

## Step 6: Generate Types and Import Map

**Time estimate**: 5-10 minutes
**Spec refs**: General

### Files to Touch

- `src/payload-types.ts` (MODIFIED — auto-generated)
- `src/app/(payload)/admin/importMap.js` (MODIFIED — auto-generated)

### Exact Behavior

1. Run `pnpm generate:types` to update `payload-types.ts` with ExtractionLogs types
2. Run `pnpm generate:importmap` to update admin import map with new components
3. Run `pnpm tsc --noEmit` to verify no type errors

### Tests (FAIL before, PASS after)

1. **Test: TypeScript compilation succeeds**
   - Run `pnpm tsc --noEmit`
   - Assert: exit code 0

2. **Test: ExtractionLog type exists in payload-types.ts**
   - Grep for `ExtractionLog` in `src/payload-types.ts`
   - Assert: type definition found

### Acceptance Criteria

- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes
- [ ] ExtractionLog types generated
- [ ] Import map updated with new admin components

---

## Dependency Graph

```
Step 1 (ExtractionLogs collection)
    │
    ├── Step 2 (Transformer) — independent of Step 1
    │       │
    │       ├── Step 3 (Extract API) — depends on Step 2
    │       │
    │       └── Step 4 (Create API) — depends on Steps 1 + 2
    │               │
    │               └── Step 5 (UI) — depends on Steps 3 + 4
    │
    └── Step 6 (Types/Import Map) — depends on Steps 1 + 5
```

**Recommended execution order**: 1 → 2 → 3 → 4 → 5 → 6

---

## Quality Gates (run after each step)

```bash
# After Step 1:
pnpm vitest run tests/unit/collections/extraction-logs-schema.spec.ts
pnpm tsc --noEmit

# After Step 2:
pnpm vitest run tests/unit/services/exercise-transformer.spec.ts

# After Step 3:
pnpm vitest run tests/int/v3-extract-api.int.spec.ts

# After Step 4:
pnpm vitest run tests/int/v3-create-api.int.spec.ts

# After Step 5:
pnpm vitest run tests/unit/ui/convert-v3-button.spec.ts

# After Step 6 (final):
pnpm tsc --noEmit
pnpm lint
```

---

## Risk Mitigation

1. **LLM flakiness**: The extract endpoint may fail due to LLM issues. The UI shows clear error states. ExtractionLogs records failures.
2. **ContentSchema validation**: The transformer is the riskiest piece — must produce valid blocks. Extensive unit tests in Step 2 mitigate this.
3. **Media file access**: Need to fetch file buffer from Vercel Blob URL. If media is a Payload upload, we can use `media.url` to fetch it.
4. **PDF support**: For POC, we support images directly. PDF → image conversion is out of scope; admin should upload relevant page as image or use existing V1/V2 for PDFs.

---

## Expert Review Feedback (Applied)

### Payload Expert Review

1. **Access control pattern confirmed**: `create: () => false` + `overrideAccess: true` is proven in `ConfigAuditLogs.ts` and `MCPAuditLogs.ts`. No issues.
2. **Non-atomic creates in Step 4**: The two `payload.create` calls (Exercise + ExtractionLog) in the API route are NOT transactional. **Accepted for POC** — if ExtractionLog fails, log the error but still return the created exercise. Wrap the log creation in try/catch.
3. **tenantField works correctly**: When tenant is passed explicitly, the hook returns early without interfering. Collection should import `tenantField` for field definition/index, AND the API route should pass tenant explicitly.
4. **Use `adminOnly` from `@/server/payload/access/adminOnly`** (not `configAdminOnly`) — matches MCPAuditLogs pattern.
5. **Add `timestamps: true`** to ExtractionLogs collection explicitly.
6. **`type: 'json'` for `parsedJson`** is correct — used throughout codebase (Exercises `content`, MCPAuditLogs `args`).

### Admin Expert Review

1. **No importmap needed for V3 UI components** — they're runtime imports within `LessonConversionPanel`, just like `ConvertV2Button`. Step 6's importmap regen is for the new ExtractionLogs collection.
2. **V3PreviewPanel must use Payload CSS variables** (e.g., `var(--theme-primary)`, `var(--theme-elevation-*)`) and inline `React.CSSProperties`. **NO Tailwind, NO shadcn/ui** in admin panel components.
3. **Image support strategy**: Use **option (b)** — add a SEPARATE "Image Files" section below the existing PDF section in `LessonConversionPanel`. Do NOT modify the existing PDF filter/loop. This prevents breaking V1/V2 flows.

### Build Agent Guidance (Key Implementation Notes)

- **Step 1**: Import `adminOnly` from `'@/server/payload/access/adminOnly'`. Add `timestamps: true` to collection config. Use `never` function pattern: `() => false` for create/update/delete access.
- **Step 4**: Wrap ExtractionLog creation in try/catch — don't let log failure prevent returning the created exercise.
- **Step 5**: 
  - In `LessonConversionPanel`, add a NEW section after the PDF loop (after line 250) for image files: `const imageFiles = mediaItems.filter((m) => m.mimeType?.startsWith('image/'))`. Only show the V3 button for images (V1/V2 remain PDF-only).
  - For PDFs in the existing loop, ADD the V3 button alongside V1/V2 buttons.
  - Style all new components with inline `React.CSSProperties` using `var(--theme-*)` CSS variables. NO Tailwind utilities.
