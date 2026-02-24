# Plan: Fix Transaction Safety in Guest Session Services

**Task ID**: 260224-auto-40
**Task Type**: fix_bug
**Risk Level**: high
**Closes**: #524

## Summary

Both `guest-session.ts` and `guest-session-upgrade.ts` call `getPayload({ config })` to create new Payload instances for every operation, instead of accepting a `payload` instance (or `req`) from the caller. This means:

1. **No transaction safety** — operations within the same request run in separate transactions
2. **No atomicity** — if `claimGuestConversations` fails mid-way, some conversations transfer but the session isn't revoked
3. **Unnecessary overhead** — creating new Payload connections instead of reusing the existing one

### Root Cause

Every function in both files independently calls `const payload = await getPayload({ config })` instead of accepting `payload: Payload` as a parameter from the calling endpoint (which already has `req.payload` available).

### Fix Strategy

1. Add a `payload: Payload` parameter to all functions that currently call `getPayload()`
2. Remove all `getPayload({ config })` calls from these functions
3. Update all callers to pass their existing `req.payload` instance
4. For functions called within other functions in the same files (e.g., `revokeGuestSession` called from `claimGuestConversations`), pass `payload` through

**Note**: We are passing `payload: Payload` (not `req: PayloadRequest`) because:
- These services don't need the full request object
- The callers use `overrideAccess: true` for guest operations anyway
- The Payload instance carries the transaction context when called from endpoints

---

## Step 1: Add `payload` parameter to `guest-session.ts` functions and remove `getPayload()` calls

**Root Cause**: Each function independently calls `getPayload({ config })`, running operations outside the caller's transaction context.

**Files to Touch**:
- `src/server/services/guest-session.ts` (MODIFIED — lines 18-19, 134-170, 173-194, 196-232, 234-251, 260-301)

**Reproduction Test**:
- Test location: `tests/unit/server/services/guest-session.test.ts` (NEW)
- Test: Verify that `createGuestSession`, `getGuestSessionByToken`, `updateGuestSessionActivity`, `revokeGuestSession`, and `checkAndIncrementGuestMessageCount` all accept a `payload` parameter and do NOT import/call `getPayload`
- Why it fails now: Functions currently require no `payload` parameter and internally call `getPayload()`

**Tests (MUST FAIL before, PASS after)**:

```
Test 1: "guest-session functions accept payload parameter"
  - Import the module and verify each function's signature accepts a payload parameter
  - Mock payload operations and verify they're called on the passed payload instance
  - FAILS before: functions don't accept payload param; internally call getPayload()
  - PASSES after: functions accept payload param; use it for all operations

Test 2: "guest-session module does not import getPayload"
  - Static analysis: read the source file and verify no getPayload import exists
  - FAILS before: file imports getPayload from 'payload'
  - PASSES after: import removed
```

**Exact Changes**:

1. Remove `import { getPayload } from 'payload'` and `import config from '@payload-config'` (lines 18-19)
2. Add `import type { Payload } from 'payload'`
3. `createGuestSession(options: { req?: Request; ipHash?; userAgentHash? })` → `createGuestSession(payload: Payload, options: { ipHash?; userAgentHash? })`
   - Remove `req` from options (it was unused — only cast to `Request` by callers)
   - Remove `const payload = await getPayload({ config })` (line 139)
4. `getGuestSessionByToken(token: string)` → `getGuestSessionByToken(payload: Payload, token: string)`
   - Remove `const payload = await getPayload({ config })` (line 174)
5. `updateGuestSessionActivity(sessionId: string)` → `updateGuestSessionActivity(payload: Payload, sessionId: string)`
   - Remove `const payload = await getPayload({ config })` (line 199)
6. `revokeGuestSession(sessionId, claimedByUser)` → `revokeGuestSession(payload: Payload, sessionId, claimedByUser)`
   - Remove `const payload = await getPayload({ config })` (line 238)
7. `checkAndIncrementGuestMessageCount(guestSessionId)` → `checkAndIncrementGuestMessageCount(payload: Payload, guestSessionId)`
   - Remove `const payload = await getPayload({ config })` (line 263)

