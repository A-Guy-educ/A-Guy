# P5 Exercise Generation from Document (V3 POC)

## Overview

Create a Proof of Concept (POC) that converts a single uploaded document (PDF page or image) into one interactive exercise in the system.

**Core Demo Promise**: Take existing material and turn it into an interactive, solvable exercise inside aguy.

## Requirements

### FR-1: Input Scope (POC Version)
- Supported input: Upload a PDF or Image that contains one specific exercise
- Assumptions:
  - Uploaded document contains exactly one exercise
  - Multi-exercise detection is strictly out of scope
  - If multiple questions exist → the LLM must silently take the first one
  - No OCR-only fallback is required for this POC

### FR-2: Extraction Requirements
- System must perform a single LLM-based extraction using Vision + text understanding
- Extractor must return exactly one JSON object representing the exercise
- **FR-2-1**: Use existing `IMAGE_TO_EXERCISE` model from `src/infra/llm/models.ts` via the LLM provider factory. Store extraction prompt in existing Prompts collection with `usage='extractor'`

### FR-3: Output Exercise Format
The extracted JSON must support at minimum:
- `question_free_response`
- `question_select` (single correct option)
- Optional: MCQ (treated as question_select with multiple options)

**FR-3-1**: Output must map to `ContentBlockSchema` from `src/server/payload/collections/Exercises/schemas.ts`. Supported block types include: rich_text, question_select (mcq/true_false variants), question_free_response, question_table, question_matching, question_geometry, question_axis, latex, html, media, svg.

The Exercise must include:
- Prompt text
- Answer options (if question_select)
- Correct answer (if detectable)
- Rule: If correct answer is not detectable, set `correctAnswer: null`. Creation must NOT be blocked.

### FR-4: UI Flow & Payload CMS Integration
Implementation Location: Custom React component within Payload CMS Admin UI, injected into Lesson edit view via existing LessonConversionPanel.

**FR-4-1**: Integrate "Convert V3" button into existing `LessonConversionPanel` at `src/ui/admin/exercise-conversion/LessonConversionPanel/index.tsx` alongside existing V1/V2 buttons.

The Flow (Admin Only):
1. Admin uploads a PDF/Image to a Lesson
2. Admin clicks "Convert V3"
3. System extracts the exercise via LLM
4. System shows a Preview of the extracted JSON/Exercise
5. Admin is allowed to manually edit the prompt, options, and correct answer before creation
6. Admin clicks "Create Exercise"
7. Exercise is created in Payload as Published
8. Exercise renders inside the standard lesson UI
9. Exercise is solvable and validated on the frontend

**FR-4-2**: Preview/Edit component should leverage existing `ExercisePreview` component referenced in Exercises collection schema, with additional inline editing capabilities for prompt, options, and correctAnswer fields.

Rule: No exercise creation is allowed without passing through the preview/edit step.

### FR-5: Data Model & Raw Extraction Storage
To support debugging, model improvement, and auditability, the system must store the extraction attempt.

Implementation Requirement: Create a new Payload Collection (e.g., `ExtractionLogs`) following patterns from `src/server/payload/collections/ConfigAuditLogs.ts`.

**FR-5-1**: ExtractionLogs collection must include these fields:
- `rawLLMResponse`: text (raw LLM response string)
- `parsedJSON`: json (parsed JSON payload)
- `status`: select ['success', 'failed'] (extraction status)
- `lesson`: relationship to 'lessons' (Lesson ID)
- `media`: relationship to 'media' (uploaded document)
- `prompt`: relationship to 'prompts' (Prompt ID / Version used)
- `errorMessage`: text (optional, for failed extractions)
- `tenant`: tenant relationship (for multi-tenant support)
- `createdAt`: timestamp

Index: status, lesson, media, tenant for efficient queries

### FR-6: Product Decisions
- **Accuracy Standard**:
  - Prompt text must be readable and faithful
  - Structure must match the exercise type
  - Math formulas may be up to ~90% accurate
  - Acceptance: If a complex formula is 90% correct but the exercise remains solvable, it is a SUCCESS
- **Multiple Exercises in Document**:
  - Assume single exercise. If multiple exist, take the first silently. No detection UI required.

### FR-7: Out of Scope
Do NOT implement:
- Multi-exercise splitting or detection UI
- Batch conversion of multiple files
- Idempotency / deduplication of uploads
- Async job queues (synchronous API wait is fine for POC)
- Perfect layout/formatting preservation
- Enterprise-grade robustness or advanced error recovery

## Acceptance Criteria

A conversion is considered successful only if ALL of the following occur:

- [ ] Exercise JSON is valid and maps to the Payload schema
- [ ] Exercise is successfully saved to the database
- [ ] Exercise renders correctly in the frontend lesson UI
- [ ] User can interact with and submit an answer for the generated exercise
- [ ] Validation logic evaluates the submitted answer correctly
- [ ] Basic logging exists for extraction attempts (saved to ExtractionLogs)
- [ ] ExtractionLogs record is created with: rawLLMResponse, parsedJSON, status='success', lesson, media, prompt references

If any step above fails, the conversion is considered FAILED. No partial success is acceptable.

## Technical Context

- **Stack**: Next.js 15 + Payload CMS
- **LLM Integration**: Use existing `IMAGE_TO_EXERCISE` model from `src/infra/llm/models.ts` via provider factory (supports Gemini and MiniMax). Configure via `LLM_MODEL_OVERRIDE_IMAGE_TO_EXERCISE` env var if needed.
- **Target Schema**: Existing Exercises collection schema (see `/src/server/payload/collections/Exercises/index.ts` and `/src/server/payload/collections/Exercises/schemas.ts`)
- **Prompt Storage**: Use existing Prompts collection with `usage='extractor'`
- **Admin UI**: Extend existing `src/ui/admin/exercise-conversion/LessonConversionPanel/`

## Exercise Schema Reference

The Exercises collection uses a block-based content model:

```typescript
// ContentSchema contains: { blocks: ContentBlock[] }

// Supported block types:
// - rich_text: Instructions/notes between questions
// - question_select: MCQ or True/False questions
// - question_free_response: Free text answer questions
// - question_table: Table questions
// - question_matching: Matching questions
// - question_geometry: Geometry questions
// - question_axis: Axis/graph questions
// - latex: Math formulas
// - html: HTML content
// - media: Media references
// - svg: SVG with hotspots
```

## Final Acceptance Statement

V3 is complete when a PDF containing one exercise is uploaded, the system extracts it, the Admin reviews/edits it, and the resulting published exercise renders and is fully solvable inside the lesson UI. End-to-end flow must work in staging with at least 5 sample uploads tested successfully.
