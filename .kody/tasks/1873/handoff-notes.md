## CI Fix for PR #1873 (branch 1849-p2-ask-page-never-finishes-loading-stuck-on-loadin)

### Root Cause of CI Failure
`message-persist.int.spec.ts` returned HTTP 500 instead of 200 when creating a conversation with a unique contextKey.

**What happened**: The test creates `contextKey = "lessons:${testLessonId}-unique-${Date.now()}"`. The route parsed this to extract `value = "${testLessonId}-unique-${Date.now()}"`. The document existence check correctly found no document, so `contextRef` remained `undefined`. However, `conversationData` was built with `contextRef` always present in the object literal (`contextRef,` as a key with undefined value), causing Payload's required relationship validation to fail.

### Fix Applied
Changed `conversationData` from an inline object literal with `contextRef` always present to a mutable `Record<string, unknown>` that conditionally adds `contextRef` only when the document exists:

```typescript
// Before (always includes contextRef: undefined in the object)
const conversationData = {
  ...(guestSessionId ? { guestSession: guestSessionId } : { user: ownerId }),
  contextRef,  // undefined when doc doesn't exist — but KEY IS STILL PRESENT
  contextKey: validated.contextKey,
  ...
}

// After (conditionally adds contextRef key only when doc exists)
const conversationData: Record<string, unknown> = {
  ...(guestSessionId ? { guestSession: guestSessionId } : { user: ownerId }),
  contextKey: validated.contextKey,
  ...
}
if (contextRef) {
  conversationData.contextRef = contextRef
}
```

Payload's required relationship validation triggers even when the value is `undefined` in the data object — the key's presence alone satisfies the field being "touched". By conditionally adding the key only when `contextRef` is truthy, we avoid the validation error.

### Files Changed
- `src/app/api/agent/message/persist/route.ts` — conditionally include contextRef only when document exists