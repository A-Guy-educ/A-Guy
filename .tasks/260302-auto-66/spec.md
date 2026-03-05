# V3 POC: Exercise Generation from Document

## Overview

Build a V3 POC that converts one uploaded document (PDF page or image) into one interactive exercise in A-Guy.

## Core Demo Promise

We can take existing material and turn it into an interactive, solvable exercise inside A-Guy.

## Technical Context

- **Stack**: Next.js 15 + Payload CMS
- **LLM**: vision-capable provider already used in project
- **Output**: Must map to existing `Exercises` schema in repo

## Scope (POC)

### Input

- Admin uploads PDF or image to a Lesson
- Assume exactly one exercise per uploaded file
- If multiple are present, take first silently
- No multi-exercise detection UI

### Extraction

- Single LLM extraction pass (vision + understanding)
- Return exactly one structured exercise payload

### Output Format

Support at minimum:
- `question_free_response`
- `question_select` (single correct option)
- MCQ as `question_select` with options

Must include:
- prompt text
- options when relevant
- `correctAnswer` if detectable; if not, allow `null` and do not block creation

## Required Admin Flow (Lesson Edit View)

1. Upload PDF/image under lesson content files
2. Click **Convert V3**
3. System extracts and returns preview draft
4. Admin can edit prompt/options/correct answer
5. Admin clicks **Create Exercise**
6. Exercise is created as Published for demo
7. Exercise renders in lesson UI and is solvable

**Rule**: Creation must always go through preview/edit step (no direct auto-create)

## Data Logging Requirement

Create/store extraction attempts in `ExtractionLogs` (or equivalent) with:
- raw LLM response string
- parsed payload JSON
- status (`success` / `failed`)
- lesson relation
- media relation
- prompt id/version
- stage and error message where relevant

## Runtime Requirement

PDF conversion must work in Vercel preview/server runtime.

## Out of Scope

- Multi-exercise splitting/detection
- Batch conversion
- Dedup/idempotency
- Async queues
- Perfect visual fidelity
- Enterprise-grade fault tolerance

## Functional Requirements

### FR-LOG-001: ExtractionLogs Collection
Create a new Payload collection `ExtractionLogs` with the following fields:
- `rawLLMResponse` (text): Raw response string from LLM
- `parsedPayload` (json): Parsed exercise data
- `status` (select): `success` or `failed`
- `lesson` (relationship): Relation to lessons collection
- `media` (relationship): Relation to media collection
- `promptId` (relationship): Relation to prompts collection (nullable)
- `promptVersion` (number): Version of prompt used (nullable)
- `stage` (text): Current stage (e.g., "fetch", "extract", "parse", "create")
- `errorMessage` (text): Error details if failed (nullable)

### FR-LOG-002: Stage-Based Logging
Log extraction attempts at each stage:
- Before fetching media: stage = "init"
- After successful fetch: stage = "fetched"
- After LLM extraction: stage = "extracted"
- After parsing: stage = "parsed"
- After exercise creation: stage = "created"
- On any failure: stage = "failed" with errorMessage

### FR-UI-001: Convert V3 Button
Add a new "Convert V3" button component that:
- Is synchronous (not queued)
- Calls the V3 extraction endpoint
- Shows loading state during extraction
- Returns preview data for editing

### FR-UI-002: Preview/Edit Modal
Add a PreviewEditModal component that:
- Displays extracted exercise data for review
- Allows editing prompt text
- Allows editing options (for MCQ)
- Allows editing correct answer
- Has "Create Exercise" button to finalize
- Has "Cancel" button to discard

### FR-API-001: V3 Extraction Endpoint
Create a new API endpoint `/api/exercises/convert/v3` (POST) that:
- Accepts `{ lessonId, mediaId }` in request body
- Fetches the media file
- Converts PDF to image if needed (Vercel-compatible)
- Calls LLM extraction
- Returns preview data (not creates exercise)

### FR-API-002: Create Exercise Endpoint
Create `/api/exercises/create-from-preview` (POST) that:
- Accepts preview data with edits
- Validates against Exercise schema
- Creates exercise as published
- Returns created exercise ID

### FR-API-003: PDF Support
Handle PDF input by:
- Converting PDF pages to images
- Using first page for extraction
- Using Vercel-compatible PDF processing (no native modules)

### FR-PDF-001: Vercel-Compatible PDF Processing
Use serverless-compatible PDF processing:
- Option A: Use pdf-lib or similar pure JS library
- Option B: Use external API (e.g., CloudConvert)
- Option C: Use canvas element in Edge runtime

**CRITICAL**: `@napi-rs/canvas` from V2 does NOT work in Vercel serverless

### FR-DATA-001: Preview Data Format
Extraction endpoint returns:
- question (string)
- options (string[] or null)
- correctAnswer (number or null)
- explanation (string or null)
- blockType (question_free_response | question_select)
- formatted for ExerciseBlockDefaults

## Guardrails

### GR-001: Serverless PDF Processing
PDF processing must work in Vercel serverless environment. Do NOT use `@napi-rs/canvas` or other native Node.js modules.

### GR-002: Preview Required
V3 flow must ALWAYS go through preview/edit step. No direct auto-creation of exercises.

### GR-003: Complete Logging
All extraction attempts must be logged, including failures, with sufficient detail for debugging.

## Acceptance Criteria

- [ ] Convert V3 works for **PDF** in Vercel preview
- [ ] Convert V3 works for **image** input
- [ ] Preview/edit step appears before creation
- [ ] Create Exercise succeeds from preview for PDF and image
- [ ] Created exercise matches `Exercises` schema and renders in lesson UI
- [ ] User can submit answer and validation works
- [ ] Extraction log record is stored for success and failure cases
- [ ] No regression to existing V2 conversion flow

## Verification Checklist

- [ ] Test at least 2 PDFs + 3 images in preview
- [ ] Confirm at least 5 successful end-to-end conversions total
- [ ] Document one failed sample and verify log quality
