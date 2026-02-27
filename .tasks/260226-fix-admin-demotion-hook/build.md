# Build Agent Report: 260226-fix-admin-demotion-hook

## Changes

- **Modified**: `src/server/payload/collections/Users/hooks/preventLastAdminDemotion-hook.ts` - Changed `overrideAccess: false` to `overrideAccess: true` on line 27 to fix the security bug that could allow the last admin to be demoted
- **Created**: `tests/unit/collections/preventLastAdminDemotion-hook.test.ts` - Unit tests for the preventLastAdminDemotion hook

## Tests Written

- `tests/unit/collections/preventLastAdminDemotion-hook.test.ts` - 6 test cases:
  1. should call count with overrideAccess: true (system-level check) - Reproduction test that verifies overrideAccess: true is passed
  2. should throw ValidationError when demoting the last admin
  3. should allow demotion when multiple admins exist
  4. should skip check on create operations
  5. should skip check when role is not changing to student
  6. should skip check when original role is not admin

## Quality

- TypeScript: PASS
- Lint: PASS (only pre-existing warnings, no errors)

## Summary

Fixed the HIGH-priority security bug in the `preventLastAdminDemotion` hook. The bug was that the admin count query used `overrideAccess: false`, which filtered results based on the current user's access control. If a non-admin triggered this code path, they couldn't see other admins, causing `adminCount` to return 0 — incorrectly allowing the last admin to be demoted.

The fix changes `overrideAccess: false` to `overrideAccess: true`, ensuring a system-level admin count that bypasses user-specific access control.
