# Build Plan: V3 POC — Exercise Generation from Document

## Task ID: 260302-auto-66

---

## Overview

Implement a V3 synchronous, preview-first exercise generation flow that converts one uploaded document (PDF page or image) into one interactive exercise. The flow goes: Upload → Convert V3 → Preview/Edit → Create Exercise. This is distinct from V1 (text extraction queue) and V2 (image crop queue) — V3 is synchronous and uses a single LLM pass.

---

## Step 1: Create `ExtractionLogs` Collection

**Spec refs**: FR-LOG-001, FR-LOG-002, GR-003

### Files to Create
- `src/server/payload/collections/ExtractionLogs.ts` (NEW)

### Files to Modify
- `src/payload.config.ts` (ADD import + register in collections array)

### Implementation Details

Create a new Payload collection `extraction-logs`:

```typescript
// src/server/payload/collections/ExtractionLogs.ts
import type { CollectionConfig } from 'payload'
import { adminOnly } from '../access/adminOnly'
import { tenantField } from '../fields/tenant'

export const ExtractionLogs: CollectionConfig = {
  slug: 'extraction-logs',
  admin: {
    useAsTitle: 'stage',
    group: 'System',
    defaultColumns: ['status', 'stage', 'lesson', 'createdAt'],
  },
  access: {
    create: () => false,    // Only server-side via overrideAccess: true
    update: () => false,    // Immutable from client
    read: adminOnly,
    delete: adminOnly,
  },
  fields: [
    tenantField,
    {
      name: 'rawLLMResponse',
      type: 'textarea',
      admin: { description: 'Raw response string from LLM' },
    },
    {
      name: 'parsedPayload',
      type: 'json',
      admin: { description: 'Parsed exercise data (preview schema)' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Success', value: 'success' },
        { label: 'Failed', value: 'failed' },
      ],
      admin: { description: 'Overall extraction status' },
    },
    {
      name: 'lesson',
      type: 'relationship',
      relationTo: 'lessons',
      index: true,
      admin: { description: 'Source lesson' },
    },
    {
      name: 'media',
      type: 'relationship',
      relationTo: 'media',
      admin: { description: 'Source media file' },
    },
    {
      name: 'promptId',
      type: 'relationship',
      relationTo: 'prompts',
      admin: { description: 'Prompt used for extraction (if any)' },
    },
    {
      name: 'promptVersion',
      type: 'number',
      admin: { description: 'Version of prompt used' },
    },
    {
      name: 'stage',
      type: 'text',
      required: true,
      admin: { description: 'Current pipeline stage: init|fetched|extracted|parsed|created|failed' },
    },
    {
      name: 'errorMessage',
      type: 'textarea',
      admin: { description: 'Error details if failed' },
    },
  ],
  timestamps: true,
}
```

**Modify `src/payload.config.ts`:**
- Add import: `import { ExtractionLogs } from '@/server/payload/collections/ExtractionLogs'`
- Add `ExtractionLogs` to the `collections` array (after `MCPAuditLogs`)

### Verification
```bash
pnpm generate:types
pnpm -s tsc --noEmit
```

---

## Step 2: Create V3 Extraction Service + Stage Logging

**Spec refs**: FR-API-001, FR-DATA-001, FR-LOG-002, FR-PDF-001, GR-001, GR-003

### Files to Create
- `src/server/services/exercise-conversion/v3/types.ts` (NEW)
- `src/server/services/exercise-conversion/v3/log-extraction.ts` (NEW)
- `src/server/services/exercise-conversion/v3/extract-exercise.ts` (NEW)

### Implementation Details

#### `types.ts` — Preview Data Contract

```typescript
// src/server/services/exercise-conversion/v3/types.ts
export interface V3PreviewData {
  question: string
  options: string[] | null
  correctAnswer: number | null   // 0-based index into options array
  explanation: string | null
  blockType: 'question_free_response' | 'question_select'
}

export interface V3ExtractionResult {
  preview: V3PreviewData
  logId: string
}
```

