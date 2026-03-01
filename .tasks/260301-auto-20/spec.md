# Specification (promoted)

Skipped via input_quality — taskify determined spec is unnecessary.

## Requirements

# Task

## Issue Title

[2603--auto-XX] implement the following task
P5 – Exercise Generation from Document (V3 POC)
Objective
Create a Proof of Concept (POC) that converts a single uploaded document (PDF page or image) into one interactive exercise in the system.

Core demo promise:

We can take existing material and turn it into an interactive, solvable exercise inside aguy.

Technical Context & Constraints
Stack: Next.js 15 + Payload CMS.
LLM Integration: Use a vision-capable LLM (e.g., OpenAI GPT-4o or Anthropic Claude 3.5 Sonnet) that supports direct document/image parsing.
Target Schema: The generated output must map exactly to the existing Exercises collection schema in our codebase. (Note for Architect stage: Inspect the Exercises collection schema before defining the extraction JSON structure).
1. Input Scope (POC Version)
Supported input (for V3 demo):

Upload a PDF or Image that contains one specific exercise.
Assumptions & Constraints:

The uploaded document contains exactly one exercise.
Multi-exercise detection is strictly out of scope.
If multiple questions exist → the LLM must silently take the first one.
No OCR-only fallback is required for this POC.
2. Extraction Requirements
The system must perform:

A single LLM-based extraction using Vision + text understanding.
The extractor must return exactly one JSON object representing the exercise.
3. Output Exercise Format
The extracted JSON must support at minimum:

question_free_response
question_select (single correct option)
Optional (uses same structure): MCQ (treated as question_select with multiple options)
The Exercise must include:

Prompt text
Answer options (if question_select)
Correct answer (if detectable)
Rule: If the correct answer is not detectable by the LLM, set correctAnswer: null. Creation must not be blocked due to a missing answer.
4. UI Flow & Payload CMS Integration
Implementation Location: This flow must be built as a custom React component within the Payload CMS Admin UI, injected into the Lesson edit view.

The Flow (Admin Only):

Admin uploads a PDF/Image to a Lesson.
Admin clicks "Convert V3".
System extracts the exercise via LLM.
System shows a Preview of the extracted JSON/Exercise.
Admin is allowed to manually edit the prompt, options, and correct answer before creation.
Admin clicks "Create Exercise".
Exercise is created in Payload as Published (for immediate demo testing).
Exercise renders inside the standard lesson UI.
Exercise is solvable and validated on the frontend.
Rule: No exercise creation is allowed without passing through the preview/edit step.

5. Data Model & Raw Extraction Storage
To support debugging, model improvement, and auditability, the system must store the extraction attempt.

Implementation Requirement: Create a new Payload Collection (e.g., ExtractionLogs) to store:

Raw LLM response string
Parsed JSON payload
Extraction status (Success/Failed)
Lesson ID (relation)
Media ID (relation to the uploaded document)
Prompt ID / Version used
6. Product Decisions (Resolved Gaps)
Accuracy Standard:

Prompt text must be readable and faithful.
Structure must match the exercise type.
Math formulas may be up to ~90% accurate.
Acceptance: If a complex formula is 90% correct but the exercise remains solvable, it is considered a SUCCESS for this POC. Perfect visual fidelity is NOT required.
Multiple Exercises in Document:

Assume single exercise. If multiple exist, take the first silently. No detection UI required.
7. Out of Scope
Do NOT implement or account for any of the following:

Multi-exercise splitting or detection UI.
Batch conversion of multiple files.
Idempotency / deduplication of uploads.
Async job queues (synchronous API wait is fine for POC).
Perfect layout/formatting preservation.
Enterprise-grade robustness or advanced error recovery.
8. Definition of Done & Success Criteria
A conversion is considered successful only if ALL of the following occur:

Exercise JSON is valid and maps to the Payload schema.
Exercise is successfully saved to the database.
Exercise renders correctly in the frontend lesson UI.
User can interact with and submit an answer for the generated exercise.
Validation logic evaluates the submitted answer correctly.
Basic logging exists for extraction attempts (saved to ExtractionLogs).
If any step above fails, the conversion is considered FAILED. No partial success is acceptable.

Final Acceptance Statement: V3 is complete when a PDF containing one exercise is uploaded, the system extracts it, the Admin reviews/edits it, and the resulting published exercise renders and is fully solvable inside the lesson UI. End-to-end flow must work in staging with at least 5 sample uploads tested successfully.


## Acceptance Criteria

- [ ] Fix applied as described in task.md
- [ ] TypeScript compilation passes
- [ ] Unit tests pass
