# Task

## Issue Title

Security/Refactor: Chat endpoints duplicate auth logic — rate-limit bypass on reset-chat, missing overrideAccess:false
## Description

The 5 chat-related endpoints each independently implement auth + guest session resolution logic, resulting in ~200 lines of copy-pasted boilerplate. This duplication has caused **3 concrete security/behavioral bugs**.

## Bugs Found

### 1. Rate-limit bypass on `reset-chat` endpoint

**File:** `src/server/payload/endpoints/agent/reset-chat.ts`

The `reset-chat` endpoint creates new guest sessions **without calling `checkRateLimit()`**. Compare:
- `chat.ts` line 126: `checkRateLimit(ipHash, userAgentHash)` ✅ present
- `chat-stream.ts` line 81: `checkRateLimit(ipHash, userAgentHash)` ✅ present  
- `reset-chat.ts`: **no rate limit check** ❌ — creates guest sessions freely

An attacker can create unlimited guest sessions by repeatedly hitting `POST /api/agent/reset-chat`.

### 2. `conversations/by-context` GET bypasses collection access control

**File:** `src/app/api/conversations/by-context/route.ts`, lines 31-40

```typescript
const result = await payload.find({
  collection: 'conversations',
  where: { user: { equals: user.id } },
  // Missing: user and overrideAccess: false ❌
})
```

Per AGENTS.md: "When passing `user` to Local API, ALWAYS set `overrideAccess: false`". The GET handler doesn't pass `user` to `payload.find()`, so `overrideAccess` defaults to `true`, bypassing the collection's `isOwner` access control. The DELETE handler correctly uses `overrideAccess: false`.

### 3. Guest message limit check inconsistency

- `chat.ts`: Checks `checkAndIncrementGuestMessageCount` for ALL guest sessions (new and existing)
- `chat-stream.ts`: Checks only for EXISTING guest sessions — **newly-created sessions skip the limit on first message**

## Proposed Solution

Extract a shared `resolveAuthOrGuest()` middleware:

```typescript
// src/server/payload/endpoints/agent/auth-middleware.ts
export async function resolveAuthOrGuest(
  req: PayloadRequest,
  options?: {
    requireRateLimit?: boolean
    requireMessageLimit?: boolean
  }
): Promise<AuthResult | Response>
```

## Files to Change

1. **NEW** `src/server/payload/endpoints/agent/auth-middleware.ts` — shared auth/guest resolution
2. `src/server/payload/endpoints/agent/chat.ts` — replace auth boilerplate with middleware
3. `src/server/payload/endpoints/agent/chat-stream.ts` — replace auth boilerplate with middleware
4. `src/server/payload/endpoints/agent/get-conversation.ts` — replace auth boilerplate with middleware
5. `src/server/payload/endpoints/agent/reset-chat.ts` — replace auth boilerplate (fixes rate-limit bypass)
6. `src/app/api/agent/message/persist/route.ts` — replace auth boilerplate with middleware
7. `src/app/api/conversations/by-context/route.ts` — add `overrideAccess: false` to GET and POST

## Acceptance Criteria

- [ ] All endpoints use shared `resolveAuthOrGuest()` middleware
- [ ] `reset-chat` calls `checkRateLimit()` for new guest sessions
- [ ] Message limit check is consistent across `chat.ts` and `chat-stream.ts`
- [ ] `conversations/by-context` GET and POST pass `user` with `overrideAccess: false`
- [ ] Existing tests continue to pass

## Complexity

Complex — 7 files (1 new + 6 modified), security fixes, shared middleware extraction.

## Labels

security, refactor, chat
