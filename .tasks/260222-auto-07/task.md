# Task

## Issue Title

Bug: validateContextAccess() always returns true — enrollment not checked
**Description**
In `src/server/services/conversation-service.ts`, the `validateContextAccess()` 
method has TODO comments indicating enrollment is NOT validated. All authenticated 
users can access any course/lesson/exercise context regardless of enrollment.

**Expected**: Only enrolled users (or admins) can access a course's chat context.
**Actual**: All authenticated users pass the access check.

**Files affected**:
- `src/server/services/conversation-service.ts` (validateContextAccess method)

**Notes**:
- The fix requires querying enrollment relationships, but the enrollment 
  data model is not specified here. Investigate before implementing.
- The guest access method (`validateGuestContextAccess`) may also need updating.
- Access control changes need tests.
