# Gap Analysis: 260222-auto-07

## Summary

- Gaps Found: 4
- Spec Revised: Yes

## Gaps Found

### Gap 1: Missing Enrollment Data Model (Critical)

**Severity:** Critical
**Location:** Database schema - no enrollments collection exists
**Issue:** The spec assumes an enrollment model exists, but the codebase has NO enrollment system:
- No `enrollments` collection
- No `enrolledCourses` relationship on Users collection
- No `students` relationship on Courses collection
- Access types (`free`, `mandatory`, `gated`) are client-side UI hints only, not server-side access control

**Fix Applied:** Added FR-ENROLL-001: Create Enrollments Collection with proper fields and access control.

### Gap 2: Context Hierarchy Traversal Logic Missing (High)

**Severity:** High
**Location:** `src/server/services/conversation-service.ts` - validateContextAccess method
**Issue:** The TODO comments in the code show example implementations that traverse the context hierarchy (exercise→lesson→chapter→course), but no actual logic exists. The fix needs to:
1. Handle all context types: exercises, lessons, chapters, courses
2. Traverse parent relationships to find the root course
3. Check enrollment at the course level

**Fix Applied:** Added FR-ENROLL-002: Implement validateContextAccess Enrollment Check with explicit hierarchy traversal requirements.

### Gap 3: Guest Access Not Restricted (Medium)

**Severity:** Medium
**Location:** `src/server/services/conversation-service.ts` - validateGuestContextAccess method
**Issue:** The guest access method currently always returns `true`, allowing guests unrestricted access to all chat contexts. According to task notes, this may need updating to check enrollment or restrict to free content.

**Fix Applied:** Added FR-ENROLL-003: Update Guest Access Logic to define the expected behavior.

### Gap 4: No Test Coverage for Enrollment Validation (High)

**Severity:** High
**Location:** `tests/unit/lib/services/conversation-service.spec.ts`
**Issue:** Current tests only verify the placeholder behavior (always returns true for students). No tests exist for:
- Enrollment-based access control
- Hierarchy traversal
- Guest restrictions
- Non-enrolled user denial

**Fix Applied:** Added FR-ENROLL-004: Add Unit Tests with specific test cases for enrollment validation.

## Changes Made to Spec

- Added FR-ENROLL-001: Create Enrollments Collection with schema details and access control
- Added FR-ENROLL-002: Implement validateContextAccess Enrollment Check with hierarchy traversal
- Added FR-ENROLL-003: Update Guest Access Logic with options for free content vs. enrollment requirement
- Added FR-ENROLL-004: Add Unit Tests with specific test cases
- Added NFR-ENROLL-001: Performance requirements for enrollment queries
- Added NFR-ENROLL-002: Security requirements for enrollment data handling
- Added NFR-ENROLL-003: Type safety requirements
- Added "Data Model Investigation Results" section documenting the current state and required implementation

## Additional Notes

The implementation requires a phased approach:
1. First create the Enrollments collection (FR-ENROLL-001)
2. Then implement the validateContextAccess logic (FR-ENROLL-002)
3. Then update guest access (FR-ENROLL-003)
4. Finally add tests (FR-ENROLL-004)

After creating the Enrollments collection, run `pnpm generate:types` to update TypeScript types.
