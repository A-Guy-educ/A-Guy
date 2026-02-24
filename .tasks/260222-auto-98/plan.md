# Plan: Transaction Safety Fix for Guest Session Services

**Task ID**: 260222-auto-98
**Task Type**: fix_bug
**Spec Requirements**: FR-1, FR-2, FR-3

---

## Summary

Both `guest-session.ts` and `guest-session-upgrade.ts` create standalone Payload instances via `getPayload({ config })` inside every function call, rather than accepting a `req` (PayloadRequest) parameter. This means all CRUD operations run outside any request transaction. The `claimGuestConversations` function in `guest-session-upgrade.ts` claims atomicity but uses a for-loop of individual updates without `req` — if one update fails mid-loop, partial transfer results.

**Root Cause**: Functions use `getPayload({ config })` internally instead of accepting and forwarding `req` from the caller's request context. This prevents Payload's transaction system from grouping operations atomically.

---

## Assumptions

1. **Backward compatibility**: Callers that don't have a `req` available (e.g. server actions using `getPayload`) should still work. We make `req` optional so existing callers don't break.
2. **PayloadRequest type**: We use `PayloadRequest` from `payload` which includes `payload` instance and transaction context. When `req` is provided, we use `req.payload` instead of `getPayload({ config })`.
3. **Callers in endpoints** (chat.ts, chat-stream.ts, reset-chat.ts, get-conversation.ts) all have a `PayloadRequest` available — they should pass it through but we won't mandate caller changes in this task (future improvement). The service functions will accept `req` optionally.
4. **Server actions** (login, signup) don't have a `PayloadRequest` — they will continue to work without passing `req`.
5. **The cleanup cron** uses `Payload` directly, not `PayloadRequest` — it already operates correctly without `req` transaction safety since it's a batch cleanup with individual error handling.

---

## Step 1: Add `req` parameter to `guest-session.ts` service functions

**Root Cause**: All 5 async CRUD functions (`createGuestSession`, `getGuestSessionByToken`, `updateGuestSessionActivity`, `revokeGuestSession`, `checkAndIncrementGuestMessageCount`) call `getPayload({ config })` internally, creating standalone Payload instances that bypass any request transaction.

**Files to Touch**:
- `src/server/services/guest-session.ts` (MODIFIED - lines 134-301)

**Changes**:
1. Import `PayloadRequest` type from `payload`
2. Add optional `req?: PayloadRequest` parameter to each of these 5 functions
3. When `req` is provided, use `req.payload` and pass `req` to all Payload CRUD operations
4. When `req` is not provided, fall back to `getPayload({ config })` (backward compat)
5. Each Payload operation (`create`, `find`, `findByID`, `update`) gets `req` passed as a property

Specific function signatures change to:
- `createGuestSession(options: { req?: PayloadRequest; ipHash?: string; userAgentHash?: string })`
  - Note: `req` already exists in options but typed as `Request`. Rename it to `httpReq` or add a separate `payloadReq` field, OR since `req` is unused in the function body (not passed to Payload ops), simply add a new `payloadReq?: PayloadRequest` field to options and pass it through.
  - Actually, looking at the code, `options.req` is declared but never used inside the function. The simplest approach: add a separate `payloadReq?: PayloadRequest` to the options object and use it.
- `getGuestSessionByToken(token: string, payloadReq?: PayloadRequest)`
- `updateGuestSessionActivity(sessionId: string, payloadReq?: PayloadRequest)`
- `revokeGuestSession(sessionId: string, claimedByUser: string, payloadReq?: PayloadRequest)`
- `checkAndIncrementGuestMessageCount(guestSessionId: string, payloadReq?: PayloadRequest)`

For each function, the pattern is:
```typescript
const payload = payloadReq?.payload ?? await getPayload({ config })
// Then for each operation, add: ...(payloadReq ? { req: payloadReq } : {})
```

