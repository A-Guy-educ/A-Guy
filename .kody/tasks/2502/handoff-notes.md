# Fix for #2502: Learning Assistant chat returns HTTP 400

## What was fixed

The `POST /api/agent/learning-chat` endpoint returned HTTP 400 when `AgentChatWindow` sent `conversationId: null` (first message, no existing conversation).

## Root cause

`AgentChatWindow` sends `conversationId: null` for the first message (no existing conversation). The schema in `learning-chat.ts` had `conversationId: z.string().optional()` which rejects `null` — only `undefined` or absent values pass optional validation. This caused a schema validation error → HTTP 400.

## Changes made

1. `src/server/payload/endpoints/agent/learning-chat.ts`:
   - Changed `conversationId: z.string().optional()` to `conversationId: z.string().nullish()`
   - `.nullish()` accepts `string | null | undefined` — the `null` case is handled by the existing `if (conversationId)` falsy check

2. `src/server/payload/endpoints/agent/learning-chat/index.ts`:
   - Same schema fix
   - Added `?? undefined` when passing to `getOrCreateUserConversation` to satisfy TypeScript (the function expects `string | undefined`, not `null`)

3. `tests/unit/server/endpoints/agent/learning-chat-schema.test.ts`:
   - New unit test file with 6 tests covering schema validation
   - Key test: `should accept conversationId: null as "new conversation" signal`
   - Test was RED before the fix (asserting null should be accepted, but schema rejected it) and is now GREEN

## Why the fix is safe

The existing `if (conversationId)` check in the handler treats `null` as falsy, correctly falling through to "create new conversation" logic. The schema change only makes the validation match the existing runtime behavior.
