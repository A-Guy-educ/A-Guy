# Plan: Fix Guest → Registered Account Upgrade Race Condition

## Overview

Fix a high-severity race condition in guest → registered account upgrades. The current `claimGuestConversations()` flow is non-atomic: it transfers conversations one-by-one without locking, can orphan conversations created during the claim window, and the cleanup cron can delete in-flight data. The fix introduces a `claiming` lock state on guest sessions, makes the claim flow idempotent with atomic CAS transitions, blocks new guest operations during claiming, and makes the cleanup cron safety-first.

**Spec requirements covered**: FR-001 through FR-008, NFR-001 through NFR-004.

---

## Steps

### Step 1: Update GuestSessions Collection — Add `claiming` status, deprecate `expired`

**Files:**
- `src/server/payload/collections/GuestSessions.ts` (MODIFIED)
- `tests/factories/guest-session.factory.ts` (MODIFIED)

**Changes:**
1. In `GuestSessions.ts` line 134, update the `status` field options:
   - Replace `{ label: 'Expired', value: 'expired' }` with `{ label: 'Claiming', value: 'claiming' }`
   - Keep `active` and `revoked`
   - Final options: `active`, `claiming`, `revoked`
2. Update admin description (line 143) to: `'Session status: active = usable, claiming = upgrade in progress, revoked = claimed by user'`
3. In `tests/factories/guest-session.factory.ts` line 13, update `GuestSessionFactoryInput.status` type to `'active' | 'claiming' | 'revoked'`

**Tests:**
- Existing tests that create sessions with `status: 'active'` and `status: 'revoked'` continue to pass unchanged
- Factory tests pass with new type

**Acceptance criteria:**
- [x] GuestSessions collection accepts `active`, `claiming`, `revoked` statuses
- [x] `expired` status is removed from options
- [x] Types regenerate cleanly via `pnpm generate:types`

**Time estimate:** 10 minutes

---

### Step 2: Add atomic claim lock acquisition (`active` → `claiming` CAS)

**Files:**
- `src/server/services/guest-session.ts` (MODIFIED) — add `acquireClaimLock()` and `getGuestSessionByTokenForClaim()`

**Changes:**
1. Add a new function `getGuestSessionByTokenForClaim(payload, token)` that finds a session by tokenHash with status `active` OR `claiming` (for resumability). Returns the session doc or null.
2. Add a new function `acquireClaimLock(payload, sessionId, claimingUserId)`:
   - Uses `payload.db.collections['guest-sessions'].findOneAndUpdate()` (direct MongoDB driver) with filter `{ _id: sessionId, status: 'active' }` and update `{ $set: { status: 'claiming', claimedByUser: claimingUserId } }` with `returnDocument: 'after'`.
   - Returns `{ locked: true, session }` if CAS succeeds.
   - If CAS fails (no matching doc), check if session is already `claiming` with same `claimedByUser` — if so, return `{ locked: true, session, resumed: true }` (resumable).
   - If session is `revoked` or missing, return `{ locked: false, alreadyCompleted: true }`.
   - If session is `claiming` with different user, return `{ locked: false, inProgress: true }`.
3. Add a new function `completeClaimLock(payload, sessionId, userId)`:
   - Transitions `claiming` → `revoked` via atomic `findOneAndUpdate` with filter `{ _id: sessionId, status: 'claiming' }` and update `{ $set: { status: 'revoked', claimedAt: new Date().toISOString() } }`.

