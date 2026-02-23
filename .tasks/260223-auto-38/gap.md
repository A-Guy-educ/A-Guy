# Gap Analysis: 260223-auto-38

## Summary

- Gaps Found: 3
- Spec Revised: Yes

## Gaps Found

### Gap 1: Test File Directory Does Not Exist

**Severity:** High
**Location:** `tests/unit/ui/web/media/VideoMedia.test.tsx` (as specified in task.json and spec)
**Issue:** The spec and task.json specify the test file path as `tests/unit/ui/web/media/VideoMedia.test.tsx`, but the directory `tests/unit/ui/web/media/` does not exist in the codebase. The existing test structure uses `tests/unit/components/` and `tests/unit/ui/`. The directory will need to be created.
**Fix Applied:** Updated spec to clarify that the test file directory must be created at the specified path, consistent with task.json requirements.

### Gap 2: Missing Critical Handler Reference Requirement

**Severity:** Critical
**Location:** FR-001 in spec.md
**Issue:** FR-001 requires extracting the handler to a named function (e.g., `handleSuspend`) inside the effect, but doesn't explicitly emphasize that the handler MUST be defined inside the useEffect callback (not outside or as a separate function) to ensure the exact same function reference is used for both `addEventListener` and `removeEventListener`. The current VideoMedia implementation uses an inline arrow function which would create a new reference on each render, making cleanup impossible.
**Fix Applied:** Updated FR-001 to explicitly state: "The handler function must be defined INSIDE the useEffect callback (not outside or as a separate function) to ensure the exact same function reference is used for both addEventListener and removeEventListener."

### Gap 3: Test Enumeration Not Specified

**Severity:** Medium
**Location:** FR-004 in spec.md
**Issue:** FR-004 states "Add 8 tests" but doesn't enumerate what those 8 tests should cover. While the acceptance criteria provides some guidance, it would be clearer to list the specific test cases.
**Fix Applied:** Updated FR-004 to enumerate the 8 specific test cases:
1. Listener is added when component mounts
2. Listener is removed when component unmounts
3. No duplicate listeners after re-render
4. No duplicate listeners after navigation away and back
5. Safety when videoRef.current is null on mount
6. Safety when videoRef.current becomes null after mount
7. Cleanup is called with correct handler reference
8. Multiple mount/unmount cycles don't accumulate listeners

## Changes Made to Spec

- Updated FR-001: Added clarification that handler must be defined inside useEffect callback
- Updated FR-004: Added enumeration of 8 specific test cases
- Added clarification in Guardrails that test directory must be created

## No Gaps Found

The following were considered but are adequately addressed:
- **Null-reference safety (FR-002)**: Already covers both add and remove operations
- **Dependency array (FR-003)**: Empty array `[]` is correct for this use case
- **Type annotations (NFR-001)**: Already specified in the requirements

The spec is otherwise complete and aligned with the codebase patterns. The identified gaps are relatively minor clarifications that will help ensure correct implementation.
