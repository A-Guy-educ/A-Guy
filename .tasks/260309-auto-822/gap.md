# Gap Analysis: 260309-auto-822

## Summary

- Gaps Found: 7
- Spec Revised: Yes

## Gaps Found

### Gap 1: Missing "V3 Converter" Module

**Severity:** High
**Location:** No existing V3 converter module found in codebase
**Issue:** The spec (FR-001) assumes there is an existing V3 converter to enhance, but no specific module with that name exists. The closest patterns found are:
- `/src/app/api/exercises/import/route.ts` - General import endpoint
- `/src/server/payload/endpoints/exercises/import-from-lesson.ts` - Lesson content import
- `/src/server/payload/endpoints/exercises/import-from-image.ts` - Image-based import

**Fix Applied:** Added NFR-009 requiring the converter to be implemented in the existing exercise endpoints directory, following the same patterns as existing import endpoints.

### Gap 2: V3 Input Payload Schema Not Defined

**Severity:** Critical
**Location:** Specification lacks input format definition
**Issue:** The spec mentions "V3 question/subquestion content" but doesn't define:
- What fields are in the V3 payload
- How "original sequential order" is represented
- Whether it's a single string, array of nodes, mixed JSON, etc.

**Fix Applied:** Added Open Questions #6-9 to gather more context, and clarified FR-002 to require a normalized internal representation.

### Gap 3: Latex Block Type Missing from Supported Mappings

**Severity:** Medium
**Location:** Spec FR-005 lists 11 block types
**Issue:** The spec lists 11 target block types but the codebase has an additional `latex` block type (see `/src/server/payload/collections/Exercises/schemas.ts` line 157-164). The spec should explicitly include Latex.

**Fix Applied:** Updated FR-005 to explicitly include "Latex" as a supported target block mapping.

### Gap 4: ExerciseAssets Access Control May Be Insufficient

**Severity:** High
**Location:** `/src/server/payload/collections/ExerciseAssets.ts`
**Issue:** The current access control allows `create: authenticated`, meaning any logged-in user can create assets. The spec's NFR-003 requires "narrowly-scoped" privileged execution for internal asset writes.

**Fix Applied:** Added Guardrail clarifying that privileged bypass must be internal-only, and added explicit entrypoint authorization requirement in Guardrails section.

### Gap 5: No Existing Segmentation Logic for Mixed-Format Content

**Severity:** High
**Location:** No segmentation algorithm exists
**Issue:** FR-004 requires sequential segmentation for mixed-format subquestions, but no such logic exists. This is a core requirement that needs implementation.

**Fix Applied:** Added FR-004-bis requiring an explicit deterministic segmentation algorithm to be implemented and documented.

### Gap 6: No Fallback Logic for Asset Creation Failures

**Severity:** Medium
**Location:** Asset creation flow lacks error handling
**Issue:** FR-010 requires degraded behavior when asset materialization fails, but no such fallback logic exists.

**Fix Applied:** Added explicit requirement in Guardrails about fallback behavior, referencing Media block schema which can store external URLs as fallback.

### Gap 7: Block Schema Variants Not Fully Aligned

**Severity:** Medium
**Location:** Spec FR-006 vs actual schemas
**Issue:** The spec mentions "Select" and "Multiple Choice" as separate types, but in the codebase they are represented as a single `question_select` block with `variant` field ('true_false' or 'mcq') and `selectionMode` field.

**Fix Applied:** Updated FR-005 to clarify mapping:
- "Select Question" maps to `question_select` with `variant: 'true_false'` or `variant: 'mcq'`
- "Multiple Choice Question" maps to `question_select` with `variant: 'mcq'` and `selectionMode: 'single'|'multiple'`

## Changes Made to Spec

- **Added FR-004-bis:** Segmentation algorithm - requiring deterministic algorithm design and documentation
- **Updated FR-005:** Added Latex block type to supported mappings, clarified question_select variants
- **Added NFR-009:** Implementation location - requiring V3 converter in existing exercise endpoints directory
- **Updated Guardrails:** Added entrypoint authorization requirement and clarified privileged bypass scope
- **Added Open Questions #6-9:** About implementation location, permissions, legacy content handling, and segmentation algorithm

## Domain Expert Validation Needed

The following questions should be validated with domain experts:

1. **@payload-expert:** Is the `question_select` with `variant`/`selectionMode` the correct schema pattern for the converter to map to?
2. **@payload-expert:** Should the V3 converter be a new endpoint or extend existing import endpoints?
3. **@security-auditor:** Is the current `create: authenticated` on ExerciseAssets sufficient, or does it need a more restrictive access for the converter's privileged execution?