#### `log-extraction.ts` — Logging Helpers

```typescript
// src/server/services/exercise-conversion/v3/log-extraction.ts
import type { Payload, PayloadRequest } from 'payload'

export async function createExtractionLog(
  payload: Payload,
  data: {
    lesson: string
    media: string
    stage: string
    status: 'success' | 'failed'
    rawLLMResponse?: string
    parsedPayload?: unknown
    promptId?: string
    promptVersion?: number
    errorMessage?: string
  },
  req?: PayloadRequest,
) {
  return payload.create({
    collection: 'extraction-logs',
    data,
    overrideAccess: true,
    ...(req && { req }),
  })
}

export async function updateExtractionLog(
  payload: Payload,
  id: string,
  updates: {
    stage?: string
    status?: 'success' | 'failed'
    rawLLMResponse?: string
    parsedPayload?: unknown
    errorMessage?: string
  },
  req?: PayloadRequest,
) {
  return payload.update({
    collection: 'extraction-logs',
    id,
    data: updates,
    overrideAccess: true,
    ...(req && { req }),
  })
}
```

#### `extract-exercise.ts` — Main Extraction Flow

**Flow:**
1. **Init**: Create extraction log with `stage='init'`, `status='success'`
2. **Fetch media**: Use `payload.findByID({ collection: 'media', id: mediaId })` to get media doc. Validate `mimeType` is `application/pdf` or `image/*`. Update log to `stage='fetched'`.
3. **Fetch file buffer**: Fetch from `media.url` (the Vercel Blob URL). Convert to Buffer.
4. **PDF handling**: Send the raw PDF buffer base64 to the LLM directly (Gemini supports PDF natively). No `@napi-rs/canvas` needed. This is Vercel-safe.
5. **LLM call**: Use the existing unified provider pattern:
   ```typescript
   const provider = await getLLMProvider(payload)
   const providerType = await getProviderTypeFromEnv(payload)
   const modelConfig = getProviderModelConfig(providerType, 'PDF_TO_EXERCISE')
   
   const result = await provider.generateMultimodalCompletion({
     prompt: V3_EXTRACTION_PROMPT,
     model: modelConfig,
     attachments: [{ data: base64Data, mimeType }],
   }, payload)
   ```
6. **Update log**: `stage='extracted'`, save `rawLLMResponse`
7. **Parse**: Parse JSON from LLM response text. Extract: question, options, correctAnswer, explanation. Derive `blockType` from whether options are present.
8. **Update log**: `stage='parsed'`, save `parsedPayload`
9. **Return**: `{ preview, logId }`
10. **Error handling**: On any error, update log to `stage='failed'`, `status='failed'`, `errorMessage=error.message`

**V3 Extraction Prompt** (embedded in the service file):
```
You are analyzing a math exercise document. Extract exactly ONE exercise from this document.

Return ONLY a JSON object with these fields:
{
  "question": "The full exercise prompt/question text. Include all mathematical notation using LaTeX.",
  "options": ["Option A text", "Option B text", "Option C text", "Option D text"] or null,
  "correctAnswer": 0,
  "explanation": "Step-by-step solution explanation" or null
}

Rules:
- "question": The full question text. If the document has multiple exercises, extract only the FIRST one.
- "options": Array of answer choices if this is a multiple-choice question. null if it's a free-response question.
- "correctAnswer": 0-based index of the correct option. null if not detectable or if free-response.
- "explanation": Brief explanation of the solution if detectable. null if not.
- Use LaTeX notation for all math: inline $...$ and display $$...$$
- Return raw JSON only. No markdown formatting, no code blocks.
```

**Key Design Decisions:**
- PDF files are sent directly as base64 to Gemini (it supports PDF natively) — no PDF-to-image conversion needed, avoiding the `@napi-rs/canvas` issue entirely.
- Uses the existing `getLLMProvider` / `getProviderModelConfig` pattern for model resolution.
- The `PDF_TO_EXERCISE` model key already exists in `MODEL_REGISTRY`.

