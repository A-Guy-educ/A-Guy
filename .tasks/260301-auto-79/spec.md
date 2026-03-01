# Specification: P5 Exercise Generation from Document (POC)

## Overview

Create a Proof of Concept (POC) that converts a single uploaded document (PDF page or image) into one interactive exercise in the system. The core demo promise is taking existing material and turning it into an interactive, solvable exercise inside aguy.

## Technical Context

- **Stack**: Next.js 15 + Payload CMS
- **LLM Integration**: Vision-capable LLM (OpenAI GPT-4o or Anthropic Claude 3.5 Sonnet)
- **Target Schema**: Must map to existing Exercises collection schema

## Requirements

### FR-1: Document Upload Support
- Support PDF or Image upload containing one specific exercise
- Assume uploaded document contains exactly one exercise
- If multiple questions exist, LLM must silently take the first one

### FR-2: LLM-Based Extraction
- Perform single LLM-based extraction using Vision + text understanding
- Return exactly one JSON object representing the exercise
- Support question_free_response and question_select (single correct option)

### FR-3: Exercise Output Format
- Include prompt text
- Include answer options (if question_select)
- Include correct answer (if detectable)
- If correct answer not detectable, set correctAnswer: null (do not block creation)

### FR-4: Admin UI Flow (Payload CMS)
- Admin uploads PDF/Image to a Lesson
- Admin clicks "Convert V3"
- System extracts exercise via LLM
- System shows Preview of extracted JSON/Exercise
- Admin can manually edit prompt, options, and correct answer
- Admin clicks "Create Exercise"
- Exercise is created as Published
- Exercise renders inside standard lesson UI
- Exercise is solvable and validated on frontend

### FR-5: Data Model - ExtractionLogs Collection
Create new Payload Collection to store:
- Raw LLM response string
- Parsed JSON payload
- Extraction status (Success/Failed)
- Lesson ID (relation)
- Media ID (relation to uploaded document)
- Prompt ID / Version used

### FR-6: Preview/Edit Requirement
- No exercise creation allowed without passing through preview/edit step
- Admin must review and optionally modify before creation

## Acceptance Criteria

1. Exercise JSON is valid and maps to Payload schema
2. Exercise is successfully saved to database
3. Exercise renders correctly in frontend lesson UI
4. User can interact with and submit an answer for generated exercise
5. Validation logic evaluates submitted answer correctly
6. Basic logging exists for extraction attempts (saved to ExtractionLogs)

## Out of Scope

- Multi-exercise splitting or detection UI
- Batch conversion of multiple files
- Idempotency/deduplication of uploads
- Async job queues
- Perfect layout/formatting preservation
- Enterprise-grade robustness

## Success Criteria

End-to-end flow must work where:
1. PDF containing one exercise is uploaded
2. System extracts the exercise
3. Admin reviews/edits it
4. Resulting published exercise renders and is fully solvable inside lesson UI
5. At least 5 sample uploads tested successfully in staging
