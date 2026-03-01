# Exercise Generation from Document (V3 POC) - Specification

## Overview
Create a Proof of Concept (POC) that converts a single uploaded document (PDF page or image) into one interactive exercise in the system.

**Core Demo Promise**: Take existing material and turn it into an interactive, solvable exercise inside aguy.

## Technical Context
- **Stack**: Next.js 15 + Payload CMS
- **LLM Integration**: Vision-capable LLM (OpenAI GPT-4o or Anthropic Claude 3.5 Sonnet)
- **Target Schema**: Must map to existing Exercises collection schema

## Requirements

### 1. Input Scope (POC Version)
- Upload PDF or Image containing one specific exercise
- Assumptions:
  - Document contains exactly one exercise
  - Multi-exercise detection is out of scope
  - If multiple questions exist → take the first one silently
  - No OCR-only fallback required

### 2. Extraction Requirements
- Single LLM-based extraction using Vision + text understanding
- Return exactly one JSON object representing the exercise

### 3. Output Exercise Format
Must support:
- `question_free_response`
- `question_select` (single correct option)
- Optional: MCQ (treated as question_select with multiple options)

The Exercise must include:
- Prompt text
- Answer options (if question_select)
- Correct answer (if detectable)
- Rule: If correct answer not detectable, set `correctAnswer: null`. Don't block creation.

### 4. UI Flow & Payload CMS Integration
**Implementation Location**: Custom React component in Payload CMS Admin UI, injected into Lesson edit view

**Admin Flow**:
1. Admin uploads PDF/Image to a Lesson
2. Admin clicks "Convert V3"
3. System extracts exercise via LLM
4. System shows Preview of extracted JSON/Exercise
5. Admin can manually edit prompt, options, correct answer
6. Admin clicks "Create Exercise"
7. Exercise is created as Published
8. Exercise renders in standard lesson UI
9. Exercise is solvable and validated on frontend

**Rule**: No exercise creation without preview/edit step.

### 5. Data Model & Raw Extraction Storage
Create new Payload Collection: `ExtractionLogs` to store:
- Raw LLM response string
- Parsed JSON payload
- Extraction status (Success/Failed)
- Lesson ID (relation)
- Media ID (relation to uploaded document)
- Prompt ID / Version used

### 6. Product Decisions
- **Accuracy Standard**: Prompt text must be readable and faithful. Math formulas ~90% accurate acceptable.
- **Multiple Exercises**: Assume single exercise. If multiple exist, take first silently.

### 7. Out of Scope
- Multi-exercise splitting or detection UI
- Batch conversion of multiple files
- Idempotency/deduplication
- Async job queues (synchronous OK for POC)
- Perfect layout/formatting preservation
- Enterprise-grade robustness

## Acceptance Criteria

A conversion is successful ONLY if ALL of occur:
1. Exercise JSON is valid and maps to Payload schema
2. Exercise is successfully saved to database
3. Exercise renders correctly in frontend lesson UI
4. User can interact with and submit an answer
5. Validation logic evaluates submitted answer correctly
6. Basic logging exists (saved to ExtractionLogs)

**Final Statement**: V3 is complete when PDF with one exercise is uploaded, system extracts it, Admin reviews/edits it, and resulting published exercise renders and is fully solvable in lesson UI.
