# Plan: V3 POC — Exercise Generation from Document

## Assumptions (Validated Against Codebase)

1. Existing conversion UI lives in `src/ui/admin/exercise-conversion/LessonConversionPanel/index.tsx` and currently filters to PDFs only.
2. Existing exercise creation pattern uses `ExerciseBlockDefaults` + Zod block schemas from `src/server/payload/collections/Exercises/*`.
3. `Prompts` collection has no explicit version field; `promptVersion` in logs will be nullable unless provided by future prompt versioning.
4. Vercel-safe PDF handling must avoid `@napi-rs/canvas` (current V2 renderer uses it and cannot be reused for V3).
5. V3 remains synchronous and preview-first (no queue, no auto-create).

---

## Step 1: Add `ExtractionLogs` Collection

**Spec refs**: FR-LOG-001, FR-LOG-002, GR-003

**Files**:
- `src/server/payload/collections/ExtractionLogs.ts` (NEW)
- `src/payload.config.ts` (MODIFIED)

**Implementation**:
- Create `extraction-logs` collection with fields aligned to spec:
  - `rawLLMResponse` (textarea)
  - `parsedPayload` (json)
  - `status` (`success | failed`, select, required)
  - `lesson` (relationship → `lessons`)
  - `media` (relationship → `media`)
  - `promptId` (relationship → `prompts`, nullable)
  - `promptVersion` (number, nullable)
  - `stage` (text, required; values written by service: `init|fetched|extracted|parsed|created|failed`)
  - `errorMessage` (textarea, nullable)
- Access pattern (immutable from client): `create:false`, `update:false`, `read:adminOnly`, `delete:adminOnly`.
- Admin config: `useAsTitle: 'stage'`, `group: 'System'`.
- Register in `collections` array in `src/payload.config.ts`.

**Tests**:
- `tests/int/extraction-logs.int.spec.ts` (NEW)
  1. server-side create/update works with `overrideAccess: true`
  2. client create/update denied with `overrideAccess: false`
  3. admin read allowed; non-admin read denied

**Gate**: `pnpm generate:types`

---

## Step 2: Implement V3 Extraction Service + Stage Logging

**Spec refs**: FR-API-001, FR-DATA-001, FR-LOG-002, FR-PDF-001, GR-001, GR-003

**Files**:
- `src/server/services/exercise-conversion/v3/types.ts` (NEW)
- `src/server/services/exercise-conversion/v3/log-extraction.ts` (NEW)
- `src/server/services/exercise-conversion/v3/extract-exercise.ts` (NEW)

**Implementation**:
- Define preview contract:
  - `question: string`
  - `options: string[] | null`
  - `correctAnswer: number | null`
  - `explanation: string | null`
  - `blockType: 'question_free_response' | 'question_select'`
- `log-extraction.ts` helpers accept optional `req` and pass it to nested Payload operations for transaction safety:
  - `createExtractionLog(payload, data, req?)`
  - `updateExtractionLog(payload, id, updates, req?)`
- `extractExerciseV3(payload, lessonId, mediaId, req?)` flow:
  1. create log (`stage=init`, `status=success`)
  2. fetch + validate media (`application/pdf` or `image/*`) and update `stage=fetched`
  3. fetch file buffer from media URL
  4. call multimodal provider (Vercel-safe path; no native canvas) and capture raw LLM text
  5. update log `stage=extracted`, save `rawLLMResponse`
  6. parse/normalize to preview schema; allow `correctAnswer: null`
  7. derive `blockType` from options presence and update log `stage=parsed`, save `parsedPayload`
  8. return preview + `logId`
  9. on any error: update log `stage=failed`, `status=failed`, `errorMessage`
- Prompt metadata logging:
  - set `promptId` if a concrete prompt is selected/resolved
  - set `promptVersion` when available; otherwise `null`