**Acceptance Criteria**:
- [ ] No `getPayload` import in `guest-session.ts`
- [ ] No `@payload-config` import in `guest-session.ts`
- [ ] All 5 functions accept `payload: Payload` as first parameter
- [ ] All functions use the passed `payload` instance for DB operations
- [ ] Pure utility functions (`generateSessionToken`, `hashToken`, `verifyTokenHash`, `hashIP`, `hashUserAgent`) remain unchanged
- [ ] Cookie-related functions remain unchanged (they don't use Payload)
- [ ] Unit tests pass

---

## Step 2: Add `payload` parameter to `guest-session-upgrade.ts` functions and remove `getPayload()` calls

**Root Cause**: `claimGuestConversations` and `hasPendingGuestConversations` independently call `getPayload()` AND call `getGuestSessionByToken` / `revokeGuestSession` which also called `getPayload()`. After Step 1, the inner functions accept `payload`, so this step passes `payload` through.

**Files to Touch**:
- `src/server/services/guest-session-upgrade.ts` (MODIFIED — lines 15-16, 32-81, 83-97)

**Reproduction Test**:
- Test location: `tests/unit/server/services/guest-session-upgrade.test.ts` (NEW)
- Test: Verify `claimGuestConversations` and `hasPendingGuestConversations` accept a `payload` parameter, pass it to inner guest-session functions, and don't call `getPayload`
- Why it fails now: Functions call `getPayload()` internally and call inner functions without passing `payload`

**Tests (MUST FAIL before, PASS after)**:

```
Test 1: "claimGuestConversations passes payload to inner calls"
  - Mock payload.find, payload.update, and the imported guest-session functions
  - Verify claimGuestConversations calls getGuestSessionByToken(payload, token)
    and revokeGuestSession(payload, sessionId, userId) — with payload as first arg
  - FAILS before: inner calls don't pass payload
  - PASSES after: inner calls pass payload

Test 2: "guest-session-upgrade module does not import getPayload"
  - Static analysis: verify no getPayload import
  - FAILS before: file imports getPayload
  - PASSES after: import removed
```

**Exact Changes**:

1. Remove `import { getPayload } from 'payload'` and `import config from '@payload-config'` (lines 15-16)
2. Add `import type { Payload } from 'payload'`
3. `claimGuestConversations(userId, sessionToken, headers)` → `claimGuestConversations(payload: Payload, userId, sessionToken, headers)`
   - Remove `const payload = await getPayload({ config })` (line 37)
   - Change `getGuestSessionByToken(sessionToken)` → `getGuestSessionByToken(payload, sessionToken)` (line 39)
   - Change `revokeGuestSession(session.id, userId)` → `revokeGuestSession(payload, session.id, userId)` (line 74)
4. `hasPendingGuestConversations(sessionToken)` → `hasPendingGuestConversations(payload: Payload, sessionToken)`
   - Change `getGuestSessionByToken(sessionToken)` → `getGuestSessionByToken(payload, sessionToken)` (line 84)
   - Remove `const payload = await getPayload({ config })` (line 87)

**Acceptance Criteria**:
- [ ] No `getPayload` import in `guest-session-upgrade.ts`
- [ ] No `@payload-config` import in `guest-session-upgrade.ts`
- [ ] Both functions accept `payload: Payload` as first parameter
- [ ] `payload` is passed to `getGuestSessionByToken` and `revokeGuestSession` calls
- [ ] Unit tests pass

---

## Step 3: Update all callers to pass `req.payload` or `payload`

**Root Cause**: After Steps 1-2 change the function signatures, all callers must be updated to pass the payload instance they already have.

**Files to Touch**:
- `src/server/payload/endpoints/agent/chat.ts` (MODIFIED — lines 117, 145-148, 170)
- `src/server/payload/endpoints/agent/chat-stream.ts` (MODIFIED — lines 72, 100-103, 112)
- `src/server/payload/endpoints/agent/reset-chat.ts` (MODIFIED — lines 62, 69-72)
- `src/server/payload/endpoints/agent/get-conversation.ts` (MODIFIED — line 45)
- `src/app/(frontend)/signup/actions/signup_createUser-action.ts` (MODIFIED — line 103)
- `src/app/(frontend)/login/login_authenticate-action.ts` (MODIFIED — line 83)

**Reproduction Test**:
- Test location: `tests/unit/server/services/guest-session.test.ts` (MODIFIED — add caller verification)
- Test: TypeScript compilation succeeds with no errors (`tsc --noEmit`)
- Why it fails now: After Steps 1-2, callers pass wrong arguments (missing `payload` first arg)

**Tests (MUST FAIL before, PASS after)**:

```
Test 1: "TypeScript compilation passes"
  - Run `pnpm tsc --noEmit`
  - FAILS after Steps 1-2 without Step 3: callers have wrong arguments
  - PASSES after Step 3: all callers updated

Test 2: "Callers pass payload as first argument (static analysis)"
  - Grep source files to verify each call site passes payload/req.payload as first arg
  - FAILS before: callers don't pass payload
  - PASSES after: all callers pass payload
```

**Exact Changes**:

### `chat.ts` (has `req.payload` available):
- Line 117: `getGuestSessionByToken(guestToken)` → `getGuestSessionByToken(req.payload, guestToken)`
- Lines 145-148: `createGuestSession({ req: req as unknown as Request, ipHash, userAgentHash })` → `createGuestSession(req.payload, { ipHash, userAgentHash })`
- Line 170: `checkAndIncrementGuestMessageCount(guestSession.id)` → `checkAndIncrementGuestMessageCount(req.payload, guestSession.id)`
- Remove `createGuestSession` import of `req` option (no longer needed)

### `chat-stream.ts` (has `req.payload` available):
- Line 72: `getGuestSessionByToken(guestToken)` → `getGuestSessionByToken(req.payload, guestToken)`
- Lines 100-103: `createGuestSession({ req: req as unknown as Request, ipHash, userAgentHash })` → `createGuestSession(req.payload, { ipHash, userAgentHash })`
- Line 112: `checkAndIncrementGuestMessageCount(guestSession.id)` → `checkAndIncrementGuestMessageCount(req.payload, guestSession.id)`

### `reset-chat.ts` (has `req.payload` available):
- Line 62: `getGuestSessionByToken(guestToken)` → `getGuestSessionByToken(req.payload, guestToken)`
- Lines 69-72: `createGuestSession({ req: req as unknown as Request, ipHash, userAgentHash })` → `createGuestSession(req.payload, { ipHash, userAgentHash })`

### `get-conversation.ts` (has `req.payload` available):
- Line 45: `getGuestSessionByToken(guestToken)` → `getGuestSessionByToken(req.payload, guestToken)`

### `signup_createUser-action.ts` (has `payload` from `getPayload()`):
- Line 103: `claimGuestConversations(user.id, guestToken, headers)` → `claimGuestConversations(payload, user.id, guestToken, headers)`

### `login_authenticate-action.ts` (has `payload` from `getPayload()`):
- Line 83: `claimGuestConversations(result.user.id, guestToken, headers)` → `claimGuestConversations(payload, result.user.id, guestToken, headers)`

**Acceptance Criteria**:
- [ ] `pnpm tsc --noEmit` passes with no errors
- [ ] No caller passes `req` inside the options object to `createGuestSession` anymore
- [ ] Every call to `createGuestSession`, `getGuestSessionByToken`, `updateGuestSessionActivity`, `revokeGuestSession`, `checkAndIncrementGuestMessageCount`, `claimGuestConversations`, `hasPendingGuestConversations` has `payload` or `req.payload` as first argument
- [ ] `pnpm lint` passes (or only has pre-existing warnings)

---

## Step 4: Update test factory and add integration-level verification

**Files to Touch**:
- `tests/unit/server/services/guest-session.test.ts` (MODIFIED — consolidate all tests)
- `tests/unit/server/services/guest-session-upgrade.test.ts` (MODIFIED — consolidate)

**Tests (MUST FAIL before, PASS after)**:

```
Test 1: "createGuestSession uses provided payload instance"
  - Create a mock Payload instance
  - Call createGuestSession(mockPayload, { ipHash: 'test' })
  - Verify mockPayload.create was called (not a separate payload instance)
  - FAILS before: function ignores the payload param / param doesn't exist
  - PASSES after: function uses the provided payload instance

Test 2: "claimGuestConversations uses provided payload for all operations"
  - Create a mock Payload instance
  - Mock getGuestSessionByToken and revokeGuestSession
  - Call claimGuestConversations(mockPayload, userId, token, headers)
  - Verify payload.find and payload.update called on mockPayload
  - Verify getGuestSessionByToken called with mockPayload as first arg
  - Verify revokeGuestSession called with mockPayload as first arg
  - FAILS before: function uses getPayload() internally
  - PASSES after: function uses provided payload

Test 3: "no getPayload import in either service file"
  - Read both source files
  - Assert neither contains "getPayload" or "@payload-config"
  - FAILS before: both files import getPayload
  - PASSES after: imports removed
```

**Acceptance Criteria**:
- [ ] All unit tests pass: `pnpm vitest run tests/unit/server/services/guest-session.test.ts`
- [ ] All unit tests pass: `pnpm vitest run tests/unit/server/services/guest-session-upgrade.test.ts`
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes
- [ ] No `getPayload` or `@payload-config` imports remain in either service file

---

## Verification Checklist

After all steps complete:

1. **Type Check**: `pnpm tsc --noEmit` — MUST pass
2. **Lint**: `pnpm lint` — MUST pass (or pre-existing only)
3. **Unit Tests**: `pnpm vitest run tests/unit/server/services/guest-session*.test.ts` — MUST pass
4. **Static Analysis**: Neither `guest-session.ts` nor `guest-session-upgrade.ts` contains `getPayload` or `@payload-config`
5. **All callers updated**: Every call site passes `payload`/`req.payload` as first argument

## Assumptions

1. The `req` field in `createGuestSession` options was only used to cast `req as unknown as Request` at call sites — it's not actually used inside the function. Removing it is safe.
2. No other files besides the 6 identified callers use these functions (verified by grep).
3. MongoDB adapter doesn't require replica sets for the transaction context to be carried — even without formal transactions, using the same Payload instance avoids creating redundant connections.
4. The test factory in `tests/factories/guest-session.factory.ts` doesn't need changes since it directly uses `payload.create()` (it doesn't call our service functions).
5. The `updateGuestSessionActivity` function is not currently called by any endpoint (no callers found in grep), but we still fix it for correctness and future use.
