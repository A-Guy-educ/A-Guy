# Plan Gap Analysis: 260308-auto-540

## Summary

- Gaps Found: 3
- Plan Revised: Yes

## Gaps Identified

### Gap 1: Incorrect unit test directory paths

**Severity:** High  
**Issue:** The plan targeted `tests/unit/ui/admin/exercise-conversion/...`, but the repository uses `tests/unit/admin/exercise-conversion/...` for this domain (existing `ConvertForm` test confirms convention). This would cause test creation/execution drift and broken verification commands.  
**Fix Applied:** Updated all planned test file paths and the test run command to use `tests/unit/admin/exercise-conversion/...`.

### Gap 2: FR-5 forward-looking exclusion not explicitly documented in implementation tasks

**Severity:** Medium  
**Issue:** The original plan mentioned extractor-only behavior, but did not require an explicit implementation note/test artifact to satisfy the acceptance criterion that verification exclusion is documented as forward-looking.  
**Fix Applied:** Added explicit Step 2 acceptance criterion requiring a component-level note that V3 uses extractor prompt only and verification exclusion is forward-looking; also added a dedicated test case asserting verifier prompts are not selectable in V3.

### Gap 3: Unnecessary import map generation gate

**Severity:** Medium  
**Issue:** The plan required `pnpm generate:importmap` after adding a React hook/test files. Import-map generation is for Payload admin component path mapping, not for ordinary hooks/tests, and would add noise to validation gates.  
**Fix Applied:** Removed `generate:importmap` from verification commands.

## Changes Made to Plan

- Updated Step 1 requirement scope to include NFR-1 admin auth context explicitly.
- Updated Step 1 test path to `tests/unit/admin/exercise-conversion/hooks/useExtractorPrompts.test.tsx`.
- Added Step 1 acceptance criterion confirming test placement under the existing admin exercise-conversion test convention.
- Updated Step 2 requirement line to explicitly include FR-3 and FR-5.
- Updated Step 2 test path to `tests/unit/admin/exercise-conversion/ConvertV3Button.test.tsx`.
- Added Step 2 test case: verifier prompts are not rendered/selectable in V3.
- Added Step 2 acceptance criterion requiring explicit forward-looking verification exclusion note in component code.
- Updated Step 3 test path to `tests/unit/admin/exercise-conversion/ConvertV3Button.integration.test.tsx`.
- Updated File Change Summary paths from `tests/unit/ui/admin/...` to `tests/unit/admin/...`.
- Updated verification command to `pnpm vitest run tests/unit/admin/exercise-conversion/` and removed import map generation.
