# Plan Gap Analysis: 260302-auto-66

## Summary

- Gaps Found: 8
- Plan Revised: Yes

## Gaps Identified

### Gap 1: `promptId` field type mismatched spec

**Severity:** High  
**Issue:** Plan defined `promptId` as text, but FR-LOG-001 requires a relationship to `prompts`.  
**Fix Applied:** Updated plan Step 1 to define `promptId` as `relationship -> prompts` (nullable).

### Gap 2: Stage logging lifecycle not guaranteed through creation

**Severity:** High  
**Issue:** Original plan made `logId` optional in create-from-preview, so `stage=created` could be skipped.  
**Fix Applied:** Made `logId` required in create-from-preview endpoint and added explicit `stage=created` update on successful exercise creation.

### Gap 3: MCQ null-correct handling conflicted with schema

**Severity:** Critical  
**Issue:** Plan allowed empty `correctOptionIds` when `correctAnswer` is null, but `McqAnswerSchema` requires at least one correct option and exactly one when single-select.  
**Fix Applied:** Updated Step 4 to default null/invalid `correctAnswer` to the first option ID.

### Gap 4: MCQ default block mode incompatible with single-answer requirement

**Severity:** High  
**Issue:** `ExerciseBlockDefaults.question_mcq()` defaults to multiple select, which does not match FR output expectations for single-correct MCQ.  
**Fix Applied:** Added explicit overrides in Step 4: `selectionMode='single'` and `answer.multiSelect=false`.

### Gap 5: UI/API contract mismatch for free-response answer editing

**Severity:** Medium  
**Issue:** Modal step included editable free-response correct answer, but API payload in the plan did not include a field to carry it.  
**Fix Applied:** Added `acceptedAnswerText` to create-from-preview request schema and mapped it to `acceptedAnswers`.

### Gap 6: Acceptance coverage missing PDF+image E2E and manual checklist

**Severity:** High  
**Issue:** Original E2E step emphasized image path and did not fully map spec verification checklist (2 PDFs + 3 images + 5 conversions + failed sample).  
**Fix Applied:** Revised integration step to include both PDF and image flows and added a dedicated manual verification step mirroring the spec checklist.

### Gap 7: Spec wording mismatch for button label and preview guarantee

**Severity:** Medium  
**Issue:** Plan used “Convert (V3)” while spec names “Convert V3”; preview-only behavior lacked explicit test assertion that conversion endpoint does not create exercises.  
**Fix Applied:** Updated label to “Convert V3” and added endpoint test assertion to verify no direct exercise creation.

### Gap 8: Logging helper transaction-safety detail was not enforced in core steps

**Severity:** Medium  
**Issue:** Requirement to pass `req` through nested payload operations was present in notes but not concretely embedded in the implementation step.  
**Fix Applied:** Step 2 now explicitly requires `createExtractionLog/updateExtractionLog` signatures with optional `req` and forwarding `req` to nested calls.

## Changes Made to Plan

- Replaced plan with a revised 9-step implementation sequence aligned to spec and current codebase paths.
- Updated Step 1 schema details (`promptId` relationship, `admin.group='System'`).
- Updated Step 2 to enforce stage-by-stage logging contract and req-forwarding in log helpers.
- Updated Step 3 to assert preview-only behavior (no exercise creation in convert endpoint).
- Updated Step 4 creation logic for schema-safe MCQ defaults and free-response answer editing support.
- Updated UI steps to use “Convert V3” and keep explicit preview-before-create flow.
- Expanded test strategy to include PDF+image E2E plus V2 regression checks.
- Added explicit final manual verification checklist from spec.
