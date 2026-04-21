The implementation is complete. Here's a summary of what was done:

## Changes Made

**`src/server/services/conversation-service.ts`**:
- Added import for `hasEntitlement` from `@/server/services/entitlement_check`
- Implemented proper `validateContextAccess`:
  - Admins always have access
  - Traverses context hierarchy (Exercise → Lesson → Chapter → Course) to find the owning course
  - Only `paid` courses require entitlement check via `courseEntitlements`
  - Free/mandatory/gated courses allow open access
- Implemented proper `validateGuestContextAccess`:
  - Guests cannot have entitlements, so `paid` course access is denied
  - Non-paid courses allow guest access
- Added private helper `getCourseIdFromContext` to traverse the hierarchy

**`tests/unit/lib/services/conversation-service.spec.ts`**:
- Updated test "should allow student access to free courses"
- Added test "should deny student access to paid courses without entitlement"

## Key Design Decision

The task referenced an `enrollments` collection that doesn't exist in the codebase. The actual enrollment model uses `courseEntitlements` on the `User` collection (checked via `hasEntitlement()`). The implementation uses this existing model rather than creating a new collection.

## Verification

- TypeScript compiles: `pnpm typecheck` ✓
- Unit tests pass: 52 tests ✓
- Lint: Pre-existing warnings (not from these changes)
