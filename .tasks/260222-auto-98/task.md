# Task

## Description
Both `guest-session.ts` and `guest-session-upgrade.ts` use `getPayload({ config })` to get a standalone Payload instance. All CRUD operations run outside any request transaction.

Particularly concerning: `claimGuestConversations` in `guest-session-upgrade.ts` claims atomicity ("all convs transfer or none") but uses a for-loop without `req` — if one update fails mid-loop, partial transfer results.

## Files Affected
### guest-session.ts
- Lines 148, 172, 196, 217, 235, 261, 282 — all Payload operations missing `req`

### guest-session-upgrade.ts
- Lines 38, 54, 81 — `claimGuestConversations` iterates and updates without `req`

## Expected Fix
Refactor both services to accept `req` parameter and pass it to all Payload operations:
```typescript
async claimGuestConversations(guestSessionId: string, userId: string, req: PayloadRequest) {
  const convos = await req.payload.find({
    collection: 'conversations',
    where: { guestSession: { equals: guestSessionId } },
    req, // ✅ Transaction safe
  })
  
  for (const convo of convos.docs) {
    await req.payload.update({
      collection: 'conversations',
      id: convo.id,
      data: { user: userId },
      req, // ✅ Same transaction
    })
  }
}
```

## Priority
HIGH — Transaction safety, data integrity risk in session upgrade flow