**Reproduction Test** (MUST FAIL before fix):
- Test location: `tests/int/guest-session-transaction-safety.int.spec.ts`
- Test: `guest-session.ts functions should accept and forward payloadReq parameter`
- What it tests: 
  1. Call `createGuestSession` with a `payloadReq` parameter and verify the created session is accessible via `payloadReq.payload`
  2. Call `getGuestSessionByToken` with `payloadReq` and verify it returns the session
  3. Call `updateGuestSessionActivity` with `payloadReq` and verify the session is updated
  4. Call `revokeGuestSession` with `payloadReq` and verify the session status is 'revoked'
  5. Call `checkAndIncrementGuestMessageCount` with `payloadReq` and verify the count increments
- Why it fails: The functions don't accept `payloadReq` parameter yet — TypeScript compile error or parameter is ignored

**Verification**:
- `pnpm -s tsc --noEmit` passes (no type errors)
- All existing tests still pass (backward compat since `payloadReq` is optional)
- New test passes: functions accept and use `payloadReq` when provided

**Acceptance Criteria**:
- [ ] All 5 CRUD functions accept optional `payloadReq?: PayloadRequest` parameter
- [ ] When `payloadReq` is provided, `req.payload` is used instead of `getPayload()`
- [ ] When `payloadReq` is provided, all Payload operations include `req: payloadReq`
- [ ] When `payloadReq` is NOT provided, existing behavior is preserved (backward compat)
- [ ] TypeScript compiles without errors

---

## Step 2: Add `req` parameter to `guest-session-upgrade.ts` and ensure atomicity in `claimGuestConversations`

**Root Cause**: `claimGuestConversations` creates its own Payload instance and loops through conversations updating them one by one without transaction context. If the 3rd of 5 updates fails, 2 conversations are transferred and 3 are not — violating atomicity. `hasPendingGuestConversations` also creates a standalone Payload instance.

**Files to Touch**:
- `src/server/services/guest-session-upgrade.ts` (MODIFIED - lines 32-97)

**Changes**:
1. Import `PayloadRequest` type from `payload`
2. Add optional `payloadReq?: PayloadRequest` parameter to `claimGuestConversations`
3. When `payloadReq` is provided, use `payloadReq.payload` and pass `payloadReq` as `req` to all Payload operations (find, update) AND to the called functions (`getGuestSessionByToken`, `revokeGuestSession`)
4. When `payloadReq` is not provided, fall back to `getPayload({ config })`
5. Add optional `payloadReq?: PayloadRequest` parameter to `hasPendingGuestConversations`
6. Same pattern: use `payloadReq.payload` when available, fallback otherwise
7. Pass `payloadReq` through to `getGuestSessionByToken` call in both functions

Function signature changes:
- `claimGuestConversations(userId: string, sessionToken: string, headers?: Headers, payloadReq?: PayloadRequest)`
- `hasPendingGuestConversations(sessionToken: string, payloadReq?: PayloadRequest)`

For `claimGuestConversations`, each `payload.update` in the for-loop gets `req: payloadReq` when available, ensuring all updates share the same transaction:
```typescript
await payload.update({
  collection: 'conversations',
  id: conv.id,
  data: { user: userId, guestSession: null } as ClaimConversationData,
  overrideAccess: true,
  ...(payloadReq ? { req: payloadReq } : {}),
})
```

And the `revokeGuestSession` call passes `payloadReq`:
```typescript
await revokeGuestSession(session.id, userId, payloadReq)
```

**Reproduction Test** (MUST FAIL before fix):
- Test location: `tests/int/guest-session-transaction-safety.int.spec.ts` (same file as Step 1)
- Test: `claimGuestConversations should pass req to all Payload operations for atomicity`
- What it tests:
  1. Create a guest session with 2 conversations
  2. Call `claimGuestConversations` with a `payloadReq` and verify both conversations are transferred to the user
  3. Verify the guest session is revoked
  4. Verify the `payloadReq` parameter is accepted without TypeScript errors
- Why it fails: The function doesn't accept `payloadReq` parameter yet — TypeScript compile error or parameter is ignored

**Additional Test**: `hasPendingGuestConversations should accept payloadReq parameter`
- Create a guest session with a conversation
- Call `hasPendingGuestConversations(token, payloadReq)` and verify it returns `true`
- Why it fails: Parameter not accepted yet

