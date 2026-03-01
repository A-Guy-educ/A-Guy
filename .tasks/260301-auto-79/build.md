# Build Agent Report: 260301-auto-79

## Task Type: spec_only

This is a **specification-only** task. No implementation was performed per pipeline configuration.

## Specification Summary

### Core Feature: P5 Exercise Generation from Document (V3 POC)

A Proof of Concept that converts a single uploaded document (PDF page or image) into one interactive exercise in the system.

### Key Requirements Documented

1. **FR-1: Input Scope**
   - Upload PDF or Image containing one specific exercise
   - Multi-exercise detection is out of scope
   - If multiple questions exist → take the first silently

2. **FR-2: Extraction Requirements**
   - Single LLM-based extraction using Vision + text understanding
   - Use existing `IMAGE_TO_EXERCISE` model from `src/infra/llm/models.ts`
   - Store extraction prompt in existing Prompts collection with `usage='extractor'`

3. **FR-3: Output Exercise Format**
   - Support: `question_free_response`, `question_select` (single correct option)
   - Map to `ContentBlockSchema` from Exercises collection
   - If correct answer not detectable, set `correctAnswer: null` (creation NOT blocked)

4. **FR-4: UI Flow & Payload CMS Integration**
   - Integrate "Convert V3" button into existing `LessonConversionPanel`
   - Admin uploads PDF/Image → clicks Convert → preview/edit → create exercise
   - Exercise renders in standard lesson UI and is solvable

5. **FR-5: Data Model & Raw Extraction Storage**
   - Create ExtractionLogs collection for audit trail
   - Fields: rawLLMResponse, parsedJSON, status, lesson, media, prompt, errorMessage, tenant, createdAt

6. **FR-6: Product Decisions**
   - Math formulas ~90% accurate is acceptable
   - Single exercise assumption - take first silently if multiple

7. **FR-7: Out of Scope**
   - Multi-exercise splitting, batch conversion, idempotency
   - Async job queues (synchronous OK for POC)
   - Enterprise-grade robustness

## Gap Analysis Completed

7 gaps were identified and resolved:

1. **LLM Provider Mismatch** - Aligned spec with existing Gemini/MiniMax providers
2. **ExtractionLogs Collection Details** - Added specific field definitions (FR-5-1)
3. **Existing LessonConversionPanel** - Clarified V3 integration (FR-4-1)
4. **Exercise Output Format Mapping** - Added ContentBlockSchema reference (FR-3-1)
5. **LLM Extraction Prompt** - Specified Prompts collection usage (FR-2-1)
6. **Preview/Edit Workflow** - Added ExercisePreview component reference (FR-4-2)
7. **Acceptance Criteria** - Added ExtractionLogs verification step

## Files Referenced

- `src/infra/llm/models.ts` - Existing LLM model definitions
- `src/server/payload/collections/Exercises/schemas.ts` - ContentBlockSchema
- `src/ui/admin/exercise-conversion/LessonConversionPanel/` - Existing admin UI
- `src/server/payload/collections/ConfigAuditLogs.ts` - Collection pattern reference

## Next Steps (for future implementation task)

When this feature moves to implementation, the following will be needed:

1. Create ExtractionLogs collection following ConfigAuditLogs pattern
2. Add LLM extraction prompt to Prompts collection
3. Implement V3 button in LessonConversionPanel
4. Create preview/edit component leveraging ExercisePreview
5. Implement extraction API endpoint
6. Wire up exercise creation flow
7. Add ExtractionLogs recording on each extraction attempt

## Status

- TypeScript: N/A (spec_only)
- Lint: N/A (spec_only)
- Tests Written: None (spec_only)