### Verification
```bash
pnpm -s tsc --noEmit
```

---

## Step 3: Create Convert V3 Endpoint

**Spec refs**: FR-API-001, FR-DATA-001, GR-002

### Files to Create
- `src/app/api/exercises/convert/v3/route.ts` (NEW)

### Implementation Details

```typescript
// src/app/api/exercises/convert/v3/route.ts
import { z } from 'zod'
import { withApiHandler } from '@/server/api/with-api-handler'
import { apiSuccess, ApiErrors } from '@/server/api/responses'
import { extractExerciseV3 } from '@/server/services/exercise-conversion/v3/extract-exercise'

const bodySchema = z.object({
  lessonId: z.string().min(1),
  mediaId: z.string().min(1),
})

export const POST = withApiHandler(
  { auth: 'adminOrTest', bodySchema },
  async ({ payload, body, logger }) => {
    try {
      const result = await extractExerciseV3(payload, body.lessonId, body.mediaId)
      return apiSuccess(result)
    } catch (error) {
      logger.error({ error }, 'V3 extraction failed')
      return ApiErrors.internal(
        error instanceof Error ? error.message : 'Extraction failed'
      )
    }
  },
)
```

**Behavior:**
- `POST /api/exercises/convert/v3` with body `{ lessonId, mediaId }`
- Returns `{ success: true, data: { preview: V3PreviewData, logId: string } }`
- Does NOT create any exercise (preview only — per GR-002)
- 401 if not admin/test
- 400 if body validation fails
- 500 if extraction fails

### Verification
```bash
pnpm -s tsc --noEmit
```

---

## Step 4: Create Create-from-Preview Endpoint

**Spec refs**: FR-API-002, GR-002

### Files to Create
- `src/app/api/exercises/create-from-preview/route.ts` (NEW)

### Implementation Details

```typescript
// src/app/api/exercises/create-from-preview/route.ts
import { z } from 'zod'
import { withApiHandler } from '@/server/api/with-api-handler'
import { apiSuccess, ApiErrors } from '@/server/api/responses'
import { generateId } from '@/server/payload/collections/Exercises/types'
import { updateExtractionLog } from '@/server/services/exercise-conversion/v3/log-extraction'

const bodySchema = z.object({
  lessonId: z.string().min(1),
  mediaId: z.string().min(1),
  logId: z.string().min(1),       // Required per Gap 2 fix
  question: z.string().min(1),
  options: z.array(z.string()).nullable(),
  correctAnswer: z.number().int().min(0).nullable(),
  explanation: z.string().nullable(),
  blockType: z.enum(['question_free_response', 'question_select']),
  acceptedAnswerText: z.string().nullable().optional(),   // Gap 5 fix
})
```

**Block Building Logic:**

For **MCQ** (`blockType === 'question_select'`):
- Generate option IDs with `generateId()` for each option string
- Build `McqOption[]` with `InlineRichText` content wrappers
- `correctAnswer`: if null or out of range, default to index 0 (first option ID). This satisfies `McqAnswerSchema` which requires exactly 1 `correctOptionIds` when `multiSelect=false`.
- Build block:
  ```typescript
  {
    id: generateId(),
    type: 'question_select',
    variant: 'mcq',
    selectionMode: 'single',       // Gap 4 fix
    prompt: { type: 'rich_text', format: 'md-math-v1', value: question, mediaIds: [] },
    answer: {
      multiSelect: false,           // Gap 4 fix
      options: mcqOptions,
      correctOptionIds: [correctOptionId],
    },
    hint: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
    solution: { type: 'rich_text', format: 'md-math-v1', value: explanation || '', mediaIds: [] },
    fullSolution: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
  }
  ```