**Implementation note:** Use `payload.db.connection.collection('guest-sessions')` for direct MongoDB access (Payload's Mongoose adapter exposes this). This avoids Payload's access control layer since these are internal operations.

**Tests:**
- Unit test: `acquireClaimLock` returns `locked: true` for active session
- Unit test: `acquireClaimLock` returns `resumed: true` for already-claiming same user
- Unit test: `acquireClaimLock` returns `alreadyCompleted: true` for revoked session
- Unit test: `acquireClaimLock` returns `inProgress: true` for claiming by different user

**Acceptance criteria:**
- [x] CAS is atomic (single MongoDB operation)
- [x] Same user can resume a `claiming` session
- [x] Different user cannot steal a `claiming` session
- [x] Already-revoked sessions return no-op success

**Time estimate:** 25 minutes

---

### Step 3: Rewrite `claimGuestConversations()` with lock-based idempotent flow

**Files:**
- `src/server/services/guest-session-upgrade.ts` (MODIFIED)

**Changes:**
Rewrite `claimGuestConversations()` (lines 31-79) with this flow:

1. **Resolve session**: Call `getGuestSessionByTokenForClaim(payload, sessionToken)` (finds `active` or `claiming`).
   - If null → no-op success (session already fully revoked or expired). Clear cookie, return `{ claimed: 0 }`.
2. **Acquire lock**: Call `acquireClaimLock(payload, session.id, userId)`.
   - If `alreadyCompleted` → no-op success, clear cookie, return `{ claimed: 0 }`.
   - If `inProgress` → throw retryable error (different user is claiming).
   - If `locked` (fresh or resumed) → proceed.
3. **Bulk transfer**: Use `payload.update()` with `where` clause to bulk-update all conversations:
   ```ts
   await payload.update({
     collection: 'conversations',
     where: {
       and: [
         { guestSession: { equals: session.id } },
         { archivedAt: { exists: false } },
       ],
     },
     data: { user: userId, guestSession: null },
     overrideAccess: true,
   })
   ```
   This replaces the N+1 loop (lines 59-70). Falls back to individual updates if bulk not supported.
4. **Verify zero remaining**: Query conversations where `guestSession = session.id` and `archivedAt` does not exist. If count > 0, log error but do NOT revoke — leave `claiming` for retry.
5. **Complete lock**: If zero remaining, call `completeClaimLock(payload, session.id, userId)`.
6. Clear guest session cookie.
7. Return `{ claimed: count, headers }`.

**Key changes from current code:**
- Replace `getGuestSessionByToken` (which filters `status: 'active'` only) with `getGuestSessionByTokenForClaim` (which also finds `claiming`)
- Add CAS lock before transfer
- Replace N+1 loop with bulk update (FR NFR-004)
- Add verification step before revocation (FR-003)
- On error after lock, do NOT revoke — leave `claiming` for safe retry
- Accept optional `req` parameter for context propagation (FR-006)

**Tests:**
- Unit test: Successful claim acquires lock, transfers, verifies, completes
- Unit test: Partial failure leaves session in `claiming` state
- Unit test: Retry after partial failure completes the transfer
- Unit test: Already-revoked session is no-op

**Acceptance criteria:**
- [x] Claim acquires atomic lock before any transfer
- [x] Bulk update replaces N+1 loop
- [x] Session stays `claiming` on partial failure (safe for retry)
- [x] Session only revoked after verification of zero remaining conversations
- [x] Idempotent: repeated calls converge to correct state

**Time estimate:** 30 minutes

---

### Step 4: Block guest conversation/message creation while `claiming` (FR-004)

**Files:**
- `src/server/services/guest-session.ts` (MODIFIED) — update `getGuestSessionByToken()` and `checkAndIncrementGuestMessageCount()`
- `src/server/services/conversation-service.ts` (MODIFIED) — update `getOrCreateGuestConversation()`
- `src/server/payload/endpoints/agent/auth-middleware.ts` (MODIFIED) — add `claiming` check

**Changes:**

1. **`getGuestSessionByToken()` (guest-session.ts line 160-183)**: Already filters `status: 'active'`, so sessions in `claiming` state are naturally invisible to this function. **No change needed** — this correctly blocks guest operations since `claiming` sessions won't be found.

2. **`checkAndIncrementGuestMessageCount()` (guest-session.ts line 246-286)**: Add a check after `findByID` — if `session.status === 'claiming'`, return `{ allowed: false, remaining: 0, current: 0, max: guestConfig.max_messages }` with an additional `blocked: true` field to distinguish from limit-exceeded.

3. **`getOrCreateGuestConversation()` (conversation-service.ts line 419-484)**: Before creating a new conversation, verify the guest session status is still `active`:
   ```ts
   const sessionDoc = await this.payload.findByID({
     collection: 'guest-sessions',
     id: guestSessionId,
     depth: 0,
   })
   if (!sessionDoc || sessionDoc.status !== 'active') {
     throw new GuestSessionClaimingError()
   }
   ```
   Add a new `GuestSessionClaimingError` class similar to `GuestConversationLimitError`.

4. **`auth-middleware.ts` (line 181-205)**: The existing `getGuestSessionByToken()` call already filters by `status: 'active'`, so a `claiming` session will return `null`, causing the middleware to treat it as "no valid guest session". If `allowGuestCreation` is true, it would create a NEW guest session — **this must be prevented**. Add logic: if `guestToken` exists but `getGuestSessionByToken` returns null, AND we still have a cookie, check if the session is `claiming` (not just expired):
   ```ts
   if (guestToken && !guestSession) {
     // Check if session is in 'claiming' state (not just expired)
     const sessionByHash = await getGuestSessionByTokenAnyStatus(payload, guestToken)
     if (sessionByHash?.status === 'claiming') {
       // Return a specific 'session-claiming' result
       return { kind: 'session-claiming' } as AuthResolutionResult
     }
   }
   ```
   Add a new `AuthResolutionSessionClaiming` type to the discriminated union and a helper `buildSessionClaimingResponse()` that returns HTTP 409 Conflict.

5. **Add `getGuestSessionByTokenAnyStatus()` to `guest-session.ts`**: Same as `getGuestSessionByToken()` but without the `status: 'active'` filter — only checks tokenHash match and not-expired. Used only by the `claiming` check in auth-middleware.

**Chat endpoints that use auth-middleware** (`chat.ts`, `chat-stream.ts`, `reset-chat.ts`, `get-conversation.ts`): These already use `resolveAuthOrGuest()` from auth-middleware. After adding the `session-claiming` result type, each endpoint handler must handle the new kind by returning 409. Add a shared helper in auth-middleware.

**Tests:**
- Test: Guest conversation creation fails with `GuestSessionClaimingError` when session is `claiming`
- Test: `checkAndIncrementGuestMessageCount` returns blocked when session is `claiming`
- Test: Auth middleware returns `session-claiming` when guest token exists but session is `claiming`
- Test: No new guest session is created as fallback when existing one is `claiming`

**Acceptance criteria:**
- [x] `getOrCreateGuestConversation` throws for `claiming` sessions
- [x] Message writes blocked for `claiming` sessions
- [x] Auth middleware returns 409 instead of creating new session
- [x] No new guest session created as fallback during `claiming`

**Time estimate:** 30 minutes

---

### Step 5: Secure login/signup actions — use authenticated identity and cookie-sourced token (FR-005, FR-006)

**Files:**
- `src/app/(frontend)/login/login_authenticate-action.ts` (MODIFIED)
- `src/app/(frontend)/signup/actions/signup_createUser-action.ts` (MODIFIED)

**Changes:**

1. **Login action (lines 77-89)**: Replace direct `claimGuestConversations` call with:
   - `userId` MUST come from `result.user.id` (already correct)
   - `guestToken` MUST come from cookie store (already correct — reads from `cookies()`)
   - Propagate request context: pass through available context
   - Replace `console.error` with `logger.warn` for claim errors (NFR-002)
   - Do NOT call `clearGuestSessionCookie(headers)` separately — `claimGuestConversations` already handles this
   - Do NOT delete cookie on partial failure — only delete after successful claim returns

2. **Signup action (lines 98-109)**: Same pattern as login:
   - `userId` from `user.id` (already correct)
   - `guestToken` from cookie store (already correct)
   - Replace `console.error` with `logger.warn`
   - Remove redundant `clearGuestSessionCookie(headers)` call
   - Only delete cookie after successful claim

3. **Both actions**: Wrap claim in try/catch that distinguishes:
   - Claim succeeded → delete cookie
   - Claim returned `inProgress` error → do NOT delete cookie, log warning
   - Claim threw unexpected error → do NOT delete cookie, log error
   - No guest token → skip claim (already handled)

**Tests:**
- Existing login/signup tests continue to pass
- Manual verification: login with guest session transfers conversations

**Acceptance criteria:**
- [x] `userId` derived from authenticated session, never from parameters
- [x] Guest token from HttpOnly cookie only
- [x] Cookie only cleared after successful claim
- [x] No `console.error` — uses structured logger
- [x] Partial failure does not clear cookie or revoke session

**Time estimate:** 20 minutes

---

### Step 6: Update cleanup cron — respect `claiming`, verify before delete (FR-007)

**Files:**
- `src/server/payload/endpoints/cron/guest-sessions-cleanup.ts` (MODIFIED)

**Changes:**

1. **`findGuestSessionsToCleanup()` (lines 44-69)**: Update the `where` clause to explicitly exclude `claiming` sessions:
   ```ts
   where: {
     and: [
       { status: { not_equals: 'claiming' } }, // FR-007: never delete claiming
       {
         or: [
           { status: { equals: 'revoked' } },
           { hardExpiresAt: { less_than_equal: hardCapDateISO } },
         ],
       },
     ],
   }
   ```

2. **`processSessionCleanup()` (lines 132-174)**: Before deleting the guest session (line 151), verify zero remaining conversations:
   ```ts
   // Verify zero remaining conversations before deleting session
   const remainingConvs = await findOrphanedConversations(payload, session.id)
   if (remainingConvs.totalDocs > 0) {
     // Safety: skip deletion if conversations still linked
     reqLogger.error(
       { sessionId: session.id, remaining: remainingConvs.totalDocs },
       'Skipping session deletion: conversations still linked',
     )
     stats.failedSessionDeletions++
     return
   }
   ```
   Move the session deletion AFTER the verification.

3. **Handle `status: 'active'` with hard expiry**: For sessions that are `active` but hard-expired, the current code deletes them. Add the same zero-conversations verification. These sessions should NOT have conversations (they're truly expired), but verify anyway for safety.

4. **Update `CleanupStats`**: Add `skippedClaimingSessions: number` for observability.

5. **Handle pagination**: The current `limit: 100` means if a session has >100 conversations, not all are found. Change `findOrphanedConversations` to use `totalDocs` count from the query (already available) and only proceed with deletion if the returned `docs.length === totalDocs` (or use a count query instead).

**Tests:**
- Test: Cleanup skips `claiming` sessions entirely
- Test: Cleanup skips `revoked` sessions that still have linked conversations
- Test: Cleanup deletes `revoked` sessions with zero linked conversations
- Test: Cleanup deletes hard-expired `active` sessions with zero conversations

**Acceptance criteria:**
- [x] `claiming` sessions are never deleted
- [x] Sessions with remaining conversations are never deleted
- [x] Stats include skipped/failed counts for observability
- [x] Pagination edge case handled (verify count matches)

**Time estimate:** 20 minutes

---

### Step 7: Update unit tests for new claim flow

**Files:**
- `tests/unit/server/services/guest-session-upgrade.test.ts` (MODIFIED)
- `tests/unit/server/services/guest-session.test.ts` (MODIFIED)

**Changes:**

1. **guest-session-upgrade.test.ts**: Update mocks and test cases to reflect new flow:
   - Add mock for `acquireClaimLock`, `completeClaimLock`, `getGuestSessionByTokenForClaim`
   - Test: Successful claim calls `acquireClaimLock` → bulk update → verify → `completeClaimLock`
   - Test: Partial failure leaves session `claiming`
   - Test: Resumed claim (already `claiming` by same user) completes correctly
   - Test: Already-completed session is no-op
   - Test: Different user cannot claim same session

2. **guest-session.test.ts**: Add tests for new functions:
   - Test: `getGuestSessionByTokenAnyStatus` returns `claiming` sessions
   - Test: `checkAndIncrementGuestMessageCount` blocks `claiming` sessions

**Acceptance criteria:**
- [x] All existing unit tests updated for new signatures
- [x] New unit tests cover all lock states
- [x] No raw tokens in test log output

**Time estimate:** 25 minutes

---

### Step 8: Integration tests for race conditions and partial failures (FR-008)

**Files:**
- `tests/int/guest-session-upgrade.int.spec.ts` (MODIFIED)
- `tests/int/cron-guest-session-cleanup.int.spec.ts` (MODIFIED)
- `tests/int/guest-session-claiming-block.int.spec.ts` (NEW)

**Changes:**

1. **guest-session-upgrade.int.spec.ts**: Add new test cases:
   - Test: "Partial failure during claim does not revoke session":
     - Create session + conversations
     - Manually set session to `claiming` (simulating lock acquired)
     - Call `claimGuestConversations` — should resume
     - Verify conversations transferred, session revoked only after completion
   - Test: "Successful claim: all conversations transferred, session revoked":
     - Already covered by existing test, but verify `claiming` intermediate state
   - Test: "Idempotent retry completes correctly":
     - Call claim, simulate interruption (set some convos transferred, others not)
     - Call claim again — should complete the remaining transfers
   - Test: "Session not revoked when conversations remain":
     - Create session + conversations
     - Acquire lock
     - Verify session stays `claiming` if bulk update fails

2. **cron-guest-session-cleanup.int.spec.ts**: Add test cases:
   - Test: "does not delete `claiming` sessions":
     - Create session with `status: 'claiming'`
     - Run cleanup
     - Verify session still exists
   - Test: "does not delete revoked sessions with linked conversations":
     - Create revoked session with conversations still referencing it
     - Run cleanup
     - Verify session and conversations still exist

3. **guest-session-claiming-block.int.spec.ts** (NEW): Test blocking behavior:
   - Test: "Guest conversation creation blocked while session is claiming":
     - Create guest session, set status to `claiming`
     - Try to create a conversation via `ConversationService.getOrCreateGuestConversation()`
     - Verify throws `GuestSessionClaimingError`
   - Test: "Guest message count increment blocked while session is claiming":
     - Set session to `claiming`
     - Call `checkAndIncrementGuestMessageCount`
     - Verify returns `allowed: false`
   - Test: "No new guest session created as fallback during claiming":
     - Verify auth middleware doesn't create new session when existing one is `claiming`

**Acceptance criteria:**
- [x] Partial failure + retry test passes
- [x] Concurrent creation during claim window is blocked
- [x] Full successful claim transfers all and revokes
- [x] Cleanup safety tests pass (claiming never deleted, linked conversations prevent deletion)

**Time estimate:** 30 minutes

---

### Step 9: Type generation and quality gates

**Files:**
- `src/payload-types.ts` (REGENERATED)

**Changes:**
1. Run `pnpm generate:types` to regenerate types with new `claiming` status
2. Run `pnpm generate:importmap` if any admin components changed
3. Run `pnpm -s tsc --noEmit` to verify type correctness
4. Run `pnpm -s lint` and fix any issues
5. Run `pnpm -s format` and fix any issues
6. Run integration tests: `pnpm test:int` (focused on guest session tests)

**Acceptance criteria:**
- [x] Types regenerated cleanly
- [x] TypeScript compiles without errors
- [x] Lint passes
- [x] All integration tests pass

**Time estimate:** 15 minutes

---

## Assumptions

1. **MongoDB direct access**: Payload's Mongoose adapter exposes `payload.db.connection` which allows direct MongoDB `findOneAndUpdate` for CAS operations. If not available, fall back to Payload's `find` + `update` with optimistic concurrency (check returned doc status).
2. **Bulk `payload.update()` with `where`**: Payload v3 supports bulk updates via `where` clause. If not available, fall back to individual updates in a loop (current behavior) but with the lock protecting against races.
3. **No replica set required**: The lock-based CAS approach works without MongoDB transactions/replica set, per @payload-expert recommendation.
4. **`expired` status not actively used**: The current code uses `hardExpiresAt` date field for expiry checking, not the `expired` status. Removing `expired` from options is safe.
5. **Auth middleware is the single entry point**: All chat endpoints go through `resolveAuthOrGuest()` in auth-middleware.ts, so adding the `claiming` check there covers all paths.

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Direct MongoDB access (`findOneAndUpdate`) may not be available via Payload adapter | Medium | Check `payload.db.connection.collection()` availability; fall back to Payload API with optimistic locking if needed |
| Bulk `payload.update()` with `where` may behave differently than expected | Low | Test thoroughly; fall back to loop-based updates within the lock |
| Existing sessions with `status: 'expired'` in the database | Low | They won't match any query (no code queries for `expired`), and cleanup cron catches them via `hardExpiresAt` |
| Stuck `claiming` sessions (crash after lock, before completion) | Medium | Open question #4 in spec. For now, manual intervention required. Future: add TTL on `claiming` state (e.g., 5 minutes) with auto-reset to `active` in cleanup cron |
| Multiple tabs triggering login simultaneously | Low | CAS ensures only one tab's claim succeeds; others get resumable/no-op results |
| Performance regression from verification query | Low | Single count query per claim; negligible vs current N+1 updates |
