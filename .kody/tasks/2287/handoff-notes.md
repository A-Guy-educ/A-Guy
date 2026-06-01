# Task 2287: Admin AI Chat 500 Error

## What I Did

1. **Added integration tests for admin mode chat** in `tests/int/agent-chat.int.spec.ts`:
   - Added `getMCPClient` mock to prevent real HTTP calls to `/api/mcp`
   - Created admin user in `beforeAll` hook
   - Added 4 admin mode tests covering: returns 200 for admin user, returns 401 for unauthenticated, returns 400 for missing acknowledgment, returns 400 when non-admin sends adminMode

2. **Verified all tests pass** - 12 tests in agent-chat.int.spec.ts pass (including 4 new admin mode tests)

3. **Quality gates pass** - TypeScript, lint, and tests all succeed

## Key Finding

The admin chat endpoint (`handleAdminModeChat`) code path looks correct:
- Checks `isAdmin` using `AccountRole.Admin`
- Uses `users:{userId}` as contextKey for admin conversations
- Falls back to `chatWithExerciseHelper` when MCP tools are unavailable
- Gracefully handles MCP initialization failures with try-catch

**The reported 500 error could not be reproduced in tests.** The issue may be:
- Environmental (MCP_ENABLED not set, LLM API key missing)
- Already fixed in a subsequent commit
- Specific to certain user configurations

## Files Changed

- `tests/int/agent-chat.int.spec.ts` - Added admin mode tests and MCP client mock