For **Free Response** (`blockType === 'question_free_response'`):
- `acceptedAnswers`: Use `acceptedAnswerText` if provided, else `explanation` if non-empty, else fallback to `['answer']` (FreeResponseAnswerSchema requires `.min(1)` with `.min(1)` strings)
- Build block:
  ```typescript
  {
    id: generateId(),
    type: 'question_free_response',
    prompt: { type: 'rich_text', format: 'md-math-v1', value: question, mediaIds: [] },
    answer: { acceptedAnswers: [acceptedAnswer] },
    hint: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
    solution: { type: 'rich_text', format: 'md-math-v1', value: explanation || '', mediaIds: [] },
    fullSolution: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
  }
  ```

**Exercise Creation:**
```typescript
// Get lesson to resolve tenant
const lesson = await payload.findByID({ collection: 'lessons', id: body.lessonId, depth: 0 })

const exercise = await payload.create({
  collection: 'exercises',
  data: {
    title: 'V3: ' + body.question.substring(0, 50) + (body.question.length > 50 ? '...' : ''),
    lesson: body.lessonId,
    tenant: typeof lesson.tenant === 'string' ? lesson.tenant : lesson.tenant.id,
    order: 0,
    content: { blocks: [block] },
    origin: 'conversion',
    sourceDoc: body.mediaId,
    pipelineVersion: 3,
  },
  overrideAccess: true,
})
```

**After creation**: Update log to `stage='created'`

**Return**: `{ success: true, data: { exerciseId: exercise.id } }`

### Verification
```bash
pnpm -s tsc --noEmit
```

---

## Step 5: Create `ConvertV3Button` Component

**Spec refs**: FR-UI-001

### Files to Create
- `src/ui/admin/exercise-conversion/ConvertV3Button/index.tsx` (NEW)

### Implementation Details

Follow the exact pattern from `ConvertV2Button/index.tsx`:

- `'use client'` component
- Props: `{ lessonId: string, mediaId: string, onSuccess?: (preview) => void }`
- Calls `POST /api/exercises/convert/v3` with `{ lessonId, mediaId }`
- Shows loading state: "Extracting..." (synchronous, not queued)
- On success: passes `data.data` (preview + logId) to `onSuccess` callback
- On error: shows inline error text
- Button label: "Convert V3"
- Blue background (`#2563eb`) to distinguish from V1/V2 buttons
- Uses inline styles with Payload CSS variables (matching existing admin pattern)

### Verification
```bash
pnpm -s tsc --noEmit
```

---

## Step 6: Create `PreviewEditModal` Component

**Spec refs**: FR-UI-002, GR-002

### Files to Create
- `src/ui/admin/exercise-conversion/PreviewEditModal/index.tsx` (NEW)

### Implementation Details

**Component interface:**
```typescript
interface PreviewEditModalProps {
  preview: V3PreviewData
  logId: string
  lessonId: string
  mediaId: string
  onClose: () => void
  onCreated?: (exerciseId: string) => void
}
```

**Modal layout (full-screen overlay):**
- Fixed overlay with `position: fixed; inset: 0; z-index: 9999`
- Scroll lock via `document.body.style.overflow = 'hidden'` on mount, restore on unmount
- Escape key listener to close
- Centered content area (~600px max-width) with white background

**Editable fields:**
- `question` — textarea (pre-filled from preview)
- `blockType` — displayed as label text (derived from options presence), read-only
- `options` — array of text inputs (only when blockType is `question_select`)
  - Each option is an input field
  - Add/remove option buttons
- `correctAnswer` — radio buttons to select which option index is correct (MCQ only)
- `acceptedAnswerText` — text input (free-response only)
- `explanation` — textarea

**Actions:**
- **Create Exercise** button → calls `POST /api/exercises/create-from-preview` with edited data
  - Shows loading state during creation
  - On success: calls `onCreated(exerciseId)` and closes modal
  - On error: shows inline error message
- **Cancel** button → calls `onClose()` without API call

**Styling**: Use inline styles with Payload CSS variables (matching existing admin component patterns — no Tailwind in admin components based on existing convention in `LessonConversionPanel`, `ConvertV2Button`, etc.).

