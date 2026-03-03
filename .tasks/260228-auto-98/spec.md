# Specification (promoted)

Skipped via input_quality — taskify determined spec is unnecessary.

## Requirements

# Task

## Issue Title

Fix conversation DELETE endpoint bypassing ownership check
## Bug

In `src/app/api/conversations/by-context/route.ts`, the DELETE handler (lines 98-125) authenticates the user but uses `overrideAccess: true` when archiving the conversation **without verifying the conversation belongs to the requesting user**.

Any authenticated user can archive any other user's conversation by passing an arbitrary `id` query parameter.

Compare to the GET handler in the same file (lines 31-40), which correctly scopes queries to `user: { equals: user.id }`.

```typescript
// DELETE handler — no ownership check
await payload.update({
  collection: 'conversations',
  id: conversationId,
  data: { archivedAt: new Date().toISOString() },
  overrideAccess: true, // ← bypasses isOwner access control
  context: { allowArchive: true },
})
```

## Expected

The DELETE handler should enforce ownership, either by:
1. Using `overrideAccess: false` with `user` so Payload's `isOwner` access control enforces ownership, or
2. Adding an explicit ownership check before the update

## Fix

- `src/app/api/conversations/by-context/route.ts` — Change DELETE to use `overrideAccess: false` + pass `user`
- Also fix the `as any` cast in the POST handler (line 87) while touching this file
- Verify `isOwner` access control in `src/server/payload/collections/Conversations.ts` handles updates correctly with `overrideAccess: false`

/cody fix the conversation DELETE endpoint ownership bypass in src/app/api/conversations/by-context/route.ts: change overrideAccess to false and pass user to enforce isOwner access control


## Acceptance Criteria

- [ ] Fix applied as described in task.md
- [ ] TypeScript compilation passes
- [ ] Unit tests pass
