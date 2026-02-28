# Plan Gap Analysis: 260226-auto-18

## Summary

- Gaps Found: 1
- Plan Revised: Yes

## Gaps Identified

### Gap 1: Existing Unit Tests Not Accounted For

**Severity:** High
**Issue:** The plan proposed creating new test files, but the existing test file `tests/unit/access/content-collections-admin-only.test.ts` already contains tests that verify `read: anyone` for Courses, Chapters, and Lessons collections (lines 37-39, 56-58, 74-76). After applying the fix, these existing tests will FAIL because they check that read equals `anyone`, but the fix changes it to an inline function.

**Fix Applied:** Updated the plan to reference the existing test file instead of creating new ones, and added a new acceptance criteria item to update the existing tests to verify the new read access behavior.

## Changes Made to Plan

- **Step 1**: Changed test file reference from `tests/unit/access/courses-status-access.test.ts (NEW)` to `tests/unit/access/content-collections-admin-only.test.ts (EXISTING - update)`
- **Step 2**: Changed test file reference from `tests/unit/access/chapters-status-access.test.ts (NEW)` to `tests/unit/access/content-collections-admin-only.test.ts (EXISTING - update)`
- **Step 3**: Changed test file reference from `tests/unit/access/lessons-status-access.test.ts (NEW)` to `tests/unit/access/content-collections-admin-only.test.ts (EXISTING - update)`
- **Acceptance Criteria**: Added new item `[ ] Updated existing test file to verify new read access behavior (not anyone)`

## Verification of Plan Completeness

- File paths verified: All three collection files exist at specified paths
- Line numbers verified: Courses.ts:30, Chapters.ts:20, Lessons.ts:20 all contain `read: anyone`
- Status field verified: All three collections have a `status` field with options `draft | published | archived`
- Fix implementation verified: Inline function approach matches spec requirement (not using `authenticatedOrPublished`)
