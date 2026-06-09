# Issue #2563 Fix — Admin AI Chat HTTP 500

## What was wrong

In `handleAdminModeChat` (src/server/payload/endpoints/agent/chat.ts), when the MCP plugin returned tools, the code took the tool-calling path and called `provider.generateChatCompletionWithTools(...)`. This call was NOT wrapped in a try-catch. When the LLM API failed (model not found, quota exceeded, network error), the exception propagated up uncaught and was returned as HTTP 500.

The existing fallback path (chatWithExerciseHelper) already handled failures correctly with `if (!result.success)`. The bug was that the tool-calling path had no equivalent protection.

## What was changed

1. **src/server/payload/endpoints/agent/chat.ts**: Wrapped the entire `if (tools.length > 0)` block in a try-catch. On any LLM error, it logs and falls through to the existing fallback path below (lines 487+).

2. **tests/int/admin-chat-500.int.spec.ts**: New integration test that mocks `generateChatCompletionWithTools` to throw, mocks MCP to return tools (triggering the tool-calling path), and asserts the request returns 200 with success=true.

## How to verify

Run `pnpm exec vitest run tests/int/admin-chat-500.int.spec.ts --config ./vitest.config.mts` — both tests pass.

## Key files

- `src/server/payload/endpoints/agent/chat.ts` lines 413-485 — fix applied here
- `tests/int/admin-chat-500.int.spec.ts` — new repro test