**Tests**:
- `tests/unit/services/v3-extract-exercise.spec.ts` (NEW)
  1. image path returns parsed preview + parsed-stage log
  2. PDF path returns parsed preview + extracted raw response log
  3. failure path writes failed stage with error message

**Gate**: `pnpm -s test:unit tests/unit/services/v3-extract-exercise.spec.ts`

---

## Step 3: Add Convert Endpoint (`/api/exercises/convert/v3`)

**Spec refs**: FR-API-001, FR-DATA-001, GR-002

**Files**:
- `src/app/api/exercises/convert/v3/route.ts` (NEW)

**Implementation**:
- `POST` endpoint using `withApiHandler({ auth: 'adminOrTest' })`.
- Zod body: `{ lessonId: string, mediaId: string }`.
- Calls `extractExerciseV3(payload, lessonId, mediaId)`.
- Returns preview payload + `logId` only (no exercise creation).
- Ensure error mapping:
  - 400 validation
  - 401 auth
  - 500 extraction errors

**Tests**:
- `tests/int/v3-extraction-api.int.spec.ts` (NEW)
  1. 401 without auth
  2. 400 invalid body
  3. 200 with preview + `logId`
  4. assert no exercise document is created by convert endpoint

**Gate**: `pnpm -s test:int tests/int/v3-extraction-api.int.spec.ts`

---

## Step 4: Add Create-from-Preview Endpoint (`/api/exercises/create-from-preview`)

**Spec refs**: FR-API-002, GR-002

**Files**:
- `src/app/api/exercises/create-from-preview/route.ts` (NEW)

**Implementation**:
- `POST` with `withApiHandler({ auth: 'adminOrTest' })`.
- Zod body:
  - `lessonId`, `mediaId`, `logId` (required)
  - `question`, `options`, `correctAnswer`, `explanation`, `blockType`
  - `acceptedAnswerText` (nullable; used for free-response correctness editing)
- Create block using `ExerciseBlockDefaults` + schema parse:
  - **MCQ**:
    - use `question_mcq()` default
    - override `selectionMode='single'`, `answer.multiSelect=false`
    - map options to IDs
    - if `correctAnswer` is null/invalid, default to first option ID (schema requires one correct option)
  - **Free response**:
    - use `question_free_response()`
    - set prompt
    - set `acceptedAnswers` from `acceptedAnswerText` (fallback to non-empty explanation sentinel)
- Create exercise as published demo artifact (no draft flag), including conversion metadata:
  - `origin: 'conversion'`
  - `sourceDoc: mediaId`
- Update corresponding log to `stage=created` on successful create.

**Tests**:
- `tests/int/v3-create-from-preview.int.spec.ts` (NEW)
  1. MCQ create with explicit `correctAnswer`
  2. MCQ create with `correctAnswer=null` defaults to first option
  3. free-response create uses edited `acceptedAnswerText`
  4. created log stage is `created`

**Gate**: `pnpm -s test:int tests/int/v3-create-from-preview.int.spec.ts`

---

## Step 5: Add Admin `ConvertV3Button`

**Spec refs**: FR-UI-001

**Files**:
- `src/ui/admin/exercise-conversion/ConvertV3Button/index.tsx` (NEW)

**Implementation**:
- Client component with label **"Convert V3"**.
- Sends `POST /api/exercises/convert/v3`.
- Handles loading and inline error state.
- On success passes preview + `logId` to parent.

**Tests**:
- `tests/unit/ui/convert-v3-button.test.ts` (NEW)
  1. label and loading state
  2. success callback payload
  3. error rendering

---

## Step 6: Add Admin `PreviewEditModal`

**Spec refs**: FR-UI-002, GR-002

**Files**:
- `src/ui/admin/exercise-conversion/PreviewEditModal/index.tsx` (NEW)

**Implementation**:
- Client modal for preview/edit before create:
  - editable question
  - editable MCQ options
  - editable correct answer selection
  - editable free-response accepted answer text
  - editable explanation
