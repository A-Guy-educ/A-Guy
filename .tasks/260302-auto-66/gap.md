# Gap Analysis: 260302-auto-66

## Summary

- Gaps Found: 5
- Spec Revised: Yes

## Gaps Found

### Gap 1: Missing ExtractionLogs Collection

**Severity:** High
**Location:** src/collections/ (new collection needed)
**Issue:** The spec requires storing extraction attempts in an `ExtractionLogs` collection with:
- raw LLM response string
- parsed payload JSON
- status (success / failed)
- lesson relation
- media relation
- prompt id/version
- stage and error message

The codebase has no such collection. The closest pattern is `MCPAuditLogs` which can be used as a reference, but ExtractionLogs needs different fields specific to the V3 extraction flow.

**Fix Applied:** Added new FR-NFR requirement to spec:
- Added FR-LOG-001: Create ExtractionLogs collection with required fields
- Added FR-LOG-002: Log extraction attempts at each stage (fetch, extract, parse, create)

### Gap 2: Missing V3-Specific Admin UI Components

**Severity:** High
**Location:** src/ui/admin/exercise-conversion/
**Issue:** The spec requires:
- "Convert V3" button (not queued, synchronous)
- Preview/edit step before creation
- "Create Exercise" button to finalize

Existing V2 components (`ConvertV2Button`, `LessonConversionPanel`) implement a queued async workflow. The V3 flow needs a new component that:
1. Calls extraction endpoint
2. Returns preview draft for editing
3. Allows editing prompt/options/correctAnswer
4. Creates published exercise on confirmation

**Fix Applied:** Added to spec:
- Added FR-UI-001: Add ConvertV3Button component to LessonConversionPanel
- Added FR-UI-002: Add PreviewEditModal for extracted exercise before creation
- Updated Admin Flow in spec to clarify V3 UI components

### Gap 3: Missing V3 Synchronous Extraction Endpoint

**Severity:** High
**Location:** src/server/payload/endpoints/exercises/ (new endpoint)
**Issue:** The spec requires synchronous extraction (not queued) that returns a preview draft. The existing `/api/exercises/import` endpoint creates a draft directly without preview/edit step. Need:
- New endpoint for V3 extraction that returns preview data
- Support for both PDF and image input
- Vercel-compatible PDF processing

**Fix Applied:** Added to spec:
- Added FR-API-001: Create /api/exercises/convert/v3 endpoint
- Added FR-API-002: Endpoint returns preview data (not creates draft)
- Added FR-API-003: Support PDF input via PDF-to-image conversion

### Gap 4: PDF Processing for Vercel Runtime

**Severity:** Critical
**Location:** src/server/services/exercise-conversion/
**Issue:** The existing V2 PDF rendering uses `@napi-rs/canvas` which requires native Node.js modules and may not work in Vercel serverless runtime. The spec explicitly requires: "PDF conversion must work in Vercel preview/server runtime."

The codebase has no Vercel-compatible PDF-to-image conversion solution.

**Fix Applied:** Added to spec:
- Added FR-PDF-001: Use Vercel-compatible PDF processing (e.g., pdf-lib + canvas or third-party API)
- Added Guardrail: PDF processing must work in serverless environment

### Gap 5: Preview Data Schema for Edit Step

**Severity:** Medium
**Location:** src/infra/llm/services/data-extractor-service.ts
**Issue:** The existing `extractFromImage` returns `{ question, options, correctAnswer, explanation }`. For the preview/edit workflow, the frontend needs:
- Full block structure (not just raw data)
- Ability to edit before creation
- Correct format for the Exercises schema

The current flow directly creates the exercise. Need to return preview-compatible data.

**Fix Applied:** Added to spec:
- Added FR-DATA-001: Extract endpoint returns preview-formatted data
- Added FR-DATA-002: Preview data matches ExerciseBlockDefaults structure

## Changes Made to Spec

### New Functional Requirements Added

1. **FR-LOG-001**: Create `ExtractionLogs` collection with fields:
   - `rawLLMResponse` (text)
   - `parsedPayload` (json)
   - `status` (select: success/failed)
   - `lesson` (relationship to lessons)
   - `media` (relationship to media)
   - `promptId` (relationship to prompts)
   - `promptVersion` (number)
   - `stage` (text - e.g., "fetch", "extract", "parse", "create")
   - `errorMessage` (text, nullable)

2. **FR-LOG-002**: Log extraction attempts at each stage with proper status tracking

3. **FR-UI-001**: Add "Convert V3" button component (synchronous, not queued)

4. **FR-UI-002**: Add PreviewEditModal for reviewing/editing extracted exercise before creation

5. **FR-API-001**: Create `/api/exercises/convert/v3` endpoint

6. **FR-API-002**: V3 endpoint returns preview data (not creates draft)

7. **FR-API-003**: V3 endpoint handles both PDF and image input

8. **FR-PDF-001**: Implement Vercel-compatible PDF-to-image conversion

9. **FR-DATA-001**: Extract endpoint returns preview-formatted data

10. **FR-DATA-002**: Preview data matches ExerciseBlockDefaults structure for easy editing

### Updated Acceptance Criteria

- Clarified "Convert V3" button is synchronous
- Added requirement for Preview/Edit step
- Added logging verification to acceptance criteria

### Added Guardrails

- **GR-001**: PDF processing must work in Vercel serverless environment (no native modules)
- **GR-002**: V3 flow must always go through preview/edit step (no auto-create)
- **GR-003**: ExtractionLogs must capture all stages for debugging failed conversions
