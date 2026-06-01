# Issue #2294: Chat sends fail with 400 error — Learning Assistant completely broken

## Root Cause
The frontend initializes `conversationId` as `null` and sends it in the JSON body. When `JSON.stringify` is called with `conversationId: null`, it produces `{"conversationId": null}` - a literal `null` value, not an omitted key. The Zod schema in `learning-chat.ts` had `conversationId: z.string().optional()` which only accepts `undefined`, not `null`. This caused schema validation to fail with a 400 error on every chat message.

## Fix Applied
Changed `src/server/payload/endpoints/agent/learning-chat.ts` line ~41:
- Before: `conversationId: z.string().optional()`
- After: `conversationId: z.string().nullable().optional()`

This accepts `string | null | undefined` for the conversationId field.

## Test Added
`tests/int/learning-chat-endpoint.int.spec.ts` - 6 tests covering validation and the specific bug reproduction case.

## Files Changed
- `src/server/payload/endpoints/agent/learning-chat.ts` - Schema fix
- `tests/int/learning-chat-endpoint.int.spec.ts` - New test file

## Verification
All 6 tests pass. Quality gates (typecheck, lint, tests) pass.