- Actions:
  - **Create Exercise** → `/api/exercises/create-from-preview`
  - **Cancel** → closes without creation
- UX constraints:
  - full-screen overlay (`inset:0`, high z-index)
  - Escape-to-close + scroll lock

**Tests**:
- `tests/unit/ui/preview-edit-modal.test.ts` (NEW)
  1. renders editable initial data
  2. posts edited payload on create
  3. cancel closes without API call

---

## Step 7: Integrate Into `LessonConversionPanel`

**Spec refs**: FR-UI-001, FR-UI-002

**Files**:
- `src/ui/admin/exercise-conversion/LessonConversionPanel/index.tsx` (MODIFIED)

**Implementation**:
- Expand media filter from PDFs-only to PDFs + images for V3.
- Keep V1/V2 controls for PDFs only (regression-safe).
- Add `ConvertV3Button` for PDFs and images.
- Add preview modal state and create-success handling.
- Update empty-state copy from “No PDFs attached” to media-aware text.

**Tests**:
- `tests/unit/ui/lesson-conversion-panel-v3.test.ts` (NEW)
  1. V3 button appears for PDF and image items
  2. V1/V2 remain PDF-only
  3. preview modal opens on V3 success

---

## Step 8: Integration + Regression Verification

**Spec refs**: Acceptance Criteria

**Files**:
- `tests/int/v3-end-to-end.int.spec.ts` (NEW)

**Implementation/tests**:
1. image flow: convert → preview edit → create
2. PDF flow: convert → preview edit → create
3. failed extraction path writes failed log
4. created exercises validate against exercise block schema and include conversion metadata
5. smoke regression assertion for existing V2 queue/status routes still returning expected shape

**Gate**:
- `pnpm -s test:int tests/int/v3-end-to-end.int.spec.ts`
- `pnpm -s test:int tests/int/v2-queue-api.int.spec.ts`
- `pnpm -s test:int tests/int/v2-status-api.int.spec.ts`

---

## Step 9: Final Quality + Manual POC Checklist

**Spec refs**: Verification Checklist

**Commands**:
- `pnpm generate:types`
- `pnpm -s tsc --noEmit`
- `pnpm -s lint`

**Manual checks in preview environment**:
- Test at least **2 PDFs** + **3 images**
- Confirm **5 successful end-to-end conversions**
- Record **1 failed sample** and verify `ExtractionLogs` quality (stage + errorMessage + raw/parsed payload)

---

## File Summary

| File | Status |
|------|--------|
| `src/server/payload/collections/ExtractionLogs.ts` | NEW |
| `src/payload.config.ts` | MODIFIED |
| `src/server/services/exercise-conversion/v3/types.ts` | NEW |
| `src/server/services/exercise-conversion/v3/log-extraction.ts` | NEW |
| `src/server/services/exercise-conversion/v3/extract-exercise.ts` | NEW |
| `src/app/api/exercises/convert/v3/route.ts` | NEW |
| `src/app/api/exercises/create-from-preview/route.ts` | NEW |
| `src/ui/admin/exercise-conversion/ConvertV3Button/index.tsx` | NEW |
| `src/ui/admin/exercise-conversion/PreviewEditModal/index.tsx` | NEW |
| `src/ui/admin/exercise-conversion/LessonConversionPanel/index.tsx` | MODIFIED |
| `tests/int/extraction-logs.int.spec.ts` | NEW |
| `tests/unit/services/v3-extract-exercise.spec.ts` | NEW |
| `tests/int/v3-extraction-api.int.spec.ts` | NEW |
| `tests/int/v3-create-from-preview.int.spec.ts` | NEW |
| `tests/unit/ui/convert-v3-button.test.ts` | NEW |
| `tests/unit/ui/preview-edit-modal.test.ts` | NEW |
| `tests/unit/ui/lesson-conversion-panel-v3.test.ts` | NEW |
| `tests/int/v3-end-to-end.int.spec.ts` | NEW |
