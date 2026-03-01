# Gap Analysis: 260301-auto-20

## Summary

- Gaps Found: 8
- Spec Revised: Yes

## Gaps Found

### Gap 1: Output Format Mismatch with Exercises Schema

**Severity:** Critical
**Location:** spec.md line 28-38 (Output Exercise Format)
**Issue:** The spec mentions output format as simple "prompt text, answer options, correct answer" but the actual Exercises collection schema (`src/server/payload/collections/Exercises/schemas.ts`) requires a complex JSON structure with `content.blocks` array containing block types:
- `question_free_response` with `FreeResponseAnswerSchema`
- `question_select` with variants `mcq` and `true_false`, each having specific schemas
- The simple extraction output (`question`, `options`, `correctAnswer`) from `data-extractor-service.ts` does NOT map directly to the block schema

**Fix Applied:** Added FR-EX-001 to require a transformation layer that converts simple extraction output to Exercise content block format

### Gap 2: Missing Prompt Version/Reference in ExtractionLogs

**Severity:** High
**Location:** spec.md line 56-62 (Data Model)
**Issue:** The spec mentions "Prompt ID / Version used" but doesn't clarify:
- Whether to use the existing Prompts collection which already has `usage: 'extractor'` option
- How to integrate with the existing prompt system at `src/server/payload/collections/Prompts.ts`

**Fix Applied:** Added NFR-011 to leverage existing Prompts collection with usage='extractor'

### Gap 3: Existing Exercise Conversion Components Not Referenced

**Severity:** High
**Location:** spec.md line 40-53 (UI Flow)
**Issue:** The spec describes creating "Custom React component in Payload CMS Admin UI, injected into Lesson edit view" but the codebase already has:
- `src/ui/admin/exercise-conversion/` directory with multiple components
- `src/ui/admin/PdfConversion/` directory with ConversionForm, ExerciseReview
- Existing `LessonConversionPanel` component referenced in Lessons collection
- V1 (`pdfToExercisesTask`) and V2 (`pdfToExercisesV2Task`) pipelines

The spec should clarify if V3 is a new approach or extends existing V2

**Fix Applied:** Added FR-EX-006 to clarify V3 component relationship to existing conversion infrastructure

### Gap 4: Redundant ExtractionLogs Collection

**Severity:** Medium
**Location:** spec.md line 55-62
**Issue:** The spec requests a new `ExtractionLogs` collection but the existing Exercises collection already has comprehensive conversion metadata fields:
- `origin` (manual/conversion/import)
- `sourceDoc` (relationship to media)
- `conversionJobId`
- `pipelineVersion`
- `sourcePageIndex`, `sourceBboxNormalized`
- `extractionMeta` (JSON)

**Fix Applied:** Added FR-EX-007 to either reuse existing exercise fields OR create lightweight ExtractionLogs that links to Exercises (not standalone)

### Gap 5: Missing Access Control Requirements

**Severity:** High
**Location:** spec.md (entire document)
**Issue:** No mention of access control for:
- ExtractionLogs collection
- The new endpoint for extraction

Following existing patterns (ConfigAuditLogs, MCPAuditLogs), these should be admin-only

**Fix Applied:** Added NFR-012 requiring admin-only access for ExtractionLogs

### Gap 6: Lesson Upload Field Already Exists

**Severity:** Medium
**Location:** spec.md line 43 (Admin Flow)
**Issue:** The spec says "Admin uploads PDF/Image to a Lesson" but the Lessons collection already has a `contentFiles` field (line 204-211 in Lessons.ts) for uploading PDFs, videos, images

**Fix Applied:** Updated FR-EX-002 to reference existing contentFiles field instead of implying new upload mechanism

### Gap 7: Pipeline Versioning Confusion

**Severity:** Medium
**Location:** spec.md (entire document)
**Issue:** Spec refers to "V3" but codebase has:
- V1: pdfToExercisesTask
- V2: pdfToExercisesV2Task (image crop pipeline)

V3 should be clearly differentiated - spec should clarify it's a simplified single-exercise synchronous POC vs the batch async V2

**Fix Applied:** Added clarifying text in Overview section about V3 being a simplified POC (single exercise, sync) vs V2 (batch async)

### Gap 8: Missing Tenant Isolation

**Severity:** High
**Location:** spec.md (entire document)
**Issue:** No mention of tenant scoping for:
- ExtractionLogs collection
- The extraction process

All collections in this codebase use tenantField for multi-tenancy

**Fix Applied:** Added NFR-013 requiring tenantField on ExtractionLogs collection

## Changes Made to Spec

- Added FR-EX-001: "Transformation Layer" - Must convert simple LLM output to Exercise content block format
- Added FR-EX-002: "Use existing Lesson.contentFiles field for document upload"
- Added FR-EX-006: "Component should extend or integrate with existing LessonConversionPanel"
- Added FR-EX-007: "ExtractionLogs should link to Exercises via relationship, not duplicate data"
- Added NFR-011: "Use existing Prompts collection with usage='extractor' for prompt versioning"
- Added NFR-012: "ExtractionLogs access: admin-only (create via hooks, read/update/delete disabled)"
- Added NFR-013: "ExtractionLogs must include tenantField for multi-tenancy"
- Updated Output Exercise Format section to clarify block structure requirement
- Updated Technical Context to mention existing V1/V2 pipelines

## Validation Notes

The spec was validated against:
- Exercises collection schema (`src/server/payload/collections/Exercises/`)
- AI extraction service (`src/infra/llm/services/data-extractor-service.ts`)
- Existing conversion components (`src/ui/admin/exercise-conversion/`, `src/ui/admin/PdfConversion/`)
- Lesson collection (`src/server/payload/collections/Lessons.ts`)
- Existing audit log patterns (`ConfigAuditLogs`, `MCPAuditLogs`)
- Prompts collection (`src/server/payload/collections/Prompts.ts`)
