# Bug #1847 Fix: Guiding Question button triggers 404 on /api/agent/message/persist

## What was fixed

The `/api/agent/message/persist` endpoint returned 404 when no active conversation existed for the given `contextKey`. When users clicked "Guiding Question" in an exercise, `addAssistantMessage()` called `persistMessage()` which POSTed to this endpoint. Since no conversation existed yet (user hadn't chatted), the message was lost and a 404 appeared in the console.

## Root cause

The persist route was designed to only append to existing conversations. It returned 404 if none existed. But the Guiding Question flow can trigger this endpoint before any chat message has been sent.

## Changes made

**`src/app/api/agent/message/persist/route.ts`**:
- When `result.docs.length === 0`, instead of returning 404, the route now:
  1. Parses the `contextKey` to extract `relationTo` and `value` (e.g., `"lessons:abc123"` → `relationTo: "lessons"`, `value: "abc123"`)
  2. Creates a new conversation with the required fields
  3. Persists the message to the newly created conversation

**`tests/int/message-persist.int.spec.ts`**:
- New integration test covering the bug scenario (auto-creates conversation when none exists)
- Tests both authenticated and existing-conversation cases

## Key design note

The fix parses `contextKey` to build `contextRef` for the new conversation. This matches how `getOrCreateConversation` works in `src/server/payload/endpoints/agent/chat/context-resolution.ts`.
