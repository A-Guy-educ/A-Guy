# Plan Gap Analysis: 260301-auto-20

## Summary

- Gaps Found: 8
- Plan Revised: Yes

## Gaps Identified

### Gap 1: Prompt versioning not concretely implemented

**Severity:** Critical  
**Issue:** The original plan referenced optional `promptId` but did not define how tenant-scoped extractor prompts are resolved/validated (`usage: 'extractor'`, published status) or how prompt version is persisted for logs.  
**Fix Applied:** Added explicit `prompt-resolver.ts`, prompt validation rules in Step 3, `promptVersion` field in ExtractionLogs, and metadata propagation in extraction response.

### Gap 2: Append-only logging violated by update flow

**Severity:** Critical  
**Issue:** Original Step 5 updated ExtractionLogs to attach exercise, conflicting with NFR-012 append-only (`update: disabled`).  
**Fix Applied:** Reworked to append-only lifecycle logs using `stage: 'extract' | 'create'`, with a new create-stage log entry linking the exercise (no updates).

### Gap 3: No server-side enforcement of preview-before-create rule

**Severity:** Critical  
**Issue:** Create endpoint accepted arbitrary content and `extractionLogId` without strict verification, allowing bypass of FR-EX-004 preview/edit gate.  
**Fix Applied:** Added mandatory extraction-log validation in Step 5 (exists, success, extract-stage, lesson/media match, duplicate-create guard).

### Gap 4: Null `correctAnswer` handling conflicted with spec intent

**Severity:** High  
**Issue:** Original transform defaulted unknown MCQ answers to first option only, losing explicit `correctAnswer: null` semantics required by spec.  
**Fix Applied:** Split transform into `toPreviewDraft()` (preserves `correctAnswer: null`) and `toExerciseContent()` (schema-valid fallback for persistence), plus updated tests.

### Gap 5: Tenant isolation under-specified in extraction path

**Severity:** High  
**Issue:** Original plan validated media attachment but did not fully specify lesson-tenant prompt scoping and end-to-end tenant checks.  
**Fix Applied:** Added explicit lesson tenant resolution, prompt tenant/usage/status validation, and tenant-scoped creation checks in Steps 3 and 5.

### Gap 6: "Published" creation behavior ambiguous vs actual schema

**Severity:** Medium  
**Issue:** Spec says create as published, but `exercises` collection has no draft/status field. Original plan did not clarify.  
**Fix Applied:** Added explicit note in Step 5 that exercise creation is immediately available under current read model (treated as published in this project).

### Gap 7: Acceptance criteria 3/4/5 coverage was weak

**Severity:** Medium  
**Issue:** Prior tests focused mainly on API extraction/create and did not explicitly cover lesson-query/render compatibility and solvability validation smoke checks.  
**Fix Applied:** Expanded Step 7 with render/query compatibility and validation-logic smoke scenarios tied to V3-generated blocks.

### Gap 8: Missing required type generation gate after schema changes

**Severity:** Medium  
**Issue:** Plan changed Payload schema but did not require `pnpm generate:types`, which is required by project rules.  
**Fix Applied:** Added `pnpm generate:types` to Step 1 acceptance and global Quality Gates.

## Changes Made to Plan

- Added new file/step coverage for `src/server/services/exercise-conversion/v3/prompt-resolver.ts`.
- Added `src/infra/llm/services/data-extractor-service.ts` as a modified file for prompt override + raw response capture.
- Updated Step 1 schema to include `promptVersion` and `stage` for append-only lifecycle logging.
- Reworked Step 2 transform contract to separate preview-preserving and persistence-safe outputs.
- Updated Step 3 orchestration to include prompt resolution, tenant checks, PDF first-page render specifics, and first-question selection behavior.
- Updated Step 5 to enforce preview gate and append-only logging (removed update-based log mutation).
- Expanded Step 7 integration criteria to cover render/query and answer-validation smoke compatibility.
- Added `pnpm generate:types` to quality requirements.