### Verification
```bash
pnpm -s tsc --noEmit
```

---

## Step 7: Integrate Into `LessonConversionPanel`

**Spec refs**: FR-UI-001, FR-UI-002

### Files to Modify
- `src/ui/admin/exercise-conversion/LessonConversionPanel/index.tsx` (MODIFIED)

### Implementation Details

**Changes needed:**

1. **Import new components:**
   ```typescript
   import { ConvertV3Button } from '../ConvertV3Button'
   import { PreviewEditModal } from '../PreviewEditModal'
   import type { V3PreviewData } from '@/server/services/exercise-conversion/v3/types'
   ```

2. **Expand media filter** — Currently only shows PDFs (line 69). Add image support for V3:
   ```typescript
   // Keep pdfFiles for V1/V2 (PDF-only, unchanged)
   const pdfFiles = mediaItems.filter((m) => m.mimeType === 'application/pdf')
   
   // V3: PDFs + images (new)
   const v3ImageFiles = mediaItems.filter(
     (m) => m.mimeType?.startsWith('image/')
   )
   ```

3. **Add state for V3 preview modal:**
   ```typescript
   const [v3Preview, setV3Preview] = useState<{
     preview: V3PreviewData
     logId: string
     lessonId: string
     mediaId: string
   } | null>(null)
   ```

4. **Add V3 button to each PDF item** — In the buttons `div` (line 185), add `ConvertV3Button` alongside existing V1/V2 buttons:
   ```typescript
   <ConvertV3Button
     lessonId={String(lessonId)}
     mediaId={pdf.id}
     onSuccess={(data) => setV3Preview({
       preview: data,
       logId: data.logId,
       lessonId: String(lessonId),
       mediaId: pdf.id,
     })}
   />
   ```

5. **Add V3 image section** — After the PDF section, render image files with V3 buttons:
   ```typescript
   {v3ImageFiles.map((img) => (
     <div key={img.id} style={/* same card style as PDF items */}>
       <span>IMAGE</span>
       <span>{img.filename || img.id}</span>
       <ConvertV3Button
         lessonId={String(lessonId)}
         mediaId={img.id}
         onSuccess={(data) => setV3Preview({...})}
       />
     </div>
   ))}
   ```

6. **Render `PreviewEditModal`** when `v3Preview` is set (at component root level):
   ```typescript
   {v3Preview && (
     <PreviewEditModal
       preview={v3Preview.preview}
       logId={v3Preview.logId}
       lessonId={v3Preview.lessonId}
       mediaId={v3Preview.mediaId}
       onClose={() => setV3Preview(null)}
       onCreated={(exerciseId) => {
         setV3Preview(null)
       }}
     />
   )}
   ```

7. **Update empty state** — Change "No PDFs attached." (line 120) to check both pdfFiles and v3ImageFiles: if both empty, show "No PDFs or images attached."

**Regression safety**: V1/V2 controls remain completely unchanged. They still only appear for PDF items.

---

## Step 8: Generate Import Map + Types

### Commands
```bash
pnpm generate:types
pnpm generate:importmap
```

This is needed because:
- New collection (ExtractionLogs) requires type generation
- New client components (ConvertV3Button, PreviewEditModal) are referenced from admin UI and need import map

---

## Step 9: Quality Gates

### Commands (run sequentially)
```bash
pnpm -s tsc --noEmit
pnpm -s lint
pnpm -s format
```

Fix any type errors, lint issues, or formatting problems before considering the implementation complete.

---

## File Summary

