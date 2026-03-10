# Gap Analysis: 260309-auto-882

## Summary

- Gaps Found: 8
- Spec Revised: Yes

## Gaps Found

### Gap 1: Missing `claiming` status in GuestSessions collection

**Severity:** Critical
**Location:** `src/server/payload/collections/GuestSessions.ts`
**Issue:** The GuestSessions collection currently defines status options as `active`, `expired`, `revoked`. FR-001 requires a `claiming` state to represent an in-progress upgrade lock. The spec must add `claiming` to the status options and handle backward compatibility with the existing `expired` status.
**Fix Applied:** Added to spec's Open Questions section: clarify that `expired` status should be deprecated in favor of `active` + TTL checking, or mapped to `revoked` semantics.

### Gap 2: No atomic compare-and-set lock acquisition

**Severity:** Critical
**Location:** `src/server/services/guest-session.ts`, `src/server/services/guest-session-upgrade.ts`
**Issue:** FR-002 requires atomic transition from `active` → `claiming` using compare-and-set. Current implementation (`claimGuestConversations()`) just reads the session and proceeds without any locking mechanism. This allows concurrent claims to interleave.
**Fix Applied:** Added to FR-002 acceptance criteria and Guardrails: implementation must use atomic CAS operation (e.g., `findOneAndUpdate` with status filter) to prevent concurrent claims.

### Gap 3: No blocking of guest conversation creation while `claiming`

**Severity:** Critical
**Location:** `src/server/services/conversation-service.ts` - `getOrCreateGuestConversation()`
**Issue:** FR-004 requires that while a session is `claiming`, new guest conversations and messages must be blocked with a retryable error. Current implementation doesn't check session status at all before creating conversations.
**Fix Applied:** Added explicit acceptance criterion: "While `status=claiming`, `getOrCreateGuestConversation` and guest message creation reject the request with a retryable error."

### Gap 4: `revokeGuestSession` doesn't accept request context (`req`)

**Severity:** High
**Location:** `src/server/services/guest-session.ts` - `revokeGuestSession()` function
**Issue:** FR-006 requires `revokeGuestSession` to support request context propagation for transaction safety. Current function signature is `revokeGuestSession(payload, sessionId, claimedByUser)` - no `req` parameter.
**Fix Applied:** Added FR-006 with explicit requirement that `revokeGuestSession` and claim flow accept and propagate `req` context.

### Gap 5: Cleanup cron doesn't exclude `claiming` sessions and deletes before verifying zero conversations

**Severity:** High
**Location:** `src/server/payload/endpoints/cron/guest-sessions-cleanup.ts`
**Issue:** FR-007 requires:
1. Exclude `status=claiming` from deletion candidates - not implemented
2. Verify zero remaining conversations BEFORE deleting session - current implementation deletes orphaned conversations, then deletes session, but doesn't skip deletion if conversations remain

Current code at line 139-148 deletes conversations first, then deletes session at line 151. This is backwards from spec requirement: "if not zero, skip deletion and record an error/metric."
**Fix Applied:** Updated FR-007 acceptance criteria to explicitly require verification before deletion and skipping when conversations remain.

### Gap 6: Login/signup actions don't propagate `req` context to claim flow

**Severity:** Medium
**Location:** `src/app/(frontend)/login/login_authenticate-action.ts`, `src/app/(frontend)/signup/actions/signup_createUser-action.ts`
**Issue:** Both actions call `claimGuestConversations()` but don't pass a `req` object. This limits transaction context and audit capabilities. The spec notes that Server Actions don't receive `NextRequest`, but the claim flow should still receive whatever context is available.
**Fix Applied:** Added FR-006 to clarify that claim entrypoints should derive userId from authenticated context and propagate any available request context.

### Gap 7: N+1 pattern for conversation updates

**Severity:** Medium
**Location:** `src/server/services/guest-session-upgrade.ts` - lines 59-70
**Issue:** NFR-004 requires avoiding N+1 updates where possible. Current implementation loops through conversations one-by-one with individual `payload.update()` calls.
**Fix Applied:** Added explicit NFR-004 requirement for bulk/paginated updates.

### Gap 8: No existing tests for race conditions and partial failures

**Severity:** Medium
**Location:** `tests/int/guest-session-upgrade.int.spec.ts`
**Issue:** FR-008 requires new integration tests for:
- Partial failure during claim + retry
- Concurrent creation during claim window
- Full successful claim
- Cleanup safety

Current tests cover happy path but not race conditions.
**Fix Applied:** FR-008 added with specific test scenarios to implement.

## Changes Made to Spec

- **Added FR-006 (revised)**: Explicit requirement for `revokeGuestSession` to accept `req` parameter and propagate request context through claim flow
- **Updated FR-001**: Clarified legacy status handling - `expired` should be deprecated in favor of `active` + TTL-based expiration
- **Updated FR-002**: Added acceptance criterion for atomic CAS operation
- **Updated FR-004**: Added explicit acceptance criterion for blocking guest conversation creation while claiming
- **Updated FR-007**: Clarified that cleanup must verify zero remaining conversations BEFORE deleting session (not after), and skip deletion if conversations remain
- **Updated NFR-004**: Explicit requirement for bulk/paginated updates instead of N+1
- **Added explicit acceptance criterion**: Claim flow must verify zero remaining conversations before revoking session
- **Updated Guardrails**: Added "Do NOT clear the guest cookie or revoke the guest session on partial failure" - this was implicit but should be explicit

## Open Questions Identified (Previously in spec, now validated)

1. **Legacy status handling**: Confirmed - current collection has `expired` status that needs to be handled
2. **Transaction strategy**: Validated - @payload-expert warning about Mongo transactions requiring replica set is correct; implementation should use lock-based idempotency
3. **Blocked operations scope**: Validated - both conversation and message creation should be blocked during claiming
4. **Stuck claiming recovery**: Still open - spec needs to address timeout/reset behavior
5. **HTTP status contract**: Still open - spec should specify 409 vs 423

## No Gaps Found (Minor observations - not blocking)

- Logging doesn't appear to leak raw guest tokens in the current implementation (good)
- Login/signup correctly derive userId from authenticated context, not from parameters (good)
- Cleanup handles pagination with 100 limit (acceptable for now, but FR-007 requires safety-first approach)
