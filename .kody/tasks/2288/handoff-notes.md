# Task 2288: Floating Admin Chat Panel 500 Error

## Summary

Investigated the reported 500 error on `/api/agent/chat` when using the floating admin chat panel. **The bug is already fixed** in the codebase.

## Verification

All 4 admin mode tests pass:
- `returns 200 for admin user with adminMode=true and no context` ✓
- `returns 401 when adminMode=true but user is not authenticated` ✓
- `returns 400 when adminMode=true but acknowledgment is missing` ✓
- `uses student user conversation even when student sends adminMode=true` ✓

Quality gates: typecheck ✓, lint (warning only) ✓

## Root Cause

The admin mode fallback (when MCP tools are unavailable) was previously not passing conversation history to `chatWithExerciseHelper`. This was fixed in commit `491f90c9f` ("fix: pass conversation history to chatWithExerciseHelper in admin mode fallback").

## Pre-existing Issue

One test (`processes chat request successfully for authenticated user`) fails with a NotFound error in `ConversationService.getCourseIdFromContext`. This is a test isolation issue unrelated to admin mode chat.

## Files

- `tests/int/agent-chat.int.spec.ts` - Contains admin mode tests (added by task 2287)