| File | Status | Purpose |
|------|--------|---------|
| `src/server/payload/collections/ExtractionLogs.ts` | NEW | Extraction logs collection config |
| `src/payload.config.ts` | MODIFIED | Register ExtractionLogs collection |
| `src/server/services/exercise-conversion/v3/types.ts` | NEW | V3 preview data types |
| `src/server/services/exercise-conversion/v3/log-extraction.ts` | NEW | Logging helper functions |
| `src/server/services/exercise-conversion/v3/extract-exercise.ts` | NEW | Main V3 extraction service |
| `src/app/api/exercises/convert/v3/route.ts` | NEW | Convert V3 API endpoint |
| `src/app/api/exercises/create-from-preview/route.ts` | NEW | Create exercise from preview |
| `src/ui/admin/exercise-conversion/ConvertV3Button/index.tsx` | NEW | V3 button component |
| `src/ui/admin/exercise-conversion/PreviewEditModal/index.tsx` | NEW | Preview/edit modal component |
| `src/ui/admin/exercise-conversion/LessonConversionPanel/index.tsx` | MODIFIED | Integration of V3 into panel |

---

## Critical Implementation Notes

### 1. PDF Handling — Vercel Safe (GR-001)
**Do NOT use `@napi-rs/canvas` or `pdfjs-dist` for PDF-to-image conversion.** Gemini natively supports PDF input. Send the raw PDF buffer as base64 with `mimeType: 'application/pdf'` to `generateMultimodalCompletion`. This is fully Vercel serverless compatible.

### 2. Schema Compliance — MCQ Blocks
The `McqAnswerSchema` (at `src/server/payload/collections/Exercises/schemas.ts:55-79`) enforces:
- `options.min(2)` — at least 2 options
- `correctOptionIds.min(1)` — at least 1 correct option
- When `multiSelect=false`, `correctOptionIds` must have exactly 1 entry
- All `correctOptionIds` must reference valid option IDs

**When `correctAnswer` is null**: default to index 0 (first option ID). Never leave `correctOptionIds` empty.

### 3. Schema Compliance — Free Response Blocks
The `FreeResponseAnswerSchema` (at `src/server/payload/collections/Exercises/schemas.ts:81-85`) enforces:
- `acceptedAnswers.min(1)` — at least 1 accepted answer
- Each answer must be a non-empty string (`.min(1)`)

**When no answer text available**: use the explanation as fallback, or a sentinel string `'answer'`.

### 4. Preview-First Flow (GR-002)
The convert endpoint (`/api/exercises/convert/v3`) MUST NOT create any exercise. It returns preview data only. Exercise creation only happens through `/api/exercises/create-from-preview` after admin review.

### 5. Transaction Safety
All log operations (`createExtractionLog`, `updateExtractionLog`) accept an optional `req` parameter and forward it to Payload operations for transaction safety per AGENTS.md rules.

### 6. No Regression to V1/V2
The `LessonConversionPanel` changes must be additive only. V1 (`ConvertForm`) and V2 (`ConvertV2Button`, `V2StatusPanel`) remain completely unchanged and PDF-only.

### 7. Access Control — ExtractionLogs
- `create: () => false` — server-only creation via `overrideAccess: true`
- `update: () => false` — server-only updates via `overrideAccess: true`
- `read: adminOnly` — admin can inspect logs in admin panel
- `delete: adminOnly` — admin can clean up old logs

### 8. Existing Patterns to Follow
- **API routes**: Use `withApiHandler` from `src/server/api/with-api-handler.ts` with `auth: 'adminOrTest'`
- **Response format**: Use `apiSuccess()` and `ApiErrors` from `src/server/api/responses.ts`
- **LLM calls**: Use `getLLMProvider` + `getProviderModelConfig('PDF_TO_EXERCISE')` + `generateMultimodalCompletion` from `src/infra/llm/providers/factory.ts`
- **Block IDs**: Use `generateId()` from `src/server/payload/collections/Exercises/types.ts`
- **Admin UI**: Use inline styles with Payload CSS variables (matching `ConvertV2Button`, `LessonConversionPanel` patterns)
- **Content validation**: Built blocks must pass `ContentSchema.safeParse()` before exercise creation
- **Tenant resolution**: Get tenant from lesson via `payload.findByID({ collection: 'lessons', id, depth: 0 })`
