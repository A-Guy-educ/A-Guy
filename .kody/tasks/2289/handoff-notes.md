# Task 2289 - Learning Chat 400 Fix

## What Was Fixed

The `/api/agent/learning-chat` endpoint returned 400 when the frontend sent the first message (no existing conversationId).

**Root Cause**: Frontend React state initializes `conversationId` as `null` and sends it in the request body:
```json
{ "message": "...", "acknowledgment": "Understood", "conversationId": null, "gradeLevel": "7" }
```

The Zod schema used `z.string().optional()` which accepts `undefined` but NOT `null`. Zod returned: "expected string, received null" → 400.

## Files Changed

- `src/server/payload/endpoints/agent/learning-chat.ts`: Changed `conversationId: z.string().optional()` → `z.string().nullish()` (line 41)
- `src/server/payload/endpoints/agent/learning-chat/index.ts`: Same change (line 43), plus `existingConversationId ?? undefined` coercion at call site (line 223)

## Verification

- Schema test `tests/int/learning-chat-schema.int.spec.ts` proves `null` is now accepted
- TypeScript clean
- Lint clean (only pre-existing warning in unrelated file)
- All 13 schema tests pass
