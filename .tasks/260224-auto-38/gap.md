# Gap Analysis: 260224-auto-38

## Summary

- Gaps Found: 4
- Spec Revised: Yes

## Gaps Found

### Gap 1: Service constructor only receives `Payload`, not `PayloadRequest`

**Severity:** Critical
**Location:** `src/server/services/conversation-service.ts` lines 72-77
**Issue:** The `ConversationService` constructor accepts only `Payload` instance, not the full `PayloadRequest` context. This makes it impossible to pass `req` to Local API operations for transaction safety. Callers currently pass `req.payload` (line 283 in chat.ts, line 105 in reset-chat.ts, line 127 in pipeline.ts), but the service cannot access the `req` object itself.

**Fix Applied:** Added FR-001 requirement to spec specifying the service must accept `PayloadRequest` context either via constructor or method parameters. The spec now clearly states: "Refactor ConversationService so it accepts a req/PayloadRequest context".

### Gap 2: No Payload operations pass `req` parameter

**Severity:** Critical
**Location:** `src/server/services/conversation-service.ts` - all Payload operations
**Issue:** There are approximately 21 Payload Local API operations that do not include the `req` parameter:
- Lines 91-101: `this.payload.find()` in `getOrCreateActiveConversation`
- Lines 113-128: `this.payload.create()` in `getOrCreateActiveConversation`
- Lines 140-150: `this.payload.find()` in `resetConversation`
- Lines 155-163: `this.payload.update()` in `resetConversation`
- Lines 175-190: `this.payload.create()` in `resetConversation`
- Lines 215-219: `this.payload.findByID()` in `resolveContext`
- Lines 350-353: `this.payload.findByID()` in `getConversationHistory`
- Lines 368-378: `this.payload.find()` in `getActiveConversation`
- Lines 397-407: `this.payload.find()` in `getOrCreateGuestConversation`
- Lines 418-424: `this.payload.find()` in `getOrCreateGuestConversation` (count query)
- Lines 431-445: `this.payload.create()` in `getOrCreateGuestConversation`
- Lines 461-471: `this.payload.find()` in `getGuestConversation`
- Lines 484-494: `this.payload.find()` in `resetGuestConversation`
- Lines 498-506: `this.payload.update()` in `resetGuestConversation`
- Lines 514-525: `this.payload.create()` in `resetGuestConversation`
- Lines 548-552, 556-560, 564-570, 572-577, 579-584, 586-591: `payload.findByID()` in `buildContextHierarchy`

**Fix Applied:** Added FR-002 requirement to spec: "Update all Payload calls within src/server/services/conversation-service.ts to include the req option so they execute within the caller's transaction/request context."

### Gap 3: `resetConversation` and `resetGuestConversation` are not atomic

**Severity:** Critical
**Location:** `src/server/services/conversation-service.ts` lines 138-197, 480-532
**Issue:** These methods perform multiple write operations (archive existing + create new) without sharing a common `req` context. Each operation runs in its own transaction rather than being atomic. The spec identifies this as the highest-risk path.

Current code in `resetConversation`:
```typescript
// First operation - archive (no req)
await this.payload.update({
  collection: 'conversations',
  id: currentConv.id,
  data: { archivedAt: new Date() },
  // Missing req parameter!
})

// Second operation - create new (no req)  
await this.payload.create({
  collection: 'conversations',
  data: { ... },
  // Missing req parameter!
})
```

**Fix Applied:** Added FR-003 requirement to spec: "resetConversation must perform its multi-step workflow using the same req so it can be committed/rolled back as one unit."

### Gap 4: Standalone `buildContextHierarchy` function also lacks `req`

**Severity:** High
**Location:** `src/server/services/conversation-service.ts` lines 539-600
**Issue:** The `buildContextHierarchy` function is a standalone function (not a method) that uses Payload operations without `req` parameter. This function is used for memory retrieval context building and should also participate in transaction context when called from within a request.

**Fix Applied:** The spec's FR-002 covers "all Payload calls" which includes this function. Added clarification that the function needs to accept `req` as a parameter when called from request context.

## Changes Made to Spec

- **Updated FR-002:** Corrected operation count from 16 to approximately 21 operations
- **Added FR-004:** "Include buildContextHierarchy in req propagation" - The standalone function also needs `req` parameter
- **Updated Acceptance Criteria:** Added requirement for `buildContextHierarchy` to accept optional `req` parameter
- **Added Validation Reference:** Noted existing pattern in `src/server/repos/mcp/audit/audit-service.ts` that shows the recommended approach

## Validation Notes

The existing codebase pattern for transaction-safe service operations can be seen in `src/server/repos/mcp/audit/audit-service.ts`:
- Accepts `req: PayloadRequest` as a parameter
- Uses `req.payload` for Payload instance
- Passes `req` to Local API operations

This pattern should guide the implementation approach.
