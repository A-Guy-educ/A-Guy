# Gap Analysis: 260301-auto-79

## Summary

- Gaps Found: 7
- Spec Revised: Yes

## Gaps Found

### Gap 1: LLM Provider Mismatch

**Severity:** High
**Location:** spec.md line 96
**Issue:** The spec specifies "OpenAI GPT-4o or Anthropic Claude 3.5 Sonnet" as the LLM provider, but the existing codebase uses Gemini and MiniMax as providers (see `src/infra/llm/models.ts`). The codebase has a provider factory pattern that supports GEMINI and OPENAI_COMPATIBLE (MiniMax) providers.
**Fix Applied:** Updated FR-2 and Technical Context to reference existing `IMAGE_TO_EXERCISE` model from `src/infra/llm/models.ts` and the existing LLM provider infrastructure.

### Gap 2: Missing ExtractionLogs Collection Details

**Severity:** High
**Location:** spec.md FR-5
**Issue:** FR-5 mentions creating an "ExtractionLogs" collection but doesn't define the exact schema. The codebase has existing audit log patterns (ConfigAuditLogs, MCPAuditLogs in `src/server/payload/collections/`) that should inform the structure.
**Fix Applied:** Added FR-5-1 with specific field definitions based on existing audit log patterns and the requirements stated.

### Gap 3: Existing LessonConversionPanel Not Referenced

**Severity:** High
**Location:** spec.md FR-4
**Issue:** The spec mentions "Custom React component within Payload CMS Admin UI, injected into Lesson edit view" but doesn't acknowledge that `LessonConversionPanel` already exists at `src/ui/admin/exercise-conversion/LessonConversionPanel/index.tsx` with V1 and V2 buttons. The spec should clarify how V3 integrates with this existing component.
**Fix Applied:** Added FR-4-1 to clarify integration with existing LessonConversionPanel component.

### Gap 4: Incomplete Exercise Output Format Mapping

**Severity:** Medium
**Location:** spec.md FR-3
**Issue:** FR-3 mentions "question_free_response" and "question_select" but the actual Exercises schema (`src/server/payload/collections/Exercises/schemas.ts`) contains many more block types: rich_text, question_select (with mcq/true_false variants), question_free_response, question_table, question_matching, question_geometry, question_axis, latex, html, media, svg.
**Fix Applied:** Updated FR-3 to reference the actual ContentBlockSchema from Exercises/schemas.ts and clarify the mapping requirements.

### Gap 5: Missing LLM Extraction Prompt Definition

**Severity:** Medium
**Location:** spec.md
**Issue:** The spec doesn't define the actual prompt that will be used for the V3 LLM extraction. There's no reference to where the prompt should be stored (Prompts collection already exists with 'extractor' usage type).
**Fix Applied:** Added FR-2-1 to specify that the extraction prompt should use the existing Prompts collection with usage='extractor'.

### Gap 6: Preview/Edit Workflow Not Fully Specified

**Severity:** Medium
**Location:** spec.md FR-4
**Issue:** FR-4 mentions "Preview of the extracted JSON/Exercise" and "manually edit the prompt, options, and correct answer before creation" but doesn't define the UI component for this preview/edit workflow. The existing Exercises collection has an `ExercisePreview` component referenced in the schema.
**Fix Applied:** Added FR-4-2 to specify the preview/edit component requirements.

### Gap 7: Acceptance Criteria Missing ExtractionLogs Verification

**Severity:** Low
**Location:** spec.md Acceptance Criteria
**Issue:** The acceptance criteria mention "Basic logging exists for extraction attempts (saved to ExtractionLogs)" but don't specify verification steps for the ExtractionLogs collection content.
**Fix Applied:** Added verification step in acceptance criteria to verify ExtractionLogs record creation.

## Changes Made to Spec

- Updated FR-2: Now references existing `IMAGE_TO_EXERCISE` model from `src/infra/llm/models.ts` and existing LLM provider infrastructure
- Added FR-2-1: Specifies extraction prompt should use existing Prompts collection with usage='extractor'
- Added FR-3-1: References actual ContentBlockSchema from Exercises/schemas.ts for output format
- Added FR-4-1: Clarifies V3 button integrates with existing LessonConversionPanel
- Added FR-4-2: Specifies preview/edit UI component requirements
- Added FR-5-1: Defines ExtractionLogs collection schema with specific fields
- Updated Technical Context: Changed to reference Gemini provider per existing codebase
- Updated Acceptance Criteria: Added verification for ExtractionLogs record

## Existing Codebase Patterns to Follow

1. **Collection Creation**: Use existing patterns from `src/server/payload/collections/ConfigAuditLogs.ts` and `MCPAuditLogs.ts`
2. **LLM Integration**: Use `src/infra/llm/models.ts` with `IMAGE_TO_EXERCISE` model key
3. **Admin UI**: Extend existing `src/ui/admin/exercise-conversion/LessonConversionPanel/`
4. **Prompt Management**: Use existing Prompts collection with usage='extractor' type
5. **Exercise Schema**: Reference `src/server/payload/collections/Exercises/schemas.ts` for ContentBlockSchema

## Review Questions Answered

1. **Which LLM provider should be used?** - Use the existing provider infrastructure (Gemini or MiniMax via the provider factory) - the spec now aligns with this
2. **Should ExtractionLogs collection be created as part of this POC?** - Yes, per FR-5 requirement
3. **Is synchronous API wait acceptable for POC?** - Yes, aligns with FR-7 (async job queues out of scope)
