# Exercise Generation from Document (V3 POC) - Specification

## Overview
Create a Proof of Concept (POC) that converts a single uploaded document (PDF page or image) into one interactive exercise in the system.

**Core Demo Promise**: Take existing material and turn it into an interactive, solvable exercise inside aguy.

**V3 Differentiation**: V3 is a simplified synchronous POC for single-exercise conversion, in contrast to:
- V1: Original pdfToExercisesTask (batch async)
- V2: pdfToExercisesV2Task (image crop pipeline)

## Technical Context
- **Stack**: Next.js 15 + Payload CMS
- **LLM Integration**: Uses existing AI provider infrastructure (Gemini via Genkit adapter) - see `src/infra/llm/services/data-extractor-service.ts`
- **Target Schema**: Must map to existing Exercises collection schema (`src/server/payload/collections/Exercises/`)

## Functional Requirements

### FR-EX-001: Extraction Output Transformation
The LLM extraction returns simple format (`question`, `options`, `correctAnswer`, `explanation`). 
**Must transform** this to Exercises collection's complex block format:
- `content.blocks` array with proper block types
- Block types: `question_free_response` (FreeResponseAnswerSchema) or `question_select` with variants `mcq` or `true_false`
- All blocks require valid IDs and InlineRichTextSchema format

### FR-EX-002: Document Upload
Use existing Lesson `contentFiles` field for document upload (already exists in Lessons collection at `src/server/payload/collections/Lessons.ts`)

### FR-EX-003: Single Exercise Extraction
- Extract exactly one exercise from the document
- If multiple questions exist → take the first one silently

### FR-EX-004: Preview & Edit Flow
1. Admin selects uploaded file from Lesson.contentFiles
2. Clicks "Convert V3" 
3. System extracts exercise via LLM + transformation
4. Shows Preview of extracted Exercise (JSON)
5. Admin can manually edit prompt, options, correct answer
6. Admin clicks "Create Exercise"
7. Exercise is created as Published

**Rule**: No exercise creation without preview/edit step.

### FR-EX-005: Exercise Creation
- Create exercise with `origin: 'conversion'` 
- Link to source media via `sourceDoc` field
- Set `pipelineVersion: 3`

### FR-EX-006: Admin UI Component
The component should integrate with or extend existing `LessonConversionPanel` component at `src/ui/admin/exercise-conversion/LessonConversionPanel`

### FR-EX-007: ExtractionLogs Collection
Create ExtractionLogs collection that:
- Links to Exercises via relationship (not standalone data duplication)
- Stores: raw LLM response, parsed JSON, status, lesson ID, media ID, prompt version
- Must include `tenantField` for multi-tenancy

## Non-Functional Requirements

### NFR-011: Prompt Versioning
Use existing Prompts collection with `usage: 'extractor'` for prompt management (see `src/server/payload/collections/Prompts.ts`)

### NFR-012: Access Control
ExtractionLogs access:
- create: via hooks only (not UI)
- read: admin-only
- update: disabled (append-only)
- delete: disabled

### NFR-013: Tenant Isolation
All data operations must include tenant scoping using existing `tenantField`

## Input Scope (POC Version)
- Upload PDF or Image containing one specific exercise
- Assumptions:
  - Document contains exactly one exercise
  - Multi-exercise detection is out of scope
  - If multiple questions exist → take the first one silently
  - No OCR-only fallback required

## Extraction Requirements
- Single LLM-based extraction using Vision + text understanding
- Return exactly one JSON object representing the exercise

## Output Exercise Format
Must support:
- `question_free_response`
- `question_select` (single correct option)
- Optional: MCQ (treated as question_select with multiple options)

The Exercise must include:
- Prompt text (InlineRichTextSchema format)
- Answer options (if question_select)
- Correct answer (if detectable)
- Rule: If correct answer not detectable, set `correctAnswer: null`. Don't block creation.

## UI Flow & Payload CMS Integration

**Admin Flow**:
1. Admin selects PDF/Image from Lesson.contentFiles
2. Admin clicks "Convert V3"
3. System extracts exercise via LLM + transformation
4. System shows Preview of extracted JSON/Exercise
5. Admin can manually edit prompt, options, correct answer
6. Admin clicks "Create Exercise"
7. Exercise is created as Published
8. Exercise renders in standard lesson UI
9. Exercise is solvable and validated on frontend

**Rule**: No exercise creation without preview/edit step.

## Data Model & Raw Extraction Storage

ExtractionLogs collection stores:
- Raw LLM response string
- Parsed JSON payload
- Extraction status (Success/Failed)
- Lesson ID (relation)
- Media ID (relation to uploaded document)
- Prompt ID / Version used

## Product Decisions
- **Accuracy Standard**: Prompt text must be readable and faithful. Math formulas ~90% accurate acceptable.
- **Multiple Exercises**: Assume single exercise. If multiple exist, take first silently.

## Out of Scope
- Multi-exercise splitting or detection UI
- Batch conversion of multiple files
- Idempotency/deduplication (use existing exercise fields)
- Async job queues (synchronous OK for POC)
- Perfect layout/formatting preservation
- Enterprise-grade robustness

## Acceptance Criteria

A conversion is successful ONLY if ALL of occur:
1. Exercise JSON is valid and maps to Payload schema (ContentBlockSchema)
2. Exercise is successfully saved to database
3. Exercise renders correctly in frontend lesson UI
4. User can interact with and submit an answer
5. Validation logic evaluates submitted answer correctly
6. Basic logging exists (saved to ExtractionLogs)

**Final Statement**: V3 is complete when PDF with one exercise is uploaded, system extracts it, Admin reviews/edits it, and resulting published exercise renders and is fully solvable in lesson UI.
