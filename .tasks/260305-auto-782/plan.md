# Plan: 260305-auto-782 — Auth/Guest Resolver Refactor & Security Fixes

## Rerun Context

This is a rerun triggered via `/cody rerun` with no specific code-level feedback. The previous plan did not exist. This is an initial plan addressing all spec requirements.

## Summary

Refactor 7 chat-related endpoints to use a shared `resolveAuthOrGuest()` authentication/guest-session resolver, fixing 3 security bugs:
1. **FR-004**: Rate-limit bypass on `reset-chat` (no `checkRateLimit` before guest session creation)
2. **FR-005**: `conversations/by-context` GET/POST missing `overrideAccess: false` and `user` on Local API calls
3. **FR-006**: Inconsistent guest message-limit enforcement between `chat` and `chat-stream`

Plus: authenticated user flows must use `overrideAccess: false` instead of `overrideAccess: true` (acceptance criterion #7).

## Assumptions

1. `checkRateLimit` uses in-memory store (acceptable for single-instance deployments per spec Open Question #1)
2. When both authenticated user and guest cookie exist, authenticated user takes precedence and guest cookie is ignored (Open Question #3)
3. Guest sessions are NOT bound to IP/UA on subsequent requests — stored for analytics only (Open Question #2)
4. No additional endpoints beyond the 7 listed need changes (Open Question #4)
5. The `ConversationService` internal methods handle `overrideAccess` correctly already; the fixes target direct `payload.find/create/update` calls in endpoint handlers

## Recommended Skills

No external skills needed — this is a security/refactoring task focused on existing Payload patterns.

---

## Step 1: Create shared `resolveAuthOrGuest` middleware

**Time estimate**: 20-30 minutes

**Files to Touch**:
- `src/server/payload/endpoints/agent/auth-middleware.ts` (NEW)
- `tests/unit/server/endpoints/agent/auth-middleware.test.ts` (NEW)

**Exact Behavior**:

Create a server-only function `resolveAuthOrGuest(req, options)` that:

1. Checks `req.user` first, then falls back to `req.payload.auth({ headers: req.headers })`
2. If authenticated user found → return `{ kind: 'authenticated', user }` (discriminated union)
3. If no user → check guest cookie via `getGuestSessionCookie(req.headers)`
4. If valid guest token → look up session via `getGuestSessionByToken`
5. If no guest session AND `options.allowGuestCreation === true`:
   - If `options.enforceRateLimit === true` → call `checkRateLimit(ipHash, userAgentHash)`, return 429 result if denied
   - Create guest session, build cookie header
   - Return `{ kind: 'guest', guestSession, isNew: true, cookieHeaders: [...] }`
6. If existing guest session found:
   - If `options.enforceGuestMessageLimit === true` → call `checkAndIncrementGuestMessageCount`, return 429 result if denied
   - Return `{ kind: 'guest', guestSession, isNew: false, cookieHeaders: [] }`
7. If nothing found → return `{ kind: 'unauthenticated' }`
8. Cache result on `req.context.__authResolution` if `req.context` exists (FR-008)
9. NEVER set guest identity on `req.user` (FR-002)

**Options type**:
```typescript
interface ResolveAuthOrGuestOptions {
  allowGuestCreation?: boolean    // default false
  enforceRateLimit?: boolean      // default false
  enforceGuestMessageLimit?: boolean // default false
}
```

**Return type** (discriminated union):
```typescript
type AuthResolution =
  | { kind: 'authenticated'; user: PayloadUser }
  | { kind: 'guest'; guestSession: GuestSessionDoc; isNew: boolean; cookieHeaders: string[] }
  | { kind: 'unauthenticated' }
  | { kind: 'rate-limited'; retryAfter: number; remaining: number; resetAt: number }
  | { kind: 'guest-message-limit' }
```

**Tests** (MUST FAIL before, PASS after):

1. **`resolveAuthOrGuest returns authenticated when req.user exists`**
   - Mock `req.user = { id: 'user1', ... }`
   - Call `resolveAuthOrGuest(req, {})`
   - Expect `{ kind: 'authenticated', user: req.user }`

2. **`resolveAuthOrGuest returns guest with rate-limit check when no user and allowGuestCreation + enforceRateLimit`**
   - Mock `req.user = null`, no guest cookie, `checkRateLimit` returns `{ allowed: false, ... }`
   - Call `resolveAuthOrGuest(req, { allowGuestCreation: true, enforceRateLimit: true })`
   - Expect `{ kind: 'rate-limited', ... }`

3. **`resolveAuthOrGuest returns guest-message-limit when existing guest exceeds limit`**
   - Mock existing guest session, `checkAndIncrementGuestMessageCount` returns `{ allowed: false }`
   - Call `resolveAuthOrGuest(req, { enforceGuestMessageLimit: true })`
   - Expect `{ kind: 'guest-message-limit' }`

4. **`resolveAuthOrGuest never sets req.user for guests`** (FR-002)
   - Mock guest session flow
   - Assert `req.user` is still `null/undefined` after call

5. **`resolveAuthOrGuest caches result on req.context`** (FR-008)
   - Call twice with same req
   - Verify auth lookup only happens once

**Acceptance Criteria**:
- [ ] `resolveAuthOrGuest` exported from `auth-middleware.ts`
- [ ] Returns discriminated union with `kind` field
- [ ] Never assigns guest to `req.user`
- [ ] Rate limit checked BEFORE guest session creation
- [ ] Guest message limit checked for existing sessions when option enabled
- [ ] Caches on `req.context.__authResolution`
- [ ] All 5 unit tests pass

**Spec refs**: FR-001, FR-002, FR-008, NFR-002, NFR-003

---

## Step 2: Fix `conversations/by-context` GET and POST access control bypass

**Time estimate**: 15-20 minutes

**Files to Touch**:
- `src/app/api/conversations/by-context/route.ts` (MODIFIED — lines 31-40 for GET, lines 78-90 for POST)
- `tests/int/conversations-by-context-access.int.spec.ts` (NEW — or extend existing `conversations-by-context.int.spec.ts`)

**Root Cause** (FR-005): 
- **GET** (line 31-40): `payload.find()` called without `user` and without `overrideAccess: false`. Payload defaults `overrideAccess: true` for Local API, so collection access control (`isOwner`) is never enforced. Any authenticated user can read any other user's conversations.
- **POST** (line 78-90): `payload.create()` called without `user` and without `overrideAccess: false`. Any authenticated user can create conversations assigned to any user.

**Fix**:
- **GET**: Add `user` and `overrideAccess: false` to the `payload.find()` call (line 31). The `isOwner` access control on the collection will enforce that only the user's own conversations are returned.
- **POST**: Add `user` and `overrideAccess: false` to the `payload.create()` call (line 78). The `authenticated` access control on create will verify the user is authenticated.

**Reproduction Tests**:

1. **`GET /api/conversations/by-context should NOT return another user's conversations`** (MUST FAIL now):
   - Create User A and User B with separate auth tokens
   - Create a conversation owned by User A
   - Call GET with User B's token and `contextKey` matching User A's conversation
   - **Before fix**: Returns User A's conversation (BUG — access control bypassed)
   - **After fix**: Returns empty list (access control enforced)

2. **`POST /api/conversations/by-context should enforce user ownership on create`** (MUST FAIL now):
   - Create User A
   - Call POST with User A's token but try to create a conversation
   - **Before fix**: Creates with no access check (potential for abuse)
   - **After fix**: Creates with `overrideAccess: false`, collection `create: authenticated` access check runs

**Acceptance Criteria**:
- [ ] `payload.find()` in GET handler has `user` and `overrideAccess: false`
- [ ] `payload.create()` in POST handler has `user` and `overrideAccess: false`
- [ ] User cannot read another user's conversations via GET
- [ ] Both reproduction tests pass

**Spec refs**: FR-005, NFR-001

---

## Step 3: Fix rate-limit bypass on `reset-chat`

**Time estimate**: 10-15 minutes

**Files to Touch**:
- `src/server/payload/endpoints/agent/reset-chat.ts` (MODIFIED — lines 65-76)
- `tests/unit/server/endpoints/agent/reset-chat-rate-limit.test.ts` (NEW)

**Root Cause** (FR-004): In `reset-chat.ts` lines 65-76, when no guest session exists, a new guest session is created WITHOUT calling `checkRateLimit()` first. Compare with `chat.ts` lines 122-143 and `chat-stream.ts` lines 77-98 which both call `checkRateLimit` before `createGuestSession`. An attacker can call `POST /api/agent/reset-chat` repeatedly to create unlimited guest sessions.

**Fix**: Add `checkRateLimit(ipHash, userAgentHash)` call between lines 67-68 (after computing hashes, before `createGuestSession`). If rate limit is exceeded, return 429 with same response shape as `chat.ts`.

After Step 1 is complete, this endpoint will use `resolveAuthOrGuest(req, { allowGuestCreation: true, enforceRateLimit: true })` which centralizes this logic. But the immediate fix is to add the rate limit check.

**Reproduction Test**:

1. **`reset-chat should enforce rate limit when creating new guest session`** (MUST FAIL before fix):
   - Mock `checkRateLimit` to return `{ allowed: false, remaining: 0, resetAt: Date.now() + 60000 }`
   - Mock no authenticated user and no existing guest session
   - Call `agentResetChat(req)` 
   - **Before fix**: Returns 200 with new conversation (rate limit bypassed)
   - **After fix**: Returns 429 with `error: 'Too many requests...'`

2. **`reset-chat should create guest session when rate limit allows`**:
   - Mock `checkRateLimit` to return `{ allowed: true, ... }`
   - Call `agentResetChat(req)` with valid contextKey
   - Returns 200 with new conversation

**Acceptance Criteria**:
- [ ] `checkRateLimit` is called before `createGuestSession` in `reset-chat.ts`
- [ ] Returns 429 when rate limit exceeded
- [ ] Includes `Retry-After` header
- [ ] Both tests pass

**Spec refs**: FR-004

---

## Step 4: Fix inconsistent guest message-limit enforcement between `chat` and `chat-stream`

**Time estimate**: 15-20 minutes

**Files to Touch**:
- `src/server/payload/endpoints/agent/chat-stream.ts` (MODIFIED — lines 100-127)
- `src/server/payload/endpoints/agent/chat.ts` (MODIFIED — lines 120-155, for reference/verification)
- `tests/unit/server/endpoints/agent/chat-stream-guest-limit.test.ts` (NEW)

**Root Cause** (FR-006): In `chat-stream.ts`, the guest message limit check (`checkAndIncrementGuestMessageCount`) is ONLY called for existing guest sessions (line 111, inside `else` block at line 108). For **newly created** guest sessions (lines 100-107), the message count is never checked/incremented — the first message bypasses the limit.

Compare with `chat.ts` lines 166-185: the message limit check runs for ALL guest sessions (both new and existing) via the condition `if (!user && guestSession)` at line 166, which runs AFTER the new session creation block.

**Fix**: Move the `checkAndIncrementGuestMessageCount` call in `chat-stream.ts` to AFTER the guest session resolution block (after line 127), matching `chat.ts` pattern — apply it whenever `!user && guestSession` regardless of whether the session is new or existing.

**Reproduction Test**:

1. **`chat-stream should enforce guest message limit for newly created guest sessions`** (MUST FAIL before fix):
   - Mock: no authenticated user, no existing guest cookie, `createGuestSession` succeeds, `checkAndIncrementGuestMessageCount` returns `{ allowed: false, ... }`
   - Call `agentChatStream(req)` 
   - **Before fix**: Proceeds to pipeline (limit not checked for new sessions)
   - **After fix**: Returns 429 with `'Guest message limit reached'`

2. **`chat-stream should enforce guest message limit for existing guest sessions`** (should already pass):
   - Mock: existing guest session, `checkAndIncrementGuestMessageCount` returns `{ allowed: false }`
   - Returns 429

**Acceptance Criteria**:
- [ ] `checkAndIncrementGuestMessageCount` called for both new AND existing guest sessions in `chat-stream.ts`
- [ ] Message limit check happens at the same lifecycle point as in `chat.ts`
- [ ] First message of a new guest session is subject to message limits
- [ ] Both tests pass

**Spec refs**: FR-006

---

## Step 5: Refactor all endpoints to use `resolveAuthOrGuest`

**Time estimate**: 25-30 minutes

**Files to Touch**:
- `src/server/payload/endpoints/agent/chat.ts` (MODIFIED — lines 96-165 replaced with resolver call)
- `src/server/payload/endpoints/agent/chat-stream.ts` (MODIFIED — lines 49-136 replaced with resolver call)
- `src/server/payload/endpoints/agent/get-conversation.ts` (MODIFIED — lines 25-60 replaced with resolver call)
- `src/server/payload/endpoints/agent/reset-chat.ts` (MODIFIED — lines 41-88 replaced with resolver call)
- `src/app/api/agent/message/persist/route.ts` (MODIFIED — lines 29-46 replaced with resolver call)
- `src/app/api/conversations/by-context/route.ts` (MODIFIED — GET/POST/DELETE auth blocks)
- `tests/int/agent-chat.int.spec.ts` (MODIFIED — update mocks if needed)
- `tests/int/agent-chat-streaming.int.spec.ts` (MODIFIED — update mocks if needed)
- `tests/int/reset-chat-endpoint.int.spec.ts` (MODIFIED — update mocks if needed)
- `tests/int/get-conversation-endpoint.int.spec.ts` (MODIFIED — update mocks if needed)

**Exact Behavior**:

Replace duplicated auth/guest boilerplate in each endpoint with a call to `resolveAuthOrGuest()`. Each endpoint passes its specific options:

| Endpoint | `allowGuestCreation` | `enforceRateLimit` | `enforceGuestMessageLimit` |
|---|---|---|---|
| `chat.ts` | `true` | `true` | `true` |
| `chat-stream.ts` | `true` | `true` | `true` |
| `reset-chat.ts` | `true` | `true` | `false` |
| `get-conversation.ts` | `false` | `false` | `false` |
| `message/persist/route.ts` | `false` | `false` | `false` |
| `conversations/by-context` GET | `false` | `false` | `false` |
| `conversations/by-context` POST | `false` | `false` | `false` |

Each endpoint handles the resolver's return `kind`:
- `'authenticated'` → proceed with `user`
- `'guest'` → proceed with `guestSession`, propagate `cookieHeaders`
- `'unauthenticated'` → return 401
- `'rate-limited'` → return 429 with rate limit headers
- `'guest-message-limit'` → return 429 with message limit response

**For `conversations/by-context`**: This is a Next.js route handler, not a Payload endpoint. It uses `getPayload()` + `payload.auth()` instead of `req.user`. Create a thin adapter or use the resolver with a mock-like req object containing just `payload` and `headers`.

**Cookie propagation** (FR-007): Every response path (including SSE streams in `chat-stream.ts`) must forward `cookieHeaders` from the resolver result.

**Tests**:

1. **`all endpoints should use resolveAuthOrGuest`** — integration test that verifies:
   - `chat.ts`: unauthenticated request with no guest cookie returns 401
   - `chat-stream.ts`: same behavior
   - `reset-chat.ts`: same behavior for guest without rate limit bypass
   - All existing integration tests still pass

2. **`cookie propagation works for streaming responses`**:
   - Mock new guest session creation in `chat-stream.ts`
   - Verify `Set-Cookie` header is present in SSE response headers

**Acceptance Criteria**:
- [ ] All 7 files use `resolveAuthOrGuest` for auth/guest resolution
- [ ] No duplicated auth boilerplate remains
- [ ] Endpoint-specific policies expressed via options, not ad-hoc logic (NFR-003)
- [ ] All existing tests still pass
- [ ] Cookie headers propagated in all response paths including SSE (FR-007)

**Spec refs**: FR-001, FR-003, FR-007, NFR-003

---

## Step 6: Fix `overrideAccess: true` for authenticated users in `chat.ts`, `chat-stream.ts`, and `pipeline.ts`

**Time estimate**: 20-25 minutes

**Files to Touch**:
- `src/server/payload/endpoints/agent/chat.ts` (MODIFIED — lines 306-315, 424-433, 487-498, 643-652, 776-785)
- `src/server/payload/endpoints/agent/chat/pipeline.ts` (MODIFIED — lines 191-200, 326-335)
- `tests/unit/server/endpoints/agent/chat-override-access.test.ts` (NEW)

**Root Cause**: Multiple `payload.update()` calls on conversations use `overrideAccess: true` even for authenticated users. Per acceptance criterion #7 and the guardrails, authenticated users MUST use `overrideAccess: false` so collection access control (`isOwner`) is enforced.

The pattern across `chat.ts`, `chat-stream.ts` (via `pipeline.ts`), and `persistAssistantMessage`:
```typescript
await req.payload.update({
  collection: 'conversations',
  id: conversationId,
  data: { ... },
  user: req.user,
  overrideAccess: true,  // ← BUG: should be false for authenticated users
})
```

**Fix**: Change to conditional `overrideAccess`:
- If `req.user` exists → `overrideAccess: false` (enforce collection access control)
- If guest session (no `req.user`) → `overrideAccess: true` with ownership query constraint (guest sessions can't use Payload access control since there's no `req.user`)

This affects:
1. `chat.ts` `handleAdminModeChat` — 3 `payload.update` calls (lines ~306, ~424, ~487)
2. `chat.ts` `handleContextScopedChat` — 2 `payload.update` calls (lines ~643, ~776)  
3. `pipeline.ts` `runChatPipeline` — 1 `payload.update` call (line ~191)
4. `pipeline.ts` `persistAssistantMessage` — 1 `payload.update` call (line ~326)

**Reproduction Test**:

1. **`authenticated user conversations update should use overrideAccess: false`**:
   - Unit test that spies on `payload.update` during chat flow for an authenticated user
   - Verify `overrideAccess: false` is passed
   - **Before fix**: `overrideAccess: true` (BUG)
   - **After fix**: `overrideAccess: false`

2. **`guest session conversations update should use overrideAccess: true with ownership filter`**:
   - Unit test that spies on `payload.update` during guest chat flow
   - Verify `overrideAccess: true` is used (acceptable for guests)
   - Verify the conversation was obtained via guest-session-scoped query (ownership proven)

**Acceptance Criteria**:
- [ ] All `payload.update/find/create` calls with `user` also have `overrideAccess: false`
- [ ] Guest session flows use `overrideAccess: true` only with narrowly-scoped ownership filters
- [ ] Both tests pass
- [ ] `tsc --noEmit` passes

**Spec refs**: NFR-001, Acceptance Criteria #7, Guardrails

---

## Step 7: Verify all tests pass and validate security

**Time estimate**: 10-15 minutes

**Files to Touch**:
- No new files — validation step

**Actions**:
1. Run `pnpm -s tsc --noEmit` — must pass
2. Run `pnpm test:int` — all existing integration tests must pass
3. Run `pnpm test` for unit tests — all new and existing unit tests must pass
4. Grep codebase for `overrideAccess: true` + `user:` patterns in the 7 target files — must find zero instances where an authenticated user is passed with `overrideAccess: true`
5. Grep for `payload.find|create|update|delete` calls in `conversations/by-context/route.ts` — all must have `user` + `overrideAccess: false` or be admin-only justified `overrideAccess: true`

**Tests**:

1. **Regression**: All tests in `tests/int/agent-chat.int.spec.ts`, `tests/int/agent-chat-streaming.int.spec.ts`, `tests/int/reset-chat-endpoint.int.spec.ts`, `tests/int/get-conversation-endpoint.int.spec.ts`, `tests/int/conversations-by-context.int.spec.ts` pass
2. **Security audit**: `rg 'overrideAccess:\s*true' src/server/payload/endpoints/agent/ src/app/api/conversations/by-context/ src/app/api/agent/message/persist/` — any remaining `true` must be for guest sessions only

**Acceptance Criteria**:
- [ ] `tsc --noEmit` passes
- [ ] All existing tests pass (NFR-004)
- [ ] No authenticated user flows use `overrideAccess: true`
- [ ] All 3 security bugs verified fixed (rate-limit, access-control, message-limit)

**Spec refs**: NFR-004, all acceptance criteria

---

## Test File Summary

| Test File | Type | Covers |
|---|---|---|
| `tests/unit/server/endpoints/agent/auth-middleware.test.ts` | Unit | Step 1 — resolver logic |
| `tests/int/conversations-by-context-access.int.spec.ts` | Integration | Step 2 — access control bypass |
| `tests/unit/server/endpoints/agent/reset-chat-rate-limit.test.ts` | Unit | Step 3 — rate limit bypass |
| `tests/unit/server/endpoints/agent/chat-stream-guest-limit.test.ts` | Unit | Step 4 — message limit consistency |
| `tests/unit/server/endpoints/agent/chat-override-access.test.ts` | Unit | Step 6 — overrideAccess fix |
| Existing integration tests (updated) | Integration | Step 5, 7 — regression |

## Risk Notes

- The `conversations/by-context` fix (Step 2) changes behavior for the GET handler: it will now filter conversations by the authenticated user via Payload's `isOwner` access control. This is the CORRECT behavior but may surface previously hidden bugs if other code depends on being able to read all conversations.
- The `overrideAccess: false` change (Step 6) for authenticated users means the `isOwner` access function will run. Since `isOwner` checks `user.id === conversation.user`, this should work correctly for the conversation owner. Admin users are also handled (`user.role === AccountRole.Admin`).
- The `conversations/by-context` POST handler (Step 2) currently doesn't pass `user` to `data.user` — it hardcodes `user: user.id`. With `overrideAccess: false`, the `create: authenticated` access check will verify the user is authenticated, which is correct.
