# Task

## Issue Title

[HIGH] Bug: ConversationService — all Payload operations missing req parameter (transaction safety)
## Description
`ConversationService` receives a raw `Payload` instance in its constructor and calls `this.payload.find/create/update` without passing `req`. None of these operations participate in the caller's transaction. Particularly risky for `resetConversation` (archive + create) which should be atomic.

## Files Affected
- `src/server/services/conversation-service.ts` — ~16 operations across lines: 90, 112, 139, 154, 174, 214, 347, 365, 394, 415, 428, 458, 481, 495, 511, 545-583

## Current Pattern (broken)
```typescript
class ConversationService {
  constructor(private payload: Payload) {}

  async findConversation() {
    return this.payload.find({
      collection: 'conversations',
      where: { ... },
      // ❌ Missing: req
    })
  }
}
```

## Expected Fix
Refactor to accept `req` (or `PayloadRequest`) and pass it through:
```typescript
class ConversationService {
  constructor(private payload: Payload) {}

  async findConversation(req: PayloadRequest) {
    return this.payload.find({
      collection: 'conversations',
      where: { ... },
      req, // ✅ Transaction safe
    })
  }
}
```

## Priority
HIGH — Transaction safety, data integrity risk especially in resetConversation