**Verification**:
- `pnpm -s tsc --noEmit` passes
- All existing tests still pass
- New tests pass: functions accept and use `payloadReq`
- `claimGuestConversations` passes `req` to ALL nested Payload operations

**Acceptance Criteria**:
- [ ] `claimGuestConversations` accepts optional `payloadReq?: PayloadRequest`
- [ ] All Payload operations in `claimGuestConversations` include `req: payloadReq` when provided
- [ ] `getGuestSessionByToken` and `revokeGuestSession` calls in upgrade service pass `payloadReq`
- [ ] `hasPendingGuestConversations` accepts optional `payloadReq?: PayloadRequest`
- [ ] Backward compatibility maintained (no `payloadReq` = existing behavior)
- [ ] TypeScript compiles without errors

---

## Step 3: Verify TypeScript compilation and full test suite

**Files to Touch**:
- None (verification only)

**Actions**:
1. Run `pnpm -s tsc --noEmit` to verify no type errors
2. Run `pnpm test:int` to verify all existing tests pass
3. Run new integration test: `pnpm exec vitest run tests/int/guest-session-transaction-safety.int.spec.ts`

**Acceptance Criteria**:
- [ ] `pnpm -s tsc --noEmit` exits with code 0
- [ ] All existing integration tests pass
- [ ] New `guest-session-transaction-safety.int.spec.ts` test passes
- [ ] No runtime errors from missing req handling

---

## Test File: `tests/int/guest-session-transaction-safety.int.spec.ts` (NEW)

This integration test file covers both Step 1 and Step 2. It verifies:

1. **FR-1**: All `guest-session.ts` functions accept and forward `payloadReq`
2. **FR-2**: All `guest-session-upgrade.ts` functions accept and forward `payloadReq`
3. **FR-3**: `claimGuestConversations` passes `req` to all nested operations

### Test Structure:
```
describe('Guest Session Transaction Safety')
  describe('guest-session.ts functions (FR-1)')
    it('createGuestSession should accept payloadReq and pass req to payload.create')
    it('getGuestSessionByToken should accept payloadReq and pass req to payload.find')
    it('updateGuestSessionActivity should accept payloadReq and pass req to payload operations')
    it('revokeGuestSession should accept payloadReq and pass req to payload.update')
    it('checkAndIncrementGuestMessageCount should accept payloadReq and pass req to payload operations')
    it('functions work without payloadReq (backward compat)')

  describe('guest-session-upgrade.ts functions (FR-2, FR-3)')
    it('claimGuestConversations should accept payloadReq parameter')
    it('claimGuestConversations should transfer all conversations atomically')
    it('hasPendingGuestConversations should accept payloadReq parameter')
    it('functions work without payloadReq (backward compat)')
```

### Setup Pattern:
- Use `getPayload({ config })` for test setup (creating test data)
- Use the `guest-session.factory.ts` to create test guest sessions
- Create test users and conversations for upgrade tests
- Clean up all test data in `afterAll`

---

## Design Decisions

1. **Parameter naming**: Using `payloadReq` instead of `req` to avoid confusion with the existing `options.req` (typed as `Request`) in `createGuestSession`. This makes it clear we're passing a Payload request object for transaction context.

2. **Optional parameter**: Making `payloadReq` optional preserves backward compatibility. Server actions (login, signup) don't have a `PayloadRequest` available, so they continue to work without changes.

3. **Spread pattern**: Using `...(payloadReq ? { req: payloadReq } : {})` to conditionally add `req` to Payload operations. This is clean and doesn't add `undefined` to the operation options.

4. **No caller changes in this task**: We deliberately don't modify the endpoint callers (chat.ts, chat-stream.ts, etc.) to pass their `req` through. That's a follow-up improvement. This task focuses on making the service functions _capable_ of accepting transaction context.

5. **Integration test over unit test**: We use an integration test with a real Payload instance to verify the functions actually work with the `payloadReq` parameter, not just that they accept it at the type level.
