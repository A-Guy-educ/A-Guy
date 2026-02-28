# Plan Gap Analysis: 260222-auto-07

## Summary

- Gaps Found: 4
- Plan Revised: Yes

## Gaps Identified

### Gap 1: Missing `select` Usage for Security (NFR-ENROLL-002)

**Severity:** High
**Issue:** The spec requires "Never expose enrollment data in API responses (use `select` to limit fields)". The original plan did not include this security measure.
**Fix Applied:** 
- Added Step 1: "Use `select` to limit fields returned (e.g., only return id and status) to prevent data leakage in API responses"
- Added Step 2: "Use `select: { id: true, accessType: true }` to limit returned fields (security)"
- Added Step 3: "Use `select` to limit returned fields when querying"

### Gap 2: Missing Access Denied Logging (NFR-ENROLL-002)

**Severity:** Medium
**Issue:** The spec requires "Log access denied events for audit purposes". The original plan did not include this.
**Fix Applied:** Added Step 2: "Log access denied events for audit purposes using the existing logger"

### Gap 3: Guest Access Logic - Unclear accessType Source

**Severity:** Medium
**Issue:** The spec's Option A requires restricting guest access to free content, but it was unclear how to get `accessType` - from enrollment record or course defaults. The original plan was vague.
**Fix Applied:** Updated Step 3 implementation to clarify:
- First check enrollment's `accessType` field (if enrolled)
- Fall back to course's default access settings
- Only allow guest access if accessType='free'

### Gap 4: Missing Backward Compatibility Check (NFR-ENROLL-003)

**Severity:** Low
**Issue:** The spec requires "Ensure backward compatibility with existing chat API contracts". This was not explicitly addressed.
**Fix Applied:** Added to Acceptance Criteria Checklist: "Backward compatibility maintained with existing chat API contracts"

## Changes Made to Plan

- Added security guidance about using `select` to limit fields in Steps 1, 2, and 3
- Added logging requirement for access denied events in Step 2
- Clarified guest access logic to explain how to determine free vs paid content
- Added backward compatibility to acceptance criteria

## Codebase Validation

Verified the following:
- Collections location: `src/server/payload/collections/` (confirmed correct path pattern)
- conversation-service.ts exists at `src/server/services/conversation-service.ts`
- validateContextAccess method exists at lines 300-344
- validateGuestContextAccess method exists at lines 346-358
- Test file exists at `tests/unit/lib/services/conversation-service.spec.ts`
- Hierarchy relationships verified: Exercise→Lesson→Chapter→Course

## No Gaps Found (if clean)

The following spec requirements are already covered in the original plan:
- FR-ENROLL-001: Enrollments collection with proper fields
- FR-ENROLL-002: validateContextAccess implementation with admin bypass and hierarchy traversal
- FR-ENROLL-003: Guest access restricted to free content (Option A)
- FR-ENROLL-004: Unit tests for enrollment validation
- NFR-ENROLL-001: Performance requirements (overrideAccess: false, indexing)
- Type generation requirement
